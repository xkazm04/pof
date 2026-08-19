import type {
  AssetManifest,
  VerificationRule,
  VerificationResult,
} from '@/types/pof-bridge';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';
import { VERIFICATION_RULES } from './verification-rules';
import { tryApiFetch } from '@/lib/api-utils';
import { eventBus } from '@/lib/event-bus';
import type { UpsertFeature } from '@/lib/feature-matrix-db';

/**
 * Run all verification rules against the manifest and return results.
 * Does NOT update the database -- pure evaluation only.
 */
export function runVerification(
  manifest: AssetManifest,
  rules: VerificationRule[] = VERIFICATION_RULES,
): VerificationResult[] {
  return rules.map((rule) => ({
    featureName: rule.featureName,
    moduleId: rule.moduleId,
    previousStatus: null, // Caller can fill this in from current DB state
    newStatus: rule.check(manifest),
  }));
}

/** Append the active project to a feature-matrix URL. Omitted when no project was
 *  given, so an unscoped verify is VISIBLY unscoped instead of sending an empty
 *  parameter that reads like a scope. Mirrors `useFeatureMatrix.withProject`. */
function withProject(url: string, projectId: string | undefined): string {
  if (!projectId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}projectId=${encodeURIComponent(projectId)}`;
}

/**
 * Run verification for a specific module and update the Feature Matrix DB
 * via the API. Compares against current feature statuses and only updates
 * rows whose status actually changed.
 *
 * Emits `checklist.item.changed` events for each changed feature.
 *
 * `projectId` is the ACTIVE PROJECT, passed explicitly by the caller (the same
 * `projectPath` every other feature-matrix path already carries). It was the one
 * write path left unstamped after project scoping, so every UE5 auto-verify row
 * landed unattributed (`project_id = ''`) — visible to every project, and a fresh
 * source of exactly the unattributed rows the scoping work exists to end. Nothing
 * here infers it: a verify run with no project available still writes, but writes
 * UNATTRIBUTED rather than being silently adopted by whatever happens to be open.
 */
export async function autoUpdateFeatureMatrix(
  manifest: AssetManifest,
  moduleId: SubModuleId,
  rules?: VerificationRule[],
  projectId?: string,
): Promise<VerificationResult[]> {
  const applicableRules = (rules ?? VERIFICATION_RULES).filter(
    (r) => r.moduleId === moduleId,
  );
  if (applicableRules.length === 0) return [];

  // Fetch current feature matrix state for this module — through the SAME scope the
  // write below uses. A global read paired with a scoped write would diff this
  // project's rules against another project's rows and "change" statuses that never
  // moved.
  const currentResult = await tryApiFetch<{
    features: FeatureRow[];
  }>(withProject(`/api/feature-matrix?moduleId=${encodeURIComponent(moduleId)}`, projectId));

  const currentFeatures = currentResult.ok ? currentResult.data.features : [];
  const featureMap = new Map(
    currentFeatures.map((f) => [f.featureName, f]),
  );

  // Run each rule against the manifest
  const results: VerificationResult[] = [];
  // /api/feature-matrix POST is a FULL upsert — partial rows bind undefined
  // into required columns and the whole batch 500s. Merge each update from
  // the row we already fetched so existing category/description/filePaths/
  // qualityScore survive, and rows discovered by a rule get sane defaults.
  const updates: UpsertFeature[] = [];

  for (const rule of applicableRules) {
    const newStatus = rule.check(manifest);
    const existing = featureMap.get(rule.featureName);
    const previousStatus = existing?.status ?? null;

    results.push({
      featureName: rule.featureName,
      moduleId: rule.moduleId,
      previousStatus,
      newStatus,
      details: `Auto-verified from manifest (${manifest.assetCount} assets)`,
    });

    // Only push an update if the status actually changed
    if (newStatus !== previousStatus) {
      updates.push({
        featureName: rule.featureName,
        status: newStatus,
        category: existing?.category ?? 'general',
        description: existing?.description ?? '',
        filePaths: existing?.filePaths ?? [],
        qualityScore: existing?.qualityScore ?? null,
        nextSteps: existing?.nextSteps ?? '',
        reviewNotes: `Auto-verified from PoF Bridge manifest at ${new Date().toISOString()}`,
        lastReviewedAt: new Date().toISOString(),
      });
    }
  }

  // Batch-update changed features via the API
  if (updates.length > 0) {
    const writeResult = await tryApiFetch('/api/feature-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // source 'verify': these verdicts come from matching the live UE5 asset
      // manifest, not from a code review — the row must be able to say which.
      // projectId: the verdicts belong to the project whose UE5 manifest produced
      // them. Omitted (⇒ unattributed) when the caller had no project, never
      // guessed.
      body: JSON.stringify({ moduleId, features: updates, source: 'verify', projectId }),
    });

    // Only emit "changed" events when the write actually persisted. If it failed, the next
    // manifest poll recomputes the same diff and re-fires these events (event storm) while
    // the bus claims changes the DB never recorded — leave it for the retry instead.
    if (writeResult.ok) {
      for (const update of updates) {
        eventBus.emit(
          'checklist.item.changed',
          {
            moduleId,
            itemId: update.featureName,
            checked:
              update.status === 'implemented' || update.status === 'improved',
            source: 'auto-verify',
          },
          'verification-engine',
        );
      }
    } else {
      // Surface the failure instead of letting the banner claim success
      // while the DB still holds the old statuses.
      console.error('[verification-engine] feature-matrix write failed:', writeResult.error);
      for (const r of results) r.writeError = writeResult.error;
    }
  }

  return results;
}

/**
 * Get verification rules applicable to a specific module.
 */
export function getRulesForModule(
  moduleId: SubModuleId,
): VerificationRule[] {
  return VERIFICATION_RULES.filter((r) => r.moduleId === moduleId);
}
