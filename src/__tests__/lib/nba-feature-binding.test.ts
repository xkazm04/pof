/**
 * The NBA card prints confident, numeric claims ("Unblocks 3 dependent
 * features") that are only as true as the item→feature binding they were
 * computed from. These tests pin that binding to the exact, integrity-tested
 * `CHECKLIST_FEATURE_MAP` instead of the first-word substring guess.
 *
 * Measured on the pre-change engine (216 checklist items, 37 modules):
 *   • 0 items are unmapped — the map covers the whole registry,
 *   • the guess AGREED with the map on 120 items,
 *   • it DISAGREED on 52, MISSED a real mapping on 15,
 *   • and bound 15 items the map explicitly declares un-evidenceable (`[]`).
 * i.e. 67 of 216 items (31%) were scored against the wrong feature row.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computeNBA } from '@/lib/nba-engine';
import {
  CHECKLIST_FEATURE_MAP, MODULE_FEATURE_DEFINITIONS, mappedFeaturesFor,
  resolveItemFeatures, HEURISTIC_MATCH_NOTE,
} from '@/lib/feature-definitions';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type { SubModuleId } from '@/types/modules';

beforeEach(() => {
  useModuleStore.setState({ checklistProgress: {}, moduleHistory: {}, moduleHealth: {} });
  usePatternLibraryStore.setState({ patterns: [] });
  useEvaluatorStore.setState({ lastScan: null });
});

function recFor(moduleId: SubModuleId, itemId: string) {
  const rec = computeNBA(moduleId).find((r) => r.item.id === itemId);
  expect(rec, `no recommendation for ${moduleId}/${itemId}`).toBeDefined();
  return rec!;
}

describe('NBA binds a checklist item to the feature it was actually told about', () => {
  it('scores as-5 "Implement auto-save" against Auto-save, not Save function', () => {
    const rec = recFor('arpg-save', 'as-5');
    // The map says `'as-5': ['Auto-save']`. Auto-save has ZERO dependents; the
    // first-word guess landed on `Save function` (fan-out 3) because "save" is a
    // substring of "implement auto-save" — worth a fabricated 18 + 12 points.
    expect(rec.featureMatch.source).toBe('mapped');
    expect([...rec.featureMatch.featureNames]).toEqual(['Auto-save']);
    expect(rec.featureMatch.dependentCount).toBe(0);
    expect(rec.breakdown.urgency).toBe(0);
    expect(rec.breakdown.impact).toBe(0);
    expect(rec.reason).not.toContain('Unblocks');
  });

  it('gives as-8 (mapped to []) no feature attribution and no unblock claim', () => {
    const rec = recFor('arpg-save', 'as-8');
    expect(rec.featureMatch.source).toBe('mapped');
    expect(rec.featureMatch.featureNames).toHaveLength(0);
    expect(rec.featureMatch.dependentCount).toBe(0);
    expect(rec.breakdown.urgency).toBe(0);
    expect(rec.breakdown.impact).toBe(0);
    expect(rec.reason).not.toContain('Unblocks');
    expect(rec.featureMatch.note).toMatch(/no feature row can evidence/i);
  });

  it('as-6 and as-7 stop borrowing Save function’s fan-out', () => {
    for (const id of ['as-6', 'as-7']) {
      const rec = recFor('arpg-save', id);
      expect([...rec.featureMatch.featureNames]).not.toContain('Save function');
      expect(rec.breakdown.impact).toBe(0);
    }
  });

  it('still credits as-3, the item that really does produce Save function', () => {
    const rec = recFor('arpg-save', 'as-3');
    expect([...rec.featureMatch.featureNames]).toEqual(['Save function']);
    expect(rec.featureMatch.dependentCount).toBe(3);
    expect(rec.breakdown.urgency).toBe(18); // min(3 * 6, 30)
    expect(rec.breakdown.impact).toBe(12);  // min(3 * 4, 20)
    expect(rec.reason).toContain('Unblocks 3 dependent features');
  });

  it('never scores a feature the map did not declare — across the whole registry', () => {
    const offenders: string[] = [];
    for (const moduleId of Object.keys(SUB_MODULE_MAP) as SubModuleId[]) {
      const mod = SUB_MODULE_MAP[moduleId as keyof typeof SUB_MODULE_MAP];
      if (!mod?.checklist?.length) continue;
      const recs = computeNBA(moduleId);
      for (const rec of recs) {
        const mapped = mappedFeaturesFor(moduleId, rec.item.id);
        if (!mapped) continue; // unmapped items are allowed to fall back
        for (const name of rec.featureMatch.featureNames) {
          if (!mapped.includes(name)) {
            offenders.push(`${moduleId}/${rec.item.id} scored "${name}" (mapped: ${mapped.join('|') || '[]'})`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('multi-feature items state their aggregation rule', () => {
  it('uses the MAX fan-out and says so when an item produces several features', () => {
    // ac-1 maps to six rows; summing their fan-outs would double-count shared
    // dependents, so the engine takes the most-depended-on one and names it.
    const rec = recFor('arpg-character', 'ac-1');
    expect(rec.featureMatch.featureNames.length).toBeGreaterThan(1);
    const counts = rec.featureMatch.featureNames.map((n) => {
      let c = 0;
      for (const feats of Object.values(MODULE_FEATURE_DEFINITIONS)) {
        for (const f of feats ?? []) {
          if ((f.dependsOn ?? []).some((d) => d === n || d === `arpg-character::${n}`)) c += 1;
        }
      }
      return c;
    });
    expect(rec.featureMatch.dependentCount).toBe(Math.max(...counts));
    if (rec.breakdown.urgency > 0) {
      expect(rec.reason).toContain(`most-depended-on of ${rec.featureMatch.featureNames.length} features`);
    }
  });
});

describe('resolveItemFeatures provenance tiers', () => {
  it('labels a fallback guess as a guess', () => {
    // Not an id the map knows, so tier 3 runs — and lands on "Save function"
    // exactly as the old engine did for as-5. The difference is that it says so.
    const res = resolveItemFeatures('arpg-save', { id: 'zz-unmapped', label: 'Implement auto-save' });
    expect(res.source).toBe('heuristic');
    expect([...res.names]).toEqual(['Save function']);
    expect(res.note).toContain(HEURISTIC_MATCH_NOTE);
  });

  it('resolves ChecklistItem.features and reports names that match no feature row', () => {
    const res = resolveItemFeatures('arpg-save', {
      id: 'zz-unmapped-2',
      label: 'nothing matches this label at all',
      features: ['Auto-save', 'not-a-real-feature'],
    });
    expect(res.source).toBe('declared');
    expect([...res.names]).toEqual(['Auto-save']);
    expect([...res.unresolved]).toEqual(['not-a-real-feature']);
  });

  it('an unresolvable declared name is never scored', () => {
    const res = resolveItemFeatures('arpg-save', {
      id: 'zz-unmapped-3',
      label: 'zzzz',
      features: ['not-a-real-feature'],
    });
    expect([...res.names]).toEqual([]);
    expect([...res.unresolved]).toEqual(['not-a-real-feature']);
  });

  it('reports nothing rather than guessing when no feature matches', () => {
    const res = resolveItemFeatures('arpg-save', { id: 'zz-unmapped-4', label: 'qqqqqqqq' });
    expect(res.source).toBe('none');
    expect([...res.names]).toEqual([]);
  });
});

describe('ChecklistItem.features / dependsOn are wired, not dead', () => {
  it('every item that declares `features` is also mapped, so no unresolvable slug can ever be scored', () => {
    // 11 declared names (all on arpg-enemy-ai ae-1..ae-8) are slugs that name no
    // row in MODULE_FEATURE_DEFINITIONS — dead data authored in
    // src/lib/module-registry.ts. They are unreachable ONLY because every one of
    // those items is also declared in CHECKLIST_FEATURE_MAP, which wins. This
    // test fails the moment that stops being true.
    const reachableUnresolved: string[] = [];
    let unresolvedNames = 0;
    for (const moduleId of Object.keys(SUB_MODULE_MAP) as SubModuleId[]) {
      const mod = SUB_MODULE_MAP[moduleId as keyof typeof SUB_MODULE_MAP];
      for (const item of mod?.checklist ?? []) {
        const res = resolveItemFeatures(moduleId, item);
        unresolvedNames += res.unresolved.length;
        if (res.unresolved.length > 0 && res.source !== 'mapped') {
          reachableUnresolved.push(`${moduleId}/${item.id}: ${res.unresolved.join(', ')}`);
        }
      }
    }
    expect(reachableUnresolved).toEqual([]);
    // Pinned so the known defect stays visible instead of quietly growing.
    expect(unresolvedNames).toBe(11);
  });

  it('an item whose sibling prerequisite is unchecked is not ready, and names it', () => {
    const rec = recFor('arpg-enemy-ai', 'ae-2'); // dependsOn: ['ae-1']
    expect(rec.breakdown.readiness).toBe(0);
    expect(rec.reason).toContain('Waiting on checklist item');
    expect(rec.reason).toContain('Create AIController subclass');
  });

  it('checking the prerequisite clears the wait', () => {
    useModuleStore.setState({ checklistProgress: { 'arpg-enemy-ai': { 'ae-1': true } } });
    const rec = recFor('arpg-enemy-ai', 'ae-2');
    expect(rec.reason).not.toContain('Waiting on checklist item');
  });
});

describe('map integrity', () => {
  it('every mapped name resolves to a real feature row (nothing dangles)', () => {
    const dangling: string[] = [];
    for (const [moduleId, byItem] of Object.entries(CHECKLIST_FEATURE_MAP)) {
      const known = new Set((MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? []).map((f) => f.featureName));
      for (const [itemId, names] of Object.entries(byItem ?? {})) {
        for (const n of names) if (!known.has(n)) dangling.push(`${moduleId}/${itemId}: ${n}`);
      }
    }
    expect(dangling).toEqual([]);
  });
});
