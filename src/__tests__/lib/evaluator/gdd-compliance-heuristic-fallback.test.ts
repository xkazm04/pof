import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/**
 * Guards the audit's LAST-RESORT branch: an item with no explicit mapping.
 *
 * Every one of the 216 registry checklist items is now mapped (the nine Asset
 * Studio modules were the last holdout — see the sibling
 * `gdd-compliance-mapping.test.ts`), so the fallback has no live subject in the
 * real registry. That is a good state, not a reason to drop the coverage: a new
 * module added tomorrow lands here on day one, and the contract must hold —
 *
 *   • the substring guess is LABELLED `heuristic`, never `mapped`;
 *   • the gap text says it GUESSED;
 *   • the item is still counted and listed as unmapped — a guess is not a
 *     mapping;
 *   • with no guess available the item is invisible rather than silently passed.
 *
 * `mappedFeaturesFor` is stubbed for one (module, item) pair so the branch is
 * reached without pretending the real map has a hole.
 */

const fixtures = vi.hoisted(() => ({
  rows: {} as Record<string, FeatureRow[]>,
  /** "moduleId/itemId" pairs forced to report as unmapped. */
  forcedUnmapped: new Set<string>(),
}));

vi.mock('@/lib/feature-matrix-db', () => ({
  getFeaturesByModule: (moduleId: string) => fixtures.rows[moduleId] ?? [],
}));

vi.mock('@/lib/feature-definitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-definitions')>();
  return {
    ...actual,
    mappedFeaturesFor: (moduleId: SubModuleId, itemId: string) =>
      fixtures.forcedUnmapped.has(`${moduleId}/${itemId}`)
        ? null
        : actual.mappedFeaturesFor(moduleId, itemId),
  };
});

import { runComplianceAudit } from '@/lib/gdd-compliance';

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

function moduleOf(rows: Record<string, FeatureRow[]>, id: string) {
  fixtures.rows = rows;
  const m = runComplianceAudit({}).modules.find((x) => x.moduleId === id);
  if (!m) throw new Error(`module ${id} absent from report`);
  return m;
}

beforeEach(() => {
  nextId = 1;
  fixtures.rows = {};
  fixtures.forcedUnmapped = new Set(['asset-viewer/viewer-load']);
});

describe('an unmapped item is flagged, never silently substring-matched', () => {
  it('lists an item with no mapping and no fallback hit as invisible', () => {
    const mod = moduleOf({}, 'asset-viewer');
    expect(mod.checklistMapping.unmapped).toBe(1);
    expect(mod.unmappedItems).toEqual([
      { id: 'viewer-load', label: 'Load 3D model', fallback: 'none' },
    ]);
    // No gap is invented for it in either direction.
    expect(mod.gaps.some((g) => g.id === 'gap-asset-viewer-ahead-viewer-load')).toBe(false);
    expect(mod.gaps.some((g) => g.id === 'gap-asset-viewer-checklist-viewer-load')).toBe(false);
  });

  it('keeps the substring heuristic only as a STATED fallback — the gap says it guessed', () => {
    const mod = moduleOf(
      { 'asset-viewer': [row('asset-viewer', 'Load 3D model loader', 'implemented')] },
      'asset-viewer',
    );
    const gap = mod.gaps.find((g) => g.id === 'gap-asset-viewer-ahead-viewer-load');
    expect(gap).toBeDefined();
    expect(gap!.matchSource).toBe('heuristic');
    expect(gap!.description).toContain('GUESSED');

    // …and the item is STILL reported as unmapped: a guess is not a mapping.
    expect(mod.checklistMapping.heuristic).toBe(1);
    expect(mod.checklistMapping.unmapped).toBe(0);
    expect(mod.unmappedItems).toEqual([
      {
        id: 'viewer-load',
        label: 'Load 3D model',
        fallback: 'heuristic',
        heuristicFeature: 'Load 3D model loader',
      },
    ]);
  });

  it('leaves the module’s other items on their real declared mapping', () => {
    const mod = moduleOf(
      { 'asset-viewer': [row('asset-viewer', 'Orbit controls', 'implemented')] },
      'asset-viewer',
    );
    // 6 items: 5 still mapped explicitly, 1 forced unmapped for this test.
    expect(mod.checklistMapping.itemsTotal).toBe(6);
    expect(mod.checklistMapping.mapped).toBe(5);
    const orbit = mod.gaps.find((g) => g.id === 'gap-asset-viewer-ahead-viewer-orbit');
    expect(orbit?.matchSource).toBe('mapped');
  });
});
