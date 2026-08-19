import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/**
 * Pins the explicit checklist→feature mapping that replaced the 20-character
 * substring heuristic.
 *
 * Measured on the real DB the day this landed (2026-08-18): of the 216 registry
 * checklist items the audit can see, the heuristic matched 88 (40.7%) and could
 * only ever match ONE feature per item. The map first covered 177 (81.9%); the
 * remaining 39 belonged to the nine Asset Studio modules, which declared no
 * features at all. Those nine now declare their app-side feature surface, so
 * every one of the 216 items is explicitly mapped — 31 to named features and 8
 * to the deliberate `[]` ("nothing here can evidence this"), never to a guess.
 *
 * The heuristic fallback branch therefore has no live subject left in the real
 * registry; it is exercised against a forced-unmapped item in
 * `gdd-compliance-heuristic-fallback.test.ts`.
 *
 * The DB is mocked so the audit is a pure function of the fixtures; SUB_MODULES
 * and MODULE_FEATURE_DEFINITIONS (read-only references) supply the real data.
 */

const fixtures = vi.hoisted(() => ({ rows: {} as Record<string, FeatureRow[]> }));

vi.mock('@/lib/feature-matrix-db', () => ({
  getFeaturesByModule: (moduleId: string) => fixtures.rows[moduleId] ?? [],
}));

import { runComplianceAudit } from '@/lib/gdd-compliance';
import { CHECKLIST_FEATURE_MAP, MODULE_FEATURE_DEFINITIONS, mappedFeaturesFor } from '@/lib/feature-definitions';
import { SUB_MODULES } from '@/lib/module-registry';

let nextId = 1;
function row(moduleId: SubModuleId, featureName: string, status: FeatureStatus): FeatureRow {
  return {
    id: nextId++,
    moduleId,
    featureName,
    category: 'general',
    status,
    description: '',
    filePaths: [],
    reviewNotes: '',
    qualityScore: null,
    nextSteps: '',
    lastReviewedAt: null,
  };
}

function audit(rows: Record<string, FeatureRow[]>, checklist: Record<string, Record<string, boolean>> = {}) {
  fixtures.rows = rows;
  return runComplianceAudit(checklist);
}

const moduleOf = (report: ReturnType<typeof runComplianceAudit>, id: string) => {
  const m = report.modules.find((x) => x.moduleId === id);
  if (!m) throw new Error(`module ${id} absent from report`);
  return m;
};

/** The six features `ac-1` ("Character foundation package") is declared to cover. */
const AC1_FEATURES = [
  'AARPGCharacterBase', 'Enhanced Input actions', 'AARPGPlayerController',
  'AARPGPlayerCharacter', 'Isometric camera', 'WASD movement',
];

const characterRows = (status: FeatureStatus, over: Record<string, FeatureStatus> = {}) =>
  AC1_FEATURES.map((n) => row('arpg-character', n, over[n] ?? status));

beforeEach(() => {
  nextId = 1;
  fixtures.rows = {};
});

describe('CHECKLIST_FEATURE_MAP integrity', () => {
  it('names only features the module actually declares', () => {
    const offenders: string[] = [];
    for (const [moduleId, items] of Object.entries(CHECKLIST_FEATURE_MAP)) {
      const declared = new Set(
        (MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? []).map((f) => f.featureName),
      );
      for (const [itemId, names] of Object.entries(items ?? {})) {
        for (const name of names) {
          if (!declared.has(name)) offenders.push(`${moduleId}/${itemId} → "${name}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('maps only checklist item ids that exist in that module', () => {
    const checklists = new Map(
      SUB_MODULES.map((m) => [m.id as string, new Set((m.checklist ?? []).map((c) => c.id))]),
    );
    const offenders: string[] = [];
    for (const [moduleId, items] of Object.entries(CHECKLIST_FEATURE_MAP)) {
      const ids = checklists.get(moduleId);
      for (const itemId of Object.keys(items ?? {})) {
        if (!ids?.has(itemId)) offenders.push(`${moduleId}/${itemId}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is keyed by module because checklist ids are NOT globally unique', () => {
    // `ai-1` exists in both arpg-inventory and ai-behavior and means different
    // things in each; a flat item-id map would cross-wire the two modules.
    expect(mappedFeaturesFor('arpg-inventory', 'ai-1')).toEqual(['UARPGItemDefinition']);
    expect(mappedFeaturesFor('ai-behavior', 'ai-1')).toEqual(['AI Controller base']);
  });

  it('distinguishes "no feature can evidence this" from "not mapped yet"', () => {
    expect(mappedFeaturesFor('arpg-save', 'as-8')).toEqual([]); // "Test full save/load cycle"
    // `mat-ue5` was one of these until the Material Lab actually emitted a UE5
    // material instance — a deliberate `[]` is a hole to close, not a resting state.
    expect(mappedFeaturesFor('material-lab', 'mat-ue5')).toEqual(['UE5 material instance export']);
    // `null` is the third state and is reachable only for an id the map does not
    // list — every id the registry actually declares is now mapped.
    expect(mappedFeaturesFor('asset-viewer', 'viewer-does-not-exist')).toBeNull();
    expect(mappedFeaturesFor('game-design-doc', 'anything')).toBeNull();
  });
});

/**
 * The nine Asset Studio modules were the last unmapped surface. Their features
 * are app artifacts (a component, a store, a lib function, an API route), not
 * UE5 classes — so this table also pins that each module declares a feature set
 * at all, which is what lets the import route validate a scan row for it.
 */
describe('the nine Asset Studio modules are measurable', () => {
  const ASSET_STUDIO: { id: SubModuleId; items: number; mapped: number; empty: number }[] = [
    { id: 'asset-viewer', items: 6, mapped: 6, empty: 0 },
    { id: 'asset-forge', items: 5, mapped: 4, empty: 1 },
    { id: 'material-lab', items: 5, mapped: 5, empty: 0 },
    { id: 'blender-pipeline', items: 4, mapped: 4, empty: 0 },
    { id: 'asset-browser', items: 4, mapped: 3, empty: 1 },
    { id: 'import-automation', items: 4, mapped: 2, empty: 2 },
    { id: 'auto-rig', items: 4, mapped: 2, empty: 2 },
    { id: 'procedural-engine', items: 4, mapped: 4, empty: 0 },
    { id: 'scene-composer', items: 3, mapped: 2, empty: 1 },
  ];

  it.each(ASSET_STUDIO)('$id: $items items, $mapped evidenced, $empty deliberate []', (row) => {
    expect((MODULE_FEATURE_DEFINITIONS[row.id] ?? []).length).toBeGreaterThan(0);

    const mod = moduleOf(audit({}), row.id);
    expect(mod.checklistMapping.itemsTotal).toBe(row.items);
    expect(mod.checklistMapping.mapped).toBe(row.items);
    expect(mod.checklistMapping.unmapped).toBe(0);
    expect(mod.checklistMapping.heuristic).toBe(0);
    expect(mod.checklistMapping.noFeatureEvidence).toBe(row.empty);
    expect(mod.unmappedItems).toEqual([]);
  });

  it('accounts for all 39 of the formerly unmapped items', () => {
    const items = ASSET_STUDIO.reduce((s, r) => s + r.items, 0);
    expect(items).toBe(39);
    expect(ASSET_STUDIO.reduce((s, r) => s + r.mapped + r.empty, 0)).toBe(items);
  });

  it('names only things the app has — every declared feature is described', () => {
    for (const { id } of ASSET_STUDIO) {
      for (const f of MODULE_FEATURE_DEFINITIONS[id]!) {
        expect(f.featureName.trim()).toBeTruthy();
        expect(f.category.trim()).toBeTruthy();
        expect(f.description.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('a mapped item is graded against every feature it names', () => {
  it('raises a checklist-vs-scan gap naming the missing members, not the first row', () => {
    const report = audit(
      { 'arpg-character': characterRows('implemented', { 'Isometric camera': 'missing', 'WASD movement': 'missing' }) },
      { 'arpg-character': { 'ac-1': true } },
    );
    const gap = moduleOf(report, 'arpg-character').gaps.find((g) => g.id === 'gap-arpg-character-checklist-ac-1');
    expect(gap).toBeDefined();
    expect(gap!.matchSource).toBe('mapped');
    expect(gap!.matchedFeatures).toEqual(AC1_FEATURES);
    expect(gap!.description).toContain('Isometric camera');
    expect(gap!.description).toContain('WASD movement');
    expect(gap!.codeState).toBe('Scan: 2 of 6 features missing');
  });

  it('was invisible to the old heuristic — "Character foundation package" matched nothing', () => {
    const rows = characterRows('implemented');
    const label = 'Character foundation package'.toLowerCase();
    const heuristicHit = rows.find(
      (f) => f.featureName.toLowerCase().includes(label.slice(0, 20)) ||
             label.includes(f.featureName.toLowerCase().slice(0, 20)),
    );
    expect(heuristicHit).toBeUndefined();

    // The explicit mapping sees all six.
    const report = audit({ 'arpg-character': rows });
    const gap = moduleOf(report, 'arpg-character').gaps.find((g) => g.id === 'gap-arpg-character-ahead-ac-1');
    expect(gap?.matchedFeatures).toHaveLength(6);
  });

  it('only calls an unchecked item code-ahead when EVERY mapped feature is done', () => {
    const partial = audit({
      'arpg-character': characterRows('implemented', { 'WASD movement': 'partial' }),
    });
    expect(moduleOf(partial, 'arpg-character').gaps.some((g) => g.id === 'gap-arpg-character-ahead-ac-1')).toBe(false);

    const complete = audit({ 'arpg-character': characterRows('implemented', { 'Isometric camera': 'improved' }) });
    expect(moduleOf(complete, 'arpg-character').gaps.some((g) => g.id === 'gap-arpg-character-ahead-ac-1')).toBe(true);
  });

  it('counts the multi-feature items in the module mapping stats', () => {
    const mod = moduleOf(audit({ 'arpg-character': characterRows('implemented') }), 'arpg-character');
    expect(mod.checklistMapping.mapped).toBe(6);
    expect(mod.checklistMapping.unmapped).toBe(0);
    expect(mod.checklistMapping.heuristic).toBe(0);
    expect(mod.checklistMapping.multiFeature).toBeGreaterThanOrEqual(1);
    expect(mod.checklistMapping.noFeatureEvidence).toBe(1); // ac-6, a runtime check
    expect(mod.unmappedItems).toEqual([]);
  });

  it('reports a mapped name the scan has never heard of, without inventing a gap', () => {
    // Only three of the six declared rows exist in this scan.
    const mod = moduleOf(
      audit({ 'arpg-character': AC1_FEATURES.slice(0, 3).map((n) => row('arpg-character', n, 'implemented')) }),
      'arpg-character',
    );
    expect(mod.checklistMapping.danglingMappings).toBeGreaterThan(0);
    expect(mod.gaps.some((g) => g.category === 'checklist-vs-scan')).toBe(false);
  });

  it('does not report dangling names for a module nobody scanned', () => {
    const mod = moduleOf(audit({}), 'arpg-character');
    expect(mod.checklistMapping.danglingMappings).toBe(0);
    expect(mod.gaps.some((g) => g.category === 'unmeasured')).toBe(true);
  });
});

describe('a mapped item is never downgraded to a guess', () => {
  it('grades an Asset Studio item against its declared feature, not a substring hit', () => {
    // "Load 3D model" is declared to be evidenced by 'Model file loader' +
    // 'SceneViewer canvas'. A row whose NAME merely looks like the label must
    // not become the evidence — the mapping decides, and it reports the two
    // declared names as missing from this scan.
    const mod = moduleOf(
      audit({ 'asset-viewer': [row('asset-viewer', 'Load 3D model loader', 'implemented')] }),
      'asset-viewer',
    );
    expect(mod.checklistMapping.heuristic).toBe(0);
    expect(mod.checklistMapping.mapped).toBe(mod.checklistMapping.itemsTotal);
    expect(mod.unmappedItems).toEqual([]);
    expect(mod.checklistMapping.danglingMappings).toBeGreaterThan(0);
    expect(mod.gaps.some((g) => g.matchSource === 'heuristic')).toBe(false);
  });

  it('reports a real scan of a declared Asset Studio feature as code-ahead', () => {
    const mod = moduleOf(
      audit({
        'asset-viewer': [
          row('asset-viewer', 'Orbit controls', 'implemented'),
          row('asset-viewer', 'Grid and axis gizmo', 'implemented'),
        ],
      }),
      'asset-viewer',
    );
    const gap = mod.gaps.find((g) => g.id === 'gap-asset-viewer-ahead-viewer-orbit');
    expect(gap).toBeDefined();
    expect(gap!.matchSource).toBe('mapped');
    expect(gap!.matchedFeatures).toEqual(['Orbit controls']);
  });
});

describe('the report states how much of the checklist surface it can see', () => {
  it('rolls the per-module mapping up to the project scope', () => {
    const report = audit({ 'arpg-character': characterRows('implemented') });
    const sum = report.modules.reduce((s, m) => s + m.checklistMapping.itemsTotal, 0);
    expect(report.checklistMapping.itemsTotal).toBe(sum);
    expect(report.checklistMapping.mapped).toBe(
      report.modules.reduce((s, m) => s + m.checklistMapping.mapped, 0),
    );
    // Every registry item is now explicitly mapped, so a real audit reports no
    // unmapped surface at all — and the three buckets still partition the total.
    expect(report.checklistMapping.unmapped).toBe(0);
    expect(report.checklistMapping.heuristic).toBe(0);
    expect(report.checklistMapping.mapped + report.checklistMapping.heuristic + report.checklistMapping.unmapped)
      .toBe(report.checklistMapping.itemsTotal);
  });

  it('covers all 216 registry checklist items the audit can see', () => {
    // The stated coverage of this lot. If the registry grows, these numbers must
    // be re-derived rather than relaxed — that is the point of pinning them.
    // 216 mapped = 177 from the UE5 modules + 39 from the nine Asset Studio ones.
    const report = audit({});
    expect(report.checklistMapping.itemsTotal).toBe(216);
    expect(report.checklistMapping.mapped).toBe(216);
    expect(report.checklistMapping.unmapped).toBe(0);
  });

  it('says how many of the 216 are the honest "nothing can evidence this" state', () => {
    // Mapped is not the same as evidenced: 29 items are declared `[]` on
    // purpose — 21 verification/tuning items in the UE5 modules plus the 8
    // remaining Asset Studio gaps (`mat-ue5` left the list once the Material
    // Lab actually emitted a UE5 material instance). The number is surfaced so a 100% mapping cannot be
    // read as 100% coverage.
    const report = audit({});
    expect(report.checklistMapping.noFeatureEvidence).toBe(29);
    expect(report.checklistMapping.mapped - report.checklistMapping.noFeatureEvidence).toBe(187);
  });
});
