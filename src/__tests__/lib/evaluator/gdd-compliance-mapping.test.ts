import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/**
 * Pins the explicit checklist→feature mapping that replaced the 20-character
 * substring heuristic.
 *
 * Measured on the real DB the day this landed (2026-08-18): of the 216 registry
 * checklist items the audit can see, the heuristic matched 88 (40.7%) and could
 * only ever match ONE feature per item. The map covers 177 (81.9%), 140 resolve
 * to a scanned row, and 11 items span more than one feature. The remaining 39
 * belong to the nine Asset Studio modules, which declare no features at all —
 * they report UNMAPPED rather than being quietly matched to something else.
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
    expect(mappedFeaturesFor('asset-viewer', 'viewer-load')).toBeNull();
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

describe('an unmapped item is flagged, never silently substring-matched', () => {
  it('lists an item with no mapping and no fallback hit as invisible', () => {
    const mod = moduleOf(audit({}), 'asset-viewer');
    expect(mod.checklistMapping.mapped).toBe(0);
    expect(mod.checklistMapping.unmapped).toBe(mod.checklistMapping.itemsTotal);
    const item = mod.unmappedItems.find((u) => u.id === 'viewer-load');
    expect(item).toEqual({ id: 'viewer-load', label: 'Load 3D model', fallback: 'none' });
    expect(mod.gaps.some((g) => g.category === 'code-ahead' || g.category === 'checklist-vs-scan')).toBe(false);
  });

  it('keeps the substring heuristic only as a STATED fallback — the gap says it guessed', () => {
    const mod = moduleOf(
      audit({ 'asset-viewer': [row('asset-viewer', 'Load 3D model loader', 'implemented')] }),
      'asset-viewer',
    );
    const gap = mod.gaps.find((g) => g.id === 'gap-asset-viewer-ahead-viewer-load');
    expect(gap).toBeDefined();
    expect(gap!.matchSource).toBe('heuristic');
    expect(gap!.description).toContain('GUESSED');

    // …and the item is STILL reported as unmapped: a guess is not a mapping.
    expect(mod.checklistMapping.heuristic).toBe(1);
    expect(mod.checklistMapping.mapped).toBe(0);
    expect(mod.unmappedItems.find((u) => u.id === 'viewer-load')).toEqual({
      id: 'viewer-load', label: 'Load 3D model', fallback: 'heuristic', heuristicFeature: 'Load 3D model loader',
    });
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
    // The nine Asset Studio modules declare no features, so a real audit always
    // has unmapped items — the number is reported, not rounded away.
    expect(report.checklistMapping.unmapped).toBeGreaterThan(0);
    expect(report.checklistMapping.mapped + report.checklistMapping.heuristic + report.checklistMapping.unmapped)
      .toBe(report.checklistMapping.itemsTotal);
  });

  it('covers 177 of the 216 registry checklist items the audit can see', () => {
    // The stated coverage of this lot. If the registry grows, this number must be
    // re-derived rather than relaxed — that is the point of pinning it.
    const report = audit({});
    expect(report.checklistMapping.itemsTotal).toBe(216);
    expect(report.checklistMapping.mapped).toBe(177);
    expect(report.checklistMapping.unmapped).toBe(39);
  });
});
