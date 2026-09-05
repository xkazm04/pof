/**
 * Routing: the move that makes a playtest session pay.
 *
 * A finding that never reaches the person who owns the defect class is a
 * finding nobody acts on. The Game Director already knows how to map a finding
 * to a sub-module (`findingFix.ts`'s `CATEGORY_TO_MODULE`, which the one-click
 * repair flow uses); this module takes the other half of the trip — on session
 * completion it appends the finding to the feature matrix's `nextSteps` for the
 * module that owns it, which is where the module's own work queue is read.
 *
 * Rules this write-back holds itself to:
 *
 * - **Scoped or refused.** The feature matrix is project-scoped and an unscoped
 *   read returns only the legacy bucket. A write-back with no project is
 *   refused with its reason, never silently applied to whatever rows a blank
 *   scope happens to return.
 * - **Append, never overwrite.** The operator's own `nextSteps` text is
 *   preserved verbatim; the routed line is added after it.
 * - **Idempotent.** Every line is stamped with the session id, and a row that
 *   already carries this session's stamp is left exactly as it is — completing
 *   the same session twice does not double the queue.
 * - **A simulated finding may never read as an observed gap.** The line names
 *   its provenance in words, so a `simulated` session's write-back says so on
 *   the row a human will read months later.
 * - **No default bucket.** A finding whose category owns no module is reported
 *   as `unrouted` rather than filed under the polish catch-all, and so is a
 *   module that holds no row under this project. The size of that list measures
 *   the routing table, not the build.
 *
 * Reads and writes go through injected deps bound to the feature-matrix API by
 * the caller; nothing here edits `feature-matrix-db.ts`.
 */

import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';
import type { PlaytestFinding, SessionSource } from '@/types/game-director';
import { findingRouteModuleId } from '@/components/modules/game-director/findingFix';
import { ok, err, type Result } from '@/types/result';

/** The full-row upsert shape the feature-matrix POST accepts. */
export interface MatrixUpsertRow {
  featureName: string;
  category: string;
  status: FeatureRow['status'];
  description: string;
  filePaths: string[];
  reviewNotes: string;
  qualityScore: number | null;
  nextSteps: string;
  lastReviewedAt: string | null;
}

export interface MatrixRoutingDeps {
  /** Read one module's rows, ALWAYS scoped to the project. */
  readModule(moduleId: SubModuleId, projectId: string): Promise<FeatureRow[]>;
  /** Write rows back for one module, ALWAYS scoped to the project. */
  writeModule(moduleId: SubModuleId, projectId: string, rows: MatrixUpsertRow[]): Promise<void>;
}

export interface RoutedRow {
  moduleId: SubModuleId;
  featureName: string;
  findings: number;
}

export interface RoutingMiss {
  what: string;
  reason: string;
}

export interface RoutingOutcome {
  /** Rows this write-back actually appended a line to. */
  updated: RoutedRow[];
  /** Rows already carrying this session's stamp — a re-complete changes nothing. */
  alreadyPresent: RoutedRow[];
  /** Findings (or modules) nothing could own. A named state, not a silent drop. */
  unrouted: RoutingMiss[];
  /** One sentence the session detail can render verbatim. */
  disclosure: string;
}

/** The stamp that makes the line attributable and the write-back idempotent. */
export function sessionStamp(sessionId: string): string {
  return `[game-director ${sessionId}]`;
}

/**
 * How the line describes where it came from. A simulated session's findings are
 * authored templates over which no build was launched — the row must say that,
 * or a canned finding becomes an observed gap the moment somebody reads it.
 */
function provenancePhrase(source: SessionSource): string {
  return source === 'external'
    ? 'measured external playtest session'
    : 'SIMULATED session (dev fixture — no build was launched and nothing was measured; not an observed gap)';
}

/**
 * The row a module's queue line belongs on: its weakest, since that is the row
 * whose work is already outstanding. `missing` outranks everything; then the
 * lowest recorded quality; a row with NO quality score is not treated as the
 * lowest (an unscored row is unknown, not bad), so it sorts last.
 */
export function weakestRow(rows: FeatureRow[]): FeatureRow | null {
  if (rows.length === 0) return null;
  const ranked = [...rows].sort((a, b) => {
    const missA = a.status === 'missing' ? 0 : 1;
    const missB = b.status === 'missing' ? 0 : 1;
    if (missA !== missB) return missA - missB;
    const qa = a.qualityScore ?? Number.POSITIVE_INFINITY;
    const qb = b.qualityScore ?? Number.POSITIVE_INFINITY;
    if (qa !== qb) return qa - qb;
    return a.featureName.localeCompare(b.featureName);
  });
  return ranked[0];
}

export interface RouteFindingsArgs {
  sessionId: string;
  sessionName: string;
  source: SessionSource;
  findings: PlaytestFinding[];
  /** The active project. Empty ⇒ the write-back is refused, not widened. */
  projectId: string;
}

/**
 * Append one queue line per owning module. Returns what it changed, what it
 * left alone, and what it could not route — the caller discloses all three.
 */
export async function routeFindingsToMatrix(
  args: RouteFindingsArgs,
  deps: MatrixRoutingDeps,
): Promise<Result<RoutingOutcome, string>> {
  const projectId = args.projectId?.trim() ?? '';
  if (!projectId) {
    return err(
      'No active project — a feature-matrix write with no project scope would land on the unattributed legacy rows rather than this project\'s. Nothing was written.',
    );
  }

  const byModule = new Map<SubModuleId, PlaytestFinding[]>();
  const unrouted: RoutingMiss[] = [];

  for (const finding of args.findings) {
    const moduleId = findingRouteModuleId(finding);
    if (!moduleId) {
      unrouted.push({
        what: finding.title,
        reason: `no sub-module owns the "${finding.category}" defect class; the finding was NOT filed under a catch-all module.`,
      });
      continue;
    }
    const bucket = byModule.get(moduleId) ?? [];
    bucket.push(finding);
    byModule.set(moduleId, bucket);
  }

  const stamp = sessionStamp(args.sessionId);
  const updated: RoutedRow[] = [];
  const alreadyPresent: RoutedRow[] = [];

  for (const [moduleId, moduleFindings] of byModule) {
    const rows = await deps.readModule(moduleId, projectId);
    const target = weakestRow(rows);
    if (!target) {
      unrouted.push({
        what: moduleId,
        reason: `${moduleFindings.length} finding(s) route to "${moduleId}", which holds no feature-matrix row under this project — seed or review the module first. Nothing was invented to hold them.`,
      });
      continue;
    }

    if (target.nextSteps.includes(stamp)) {
      alreadyPresent.push({ moduleId, featureName: target.featureName, findings: moduleFindings.length });
      continue;
    }

    const titles = moduleFindings.map((f) => `${f.severity}: ${f.title}`).join('; ');
    const line = `${stamp} ${moduleFindings.length} finding(s) routed here from "${args.sessionName}", a ${provenancePhrase(args.source)} — ${titles}`;
    const nextSteps = target.nextSteps.trim() ? `${target.nextSteps.trimEnd()}\n${line}` : line;

    await deps.writeModule(moduleId, projectId, [
      {
        featureName: target.featureName,
        category: target.category,
        status: target.status,
        description: target.description,
        filePaths: target.filePaths,
        reviewNotes: target.reviewNotes,
        qualityScore: target.qualityScore,
        nextSteps,
        // The row was NOT re-reviewed by this write — only its queue changed,
        // so its review date stays where the reviewer left it.
        lastReviewedAt: target.lastReviewedAt,
      },
    ]);

    updated.push({ moduleId, featureName: target.featureName, findings: moduleFindings.length });
  }

  const parts = [`${updated.length} matrix row${updated.length === 1 ? '' : 's'} updated`];
  if (alreadyPresent.length > 0) parts.push(`${alreadyPresent.length} already carried this session's line`);
  if (unrouted.length > 0) parts.push(`${unrouted.length} finding(s) or module(s) could not be routed`);

  return ok({
    updated,
    alreadyPresent,
    unrouted,
    disclosure: parts.join(' · '),
  });
}

// ─── Priority systems, seeded from the matrix ────────────────────────────────

/** One module the New Session form offers as a priority, with WHY. */
export interface PrioritySuggestion {
  moduleId: SubModuleId;
  /** Human reason, e.g. "3 missing, avg quality 41". */
  reason: string;
  missing: number;
  avgQuality: number | null;
}

/** The aggregate row shape `/api/feature-matrix/aggregate` returns. */
export interface AggregateRow {
  moduleId: SubModuleId;
  total: number;
  missing: number;
  avgQuality: number | null;
}

/**
 * Which modules a session should prioritise, derived from the matrix rather
 * than typed from memory: the modules with `missing` rows first, then the
 * lowest average quality.
 *
 * A module with NO rows under this project is never suggested. It is not a weak
 * module — it is an unreviewed one, and offering it as "0 missing" would be a
 * claim about a module nothing has looked at.
 */
export function derivePrioritySystems(rows: AggregateRow[], limit = 5): PrioritySuggestion[] {
  return rows
    .filter((r) => r.total > 0 && (r.missing > 0 || (r.avgQuality != null && r.avgQuality < 70)))
    .sort((a, b) => {
      if (b.missing !== a.missing) return b.missing - a.missing;
      const qa = a.avgQuality ?? Number.POSITIVE_INFINITY;
      const qb = b.avgQuality ?? Number.POSITIVE_INFINITY;
      if (qa !== qb) return qa - qb;
      return a.moduleId.localeCompare(b.moduleId);
    })
    .slice(0, limit)
    .map((r) => ({
      moduleId: r.moduleId,
      missing: r.missing,
      avgQuality: r.avgQuality,
      reason: [
        r.missing > 0 ? `${r.missing} missing` : null,
        r.avgQuality != null ? `avg quality ${Math.round(r.avgQuality)}` : 'no quality score recorded',
      ]
        .filter(Boolean)
        .join(', '),
    }));
}
