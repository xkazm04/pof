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
import type { FeatureStatus } from '@/types/feature-matrix';

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

/**
 * Run verification for a specific module and update the Feature Matrix DB
 * via the API. Compares against current feature statuses and only updates
 * rows whose status actually changed.
 *
 * Emits `checklist.item.changed` events for each changed feature.
 */
export async function autoUpdateFeatureMatrix(
  manifest: AssetManifest,
  moduleId: SubModuleId,
  rules?: VerificationRule[],
): Promise<VerificationResult[]> {
  const applicableRules = (rules ?? VERIFICATION_RULES).filter(
    (r) => r.moduleId === moduleId,
  );
  if (applicableRules.length === 0) return [];

  // Fetch current feature matrix state for this module
  const currentResult = await tryApiFetch<{
    features: FeatureRow[];
  }>(`/api/feature-matrix?moduleId=${encodeURIComponent(moduleId)}`);

  const currentFeatures = currentResult.ok ? currentResult.data.features : [];
  const featureMap = new Map(
    currentFeatures.map((f) => [f.featureName, f]),
  );

  // Run each rule against the manifest
  const results: VerificationResult[] = [];
  const updates: {
    featureName: string;
    status: FeatureStatus;
    reviewNotes: string;
  }[] = [];

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
        reviewNotes: `Auto-verified from PoF Bridge manifest at ${new Date().toISOString()}`,
      });
    }
  }

  // Batch-update changed features via the API
  if (updates.length > 0) {
    await tryApiFetch('/api/feature-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, features: updates }),
    });

    // Emit bus events for each status change
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
