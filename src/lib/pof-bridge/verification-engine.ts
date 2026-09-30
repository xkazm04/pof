import type {
  AssetManifest,
  VerificationChange,
  VerificationChangeKind,
  VerificationPlan,
  VerificationRefusal,
  VerificationRule,
  VerificationResult,
  VerificationVerdict,
} from '@/types/pof-bridge';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { normalizeFeatureSource } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { FeatureDefinition } from '@/lib/feature-definitions';
import { VERIFICATION_RULES } from './verification-rules';
import { tryApiFetch } from '@/lib/api-utils';
import { eventBus } from '@/lib/event-bus';
import type { UpsertFeature } from '@/lib/feature-matrix-db';

/** Normalize a rule's return: built-in rules give a verdict, ad-hoc rules may give a bare status. */
function evaluate(rule: VerificationRule, manifest: AssetManifest): VerificationVerdict {
  const out = rule.check(manifest);
  return typeof out === 'string' ? { status: out, evidence: [] } : out;
}

/**
 * Run all verification rules against the manifest and return results.
 * Does NOT update the database -- pure evaluation only.
 */
export function runVerification(
  manifest: AssetManifest,
  rules: VerificationRule[] = VERIFICATION_RULES,
): VerificationResult[] {
  return rules.map((rule) => {
    const verdict = evaluate(rule, manifest);
    return {
      featureName: rule.featureName,
      moduleId: rule.moduleId,
      previousStatus: null, // Caller can fill this in from current DB state
      newStatus: verdict.status,
      evidence: verdict.evidence,
    };
  });
}

/** Status ladder for classifying a flip. `unknown` / no row carry no verdict (-1). */
const RANK: Record<FeatureStatus, number> = { unknown: -1, missing: 0, partial: 1, implemented: 2, improved: 3 };

function kindOf(from: FeatureStatus | null, to: FeatureStatus): VerificationChangeKind {
  const a = from === null ? -1 : RANK[from];
  const b = RANK[to];
  if (a === -1 && b <= 0) return 'lateral';
  return b > a ? 'upgrade' : b < a ? 'downgrade' : 'lateral';
}

type DeclaredFeature = Pick<FeatureDefinition, 'featureName' | 'category'> & { description?: string };
type DefsByModule = Partial<Record<SubModuleId, DeclaredFeature[]>>;

/**
 * PURE: propose Feature Matrix flips from a manifest, without writing anything.
 *
 * - Rules for a feature not declared in `defs[moduleId]` are REFUSED (never proposed,
 *   never written) — a rule must not mint a phantom matrix row.
 * - Each change carries the assets that justify it, its kind, and `selectedByDefault`:
 *   a downgrade of a `review` / `fix` verdict starts unpicked, because an asset
 *   manifest cannot see C++ and so cannot overrule a verdict a reader gave.
 */
export function planVerification(
  manifest: AssetManifest,
  moduleId: SubModuleId,
  currentRows: FeatureRow[],
  rules: VerificationRule[] = VERIFICATION_RULES,
  defs: DefsByModule = MODULE_FEATURE_DEFINITIONS,
): VerificationPlan {
  const declared = new Map((defs[moduleId] ?? []).map((d) => [d.featureName, d]));
  const rows = new Map(currentRows.map((r) => [r.featureName, r]));
  const plan: VerificationPlan = {
    moduleId, assetCount: manifest.assetCount, changes: [], unchanged: [], refused: [], results: [],
  };

  for (const rule of rules) {
    if (rule.moduleId !== moduleId) continue;
    const def = declared.get(rule.featureName);
    if (!def) {
      const refusal: VerificationRefusal = { featureName: rule.featureName, moduleId, reason: 'undeclared' };
      plan.refused.push(refusal);
      continue;
    }
    const verdict = evaluate(rule, manifest);
    const existing = rows.get(rule.featureName);
    const from = existing?.status ?? null;
    const result: VerificationResult = {
      featureName: rule.featureName,
      moduleId,
      previousStatus: from,
      newStatus: verdict.status,
      evidence: verdict.evidence,
      details: `Auto-verified from manifest (${manifest.assetCount} assets)`,
    };
    plan.results.push(result);
    if (from === verdict.status) {
      plan.unchanged.push(result);
      continue;
    }
    const kind = kindOf(from, verdict.status);
    const fromSource = existing ? normalizeFeatureSource(existing.source) : undefined;
    const protectedVerdict = fromSource === 'review' || fromSource === 'fix';
    plan.changes.push({
      featureName: rule.featureName,
      moduleId,
      from,
      to: verdict.status,
      evidence: verdict.evidence,
      kind,
      selectedByDefault: !(kind === 'downgrade' && protectedVerdict),
      fromSource,
      base: {
        category: existing?.category ?? def.category,
        description: existing?.description ?? def.description ?? '',
        filePaths: existing?.filePaths ?? [],
        qualityScore: existing?.qualityScore ?? null,
        nextSteps: existing?.nextSteps ?? '',
      },
    });
  }
  return plan;
}

/** Append the active project to a feature-matrix URL. Omitted when no project was
 *  given, so an unscoped verify is VISIBLY unscoped instead of sending an empty
 *  parameter that reads like a scope. Mirrors `useFeatureMatrix.withProject`. */
function withProject(url: string, projectId: string | undefined): string {
  if (!projectId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}projectId=${encodeURIComponent(projectId)}`;
}

/** Read the module's current rows through the SAME scope the apply writes under. A
 *  global read paired with a scoped write would diff this project's rules against
 *  another project's rows and "change" statuses that never moved. */
export async function readVerificationRows(
  moduleId: SubModuleId,
  projectId?: string,
): Promise<{ ok: true; rows: FeatureRow[] } | { ok: false; error: string }> {
  const result = await tryApiFetch<{ features: FeatureRow[] }>(
    withProject(`/api/feature-matrix?moduleId=${encodeURIComponent(moduleId)}`, projectId),
  );
  return result.ok ? { ok: true, rows: result.data.features ?? [] } : { ok: false, error: result.error };
}

export interface VerificationApplyOutcome {
  /** The changes actually sent (picked AND proposed); empty when nothing was picked. */
  written: VerificationChange[];
  /** Set when the POST failed — nothing in `written` persisted. */
  writeError?: string;
}

const EVIDENCE_IN_NOTES = 5;

/**
 * Write the PICKED changes of a plan: one POST, source 'verify', stamped with the
 * project. Only names that are proposed changes in `plan` can be written — a refused
 * or unchanged name in `selectedNames` is ignored.
 *
 * `projectId` is the ACTIVE PROJECT, passed explicitly by the caller. A verify with
 * no project writes UNATTRIBUTED rather than being adopted by whatever is open.
 */
export async function applyVerification(
  plan: VerificationPlan,
  selectedNames: Iterable<string>,
  projectId?: string,
): Promise<VerificationApplyOutcome> {
  const picked = new Set(selectedNames);
  const written = plan.changes.filter((c) => picked.has(c.featureName));
  if (written.length === 0) return { written };

  const now = new Date().toISOString();
  // /api/feature-matrix POST is a FULL upsert — partial rows bind undefined into
  // required columns and the whole batch 500s. Each change carries the stored row's
  // fields (or its declared category), so they survive.
  const updates: UpsertFeature[] = written.map((c) => {
    const shown = c.evidence.slice(0, EVIDENCE_IN_NOTES).join(', ');
    const more = c.evidence.length > EVIDENCE_IN_NOTES ? ` (+${c.evidence.length - EVIDENCE_IN_NOTES} more)` : '';
    return {
      featureName: c.featureName,
      status: c.to,
      category: c.base?.category ?? 'general',
      description: c.base?.description ?? '',
      filePaths: c.base?.filePaths ?? [],
      qualityScore: c.base?.qualityScore ?? null,
      nextSteps: c.base?.nextSteps ?? '',
      reviewNotes: `Auto-verified from PoF Bridge manifest at ${now}: ${c.from ?? 'no row'} -> ${c.to}; ${
        c.evidence.length > 0 ? `evidence ${shown}${more}` : `no matching asset in ${plan.assetCount}`
      }`,
      lastReviewedAt: now,
    };
  });

  const writeResult = await tryApiFetch('/api/feature-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // source 'verify': these verdicts come from matching the live UE5 asset
    // manifest, not from a code review — the row must be able to say which.
    body: JSON.stringify({ moduleId: plan.moduleId, features: updates, source: 'verify', projectId }),
  });

  if (!writeResult.ok) {
    console.error('[verification-engine] feature-matrix write failed:', writeResult.error);
    return { written, writeError: writeResult.error };
  }
  // Only emit "changed" events when the write actually persisted — a failed write
  // retried on the next poll would otherwise storm the bus with changes the DB
  // never recorded.
  for (const c of written) {
    eventBus.emit(
      'checklist.item.changed',
      {
        moduleId: plan.moduleId,
        itemId: c.featureName,
        checked: c.to === 'implemented' || c.to === 'improved',
        source: 'auto-verify',
      },
      'verification-engine',
    );
  }
  return { written };
}

/** Fold an apply outcome back onto the plan's per-rule results (written flag / error). */
export function resultsAfterApply(plan: VerificationPlan, outcome: VerificationApplyOutcome): VerificationResult[] {
  const written = new Set(outcome.written.map((c) => c.featureName));
  return plan.results.map((r) => ({
    ...r,
    written: written.has(r.featureName) && !outcome.writeError,
    ...(outcome.writeError && written.has(r.featureName) ? { writeError: outcome.writeError } : {}),
  }));
}

/**
 * HEADLESS verify: plan, then apply the default picks (never a review/fix downgrade,
 * never an undeclared feature). The UI previews instead — see `useFeatureMatrix`.
 *
 * A caller that passes its own `rules` supplies its own declaration: the rule table
 * IS the feature list (custom tables are test/probe fixtures, and the built-in table
 * is pinned to the declared graph by a drift test). With the built-in rules, the
 * declaration is `MODULE_FEATURE_DEFINITIONS`.
 *
 * If the current rows cannot be read, NOTHING is written: without them a review
 * verdict would read as "no row" and be overwritten.
 */
export async function autoUpdateFeatureMatrix(
  manifest: AssetManifest,
  moduleId: SubModuleId,
  rules?: VerificationRule[],
  projectId?: string,
): Promise<VerificationResult[]> {
  const table = rules ?? VERIFICATION_RULES;
  if (!table.some((r) => r.moduleId === moduleId)) return [];
  const defs: DefsByModule = rules
    ? { [moduleId]: rules.filter((r) => r.moduleId === moduleId).map((r) => ({ featureName: r.featureName, category: 'general' })) }
    : MODULE_FEATURE_DEFINITIONS;

  const current = await readVerificationRows(moduleId, projectId);
  const plan = planVerification(manifest, moduleId, current.ok ? current.rows : [], table, defs);
  if (!current.ok) {
    return plan.results.map((r) => ({ ...r, previousStatus: null, writeError: `current rows unreadable: ${current.error}` }));
  }
  const picks = plan.changes.filter((c) => c.selectedByDefault).map((c) => c.featureName);
  const outcome = await applyVerification(plan, picks, projectId);
  return resultsAfterApply(plan, outcome);
}

/**
 * Get verification rules applicable to a specific module.
 */
export function getRulesForModule(
  moduleId: SubModuleId,
): VerificationRule[] {
  return VERIFICATION_RULES.filter((r) => r.moduleId === moduleId);
}
