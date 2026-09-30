/**
 * Auto-Verify is a PREVIEW, then an explicit apply of the picks.
 *
 * Before: one click ran every path-substring rule against the UE asset manifest and
 * wrote every status that differed — review verdicts included — upserted a new
 * 'general' row for each rule naming a feature the graph does not declare (26 of
 * 41), and discarded the asset that justified each verdict.
 *
 * Now: `planVerification` is pure and returns each proposed flip with its evidence,
 * its kind, and whether it is picked by default (a review/fix verdict is never
 * lowered unasked); `applyVerification` writes only the picked, declared changes in
 * one scoped POST.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { planVerification, applyVerification } from '@/lib/pof-bridge/verification-engine';
import { VERIFICATION_RULES } from '@/lib/pof-bridge/verification-rules';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { AssetManifest, BlueprintEntry, VerificationRule } from '@/types/pof-bridge';
import type { FeatureRow, FeatureSource, FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

const CHARACTER = 'arpg-character' as SubModuleId;

function blueprint(path: string, parentCppClass = 'Character'): BlueprintEntry {
  return {
    path, parentCppClass, parentCppModule: 'Game', overriddenFunctions: [], addedComponents: [],
    variables: [], eventGraphEntryPoints: [], interfaces: [], crossReferences: [], contentHash: 'h',
  };
}

function manifest(blueprints: BlueprintEntry[] = []): AssetManifest {
  return {
    version: 1, generatedAt: '2026-09-30T00:00:00.000Z', projectName: 'PoF', engineVersion: '5.8',
    assetCount: blueprints.length, checksumSha256: 'c', blueprints, materials: [], animAssets: [],
    dataTables: [], otherAssets: [],
  };
}

function row(featureName: string, status: FeatureStatus, source: FeatureSource): FeatureRow {
  return {
    id: 1, moduleId: CHARACTER, featureName, category: 'Core', status, description: 'd', filePaths: [],
    reviewNotes: '', qualityScore: null, nextSteps: '', lastReviewedAt: null, source,
  };
}

const PLAYER_BP = '/Game/Chars/BP_PlayerCharacter';

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;
beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ success: true, data: { written: 1 } }),
    text: async () => JSON.stringify({ success: true, data: { written: 1 } }),
  }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

const posts = () => fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
const postBody = (i: number) => JSON.parse(String((posts()[i][1] as RequestInit).body));

describe('planVerification — pure preview with evidence', () => {
  it('proposes missing -> implemented for the player character and names the asset that proves it, with no fetch', () => {
    const plan = planVerification(
      manifest([blueprint(PLAYER_BP)]),
      CHARACTER,
      [row('AARPGPlayerCharacter', 'missing', 'review')],
    );
    expect(plan.changes).toContainEqual(expect.objectContaining({
      featureName: 'AARPGPlayerCharacter', from: 'missing', to: 'implemented', evidence: [PLAYER_BP],
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('every rule lands on a declared feature, the named re-targets exist, and re-targeting did not become deletion', () => {
    const orphans = VERIFICATION_RULES.filter(
      (r) => !(MODULE_FEATURE_DEFINITIONS[r.moduleId] ?? []).some((d) => d.featureName === r.featureName),
    ).map((r) => `${r.moduleId}::${r.featureName}`);
    expect(orphans).toEqual([]);

    const has = (moduleId: string, featureName: string) =>
      VERIFICATION_RULES.some((r) => r.moduleId === moduleId && r.featureName === featureName);
    expect(has('arpg-animation', 'Locomotion Blend Space')).toBe(true);
    expect(has('arpg-gas', 'Core Gameplay Effects')).toBe(true);
    expect(has('arpg-world', 'Zone layout design')).toBe(true);
    expect(VERIFICATION_RULES.some((r) => r.moduleId === 'level-design' && r.featureName === 'Zone layout design')).toBe(false);
    expect(VERIFICATION_RULES.length).toBeGreaterThanOrEqual(35);

    // One rule per feature: two rules for the same row would propose two verdicts.
    const keys = VERIFICATION_RULES.map((r) => `${r.moduleId}::${r.featureName}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('refuses a rule for an undeclared feature and applyVerification never writes it', async () => {
    const phantom: VerificationRule = {
      featureName: 'Not A Feature',
      moduleId: CHARACTER,
      check: () => ({ status: 'implemented', evidence: ['/Game/Anything'] }),
    };
    const player = VERIFICATION_RULES.find((r) => r.featureName === 'AARPGPlayerCharacter')!;
    const plan = planVerification(manifest([blueprint(PLAYER_BP)]), CHARACTER, [], [phantom, player]);

    expect(plan.refused).toContainEqual(expect.objectContaining({ featureName: 'Not A Feature', reason: 'undeclared' }));
    expect(plan.changes.map((c) => c.featureName)).not.toContain('Not A Feature');

    await applyVerification(plan, ['Not A Feature', 'AARPGPlayerCharacter'], 'C:/Proj');
    expect(posts()).toHaveLength(1);
    const names = (postBody(0).features as { featureName: string }[]).map((f) => f.featureName);
    expect(names).toEqual(['AARPGPlayerCharacter']);
  });

  it('a downgrade of a review or fix verdict starts unpicked; the same flip on a seed or verify row is picked', () => {
    const base = VERIFICATION_RULES.filter((r) => r.featureName === 'AARPGCharacterBase');
    const kindFor = (source: FeatureSource) => {
      const plan = planVerification(manifest(), CHARACTER, [row('AARPGCharacterBase', 'implemented', source)], base);
      return plan.changes.find((c) => c.featureName === 'AARPGCharacterBase')!;
    };
    for (const source of ['review', 'fix'] as const) {
      expect(kindFor(source)).toMatchObject({ from: 'implemented', to: 'missing', kind: 'downgrade', selectedByDefault: false });
    }
    for (const source of ['seed', 'verify'] as const) {
      expect(kindFor(source)).toMatchObject({ kind: 'downgrade', selectedByDefault: true });
    }
  });
});

describe('applyVerification — writes only the picks', () => {
  it('one POST holding only the selected feature, source verify, stamped with the project', async () => {
    const plan = planVerification(
      manifest([blueprint(PLAYER_BP)]),
      CHARACTER,
      [row('AARPGPlayerCharacter', 'missing', 'review'), row('AARPGCharacterBase', 'implemented', 'seed')],
      VERIFICATION_RULES.filter((r) => r.featureName === 'AARPGPlayerCharacter' || r.featureName === 'AARPGCharacterBase'),
    );
    // Two proposals: the player upgrade and the base-class downgrade.
    expect(plan.changes.map((c) => c.featureName).sort()).toEqual(['AARPGCharacterBase', 'AARPGPlayerCharacter']);

    const outcome = await applyVerification(plan, ['AARPGPlayerCharacter'], 'C:/Proj');

    expect(posts()).toHaveLength(1);
    const body = postBody(0);
    expect(body.source).toBe('verify');
    expect(body.projectId).toBe('C:/Proj');
    expect(body.features).toHaveLength(1);
    expect(body.features[0]).toMatchObject({ featureName: 'AARPGPlayerCharacter', status: 'implemented' });
    expect(outcome.written.map((c) => c.featureName)).toEqual(['AARPGPlayerCharacter']);
    expect(outcome.writeError).toBeUndefined();
  });

  it('nothing picked -> nothing written', async () => {
    const plan = planVerification(manifest([blueprint(PLAYER_BP)]), CHARACTER, []);
    const outcome = await applyVerification(plan, [], 'C:/Proj');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.written).toEqual([]);
  });
});
