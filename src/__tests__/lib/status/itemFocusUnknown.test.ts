/**
 * A FAILED READ IS NOT A GRADE — the entity-scoped half of /status (Category + Item Focus).
 *
 * The Pipelines tab already holds a catalog whose read failed out of its lanes as UNKNOWN; the
 * entity-scoped model under Category and Item Focus had no such state, so a failed artifact read
 * graded every entity R0 NOT WIRED / 0%, and a failed verdict read silently dropped a condemning
 * judge FAIL (the cell then read R3 reached — greener than the truth). These cases pin the
 * UNKNOWN node state the model now carries, in both directions the honest floor forbids.
 *
 * scan-sweep --challenge run challenge-2026-09-28b, card status-health-dashboard/A.
 */
import { describe, it, expect } from 'vitest';
import {
  buildDependencyIndex,
  buildCategoryNodes,
  resolveItemFocus,
  unknownRead,
  type ItemFocusCtx,
  type SwimlaneCtx,
} from '@/lib/status/itemFocusModel';
import { toStepSummary, summaryToVerdictRow } from '@/components/layout-lab/stepSummary';
import { stepContentHash } from '@/lib/judge/contentHash';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { HeadlessLookup, StepMeta } from '@/lib/status/statusModel';
import type { CatalogEntityBase } from '@/lib/catalog/types';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

function ent(catalogId: string, id: string, name: string, links: CatalogEntityBase['links'] = []): CatalogEntityBase {
  return { id, catalogId, name, categoryPath: [], tags: [], lifecycle: 'planned', links };
}

/** Every step is proven headless-operable, so an L3 pass may grade `verified` (R4). */
const OPERABLE: HeadlessLookup = (catalogId, step) => ({ catalogId, step, operable: true });

const STEPS: Record<string, StepMeta[]> = {
  items: [{ label: 'Concept Brief', archetype: 'brief', engine: 'Claude' }],
  icons: [{ label: 'Icon', engine: 'Leonardo' }],
};

const BRIEF = { brief: 'real produced content' };
const row = (entityId: string, over: Partial<PipelineArtifact> = {}): PipelineArtifact => ({
  catalogId: 'items', entityId, step: 'Concept Brief', data: BRIEF, ueAssets: [],
  status: 'pass', tier: 'L0', updatedAt: '2026-09-01T00:00:00Z', ...over,
});
const verdict = (entityId: string, v: Partial<JudgeVerdict>): JudgeVerdict => ({
  catalogId: 'items', entityId, step: 'Concept Brief', judge: 'llm-panel', model: 'm', findings: 'f',
  verdict: 'pass', score: 92, rubricVersion: RUBRIC_VERSION, contentHash: stepContentHash(BRIEF), ...v,
} as JudgeVerdict);

describe('buildCategoryNodes — a failed artifact read is UNKNOWN, never R0', () => {
  it('flags every node unknown with the reason, and grades none of them', () => {
    const entities = { items: { a: ent('items', 'a', 'Alpha'), b: ent('items', 'b', 'Beta') } };
    const ctx: SwimlaneCtx = {
      stepsFor: (c) => STEPS[c] ?? [],
      artifactsFor: () => unknownRead('HTTP 500'),
      verdictsFor: () => [],
      headless: OPERABLE,
    };
    const nodes = buildCategoryNodes('items', entities, ctx);
    expect(nodes).toHaveLength(2);
    for (const n of nodes) {
      expect(n.unknown).toBe(true);
      expect(n.unknownReason).toBe('HTTP 500');
      // No R0 lane, no 0% — a failure's empty list must never be graded.
      expect(n.swimlane).toBeNull();
    }
  });
});

describe('resolveItemFocus — an errored linked catalog is UNKNOWN; the focus still grades', () => {
  it("marks the 'icons' node unknown while the focus grades from its own rows", () => {
    const entities = {
      items: { sword: ent('items', 'sword', 'Sword', [{ catalogId: 'icons', entityId: 'i1', role: 'icon' }]) },
      icons: { i1: ent('icons', 'i1', 'Sword Icon') },
    };
    const ctx: ItemFocusCtx = {
      entitiesByCatalog: entities,
      index: buildDependencyIndex(entities),
      stepsFor: (c) => STEPS[c] ?? [],
      artifactsFor: (c) => (c === 'icons' ? unknownRead('HTTP 503') : [row('sword', { tier: 'L3' })]),
      verdictsFor: () => [],
      headless: OPERABLE,
    };
    const focus = resolveItemFocus('items', 'sword', ctx)!;
    const icon = focus.forward.find((n) => n.catalogId === 'icons')!;
    expect(icon.unknown).toBe(true);
    expect(icon.unknownReason).toBe('HTTP 503');
    expect(icon.swimlane).toBeNull();
    // The focus is untouched by its neighbour's failure: an L3 pass on an operable step is R4.
    expect(focus.focus.unknown).toBeUndefined();
    expect(focus.focus.swimlane!.readyPct).toBe(100);
  });
});

describe('[guard] blob-free summary rows grade identically to full rows', () => {
  it('a hash-bound current strict PASS verifies the cell on both inputs', () => {
    const entities = { items: { e1: ent('items', 'e1', 'E1') } };
    const full = [row('e1')];
    const thin = full.map((r) => summaryToVerdictRow('items', toStepSummary(r)));
    expect(thin[0]).not.toHaveProperty('data');
    const base = { stepsFor: (c: string) => STEPS[c] ?? [], verdictsFor: () => [verdict('e1', {})], headless: OPERABLE };
    const fromFull = buildCategoryNodes('items', entities, { ...base, artifactsFor: () => full })[0];
    const fromThin = buildCategoryNodes('items', entities, { ...base, artifactsFor: () => thin })[0];
    expect(fromFull.swimlane!.cells[0].grade).toBe('verified');
    expect(fromThin.swimlane!.cells[0].grade).toBe('verified');
    expect(fromThin.swimlane).toEqual(fromFull.swimlane);
  });
});

describe('a failed verdict read is flagged, never silently dropped', () => {
  const entities = {
    items: { e1: ent('items', 'e1', 'E1', [{ catalogId: 'icons', entityId: 'i1', role: 'icon' }]) },
    icons: { i1: ent('icons', 'i1', 'Icon One') },
  };
  // A checker pass the judge CONDEMNED on the very content on record.
  const condemning = [verdict('e1', { verdict: 'fail', score: 30 })];
  const known: ItemFocusCtx = {
    entitiesByCatalog: entities,
    index: buildDependencyIndex(entities),
    stepsFor: (c) => STEPS[c] ?? [],
    artifactsFor: (c) => (c === 'items' ? [row('e1')] : []),
    verdictsFor: (c) => (c === 'items' ? condemning : []),
    headless: OPERABLE,
  };
  const failed: ItemFocusCtx = { ...known, verdictsFor: () => unknownRead('500') };

  it('with the verdicts read, the condemned cell is blocked and carries no flag', () => {
    const n = buildCategoryNodes('items', entities, known)[0];
    expect(n.swimlane!.cells[0].grade).toBe('attention');
    expect(n.verdictsUnknown).toBeUndefined();
  });

  it('with the verdict read failed, every node says verdicts are unknown', () => {
    const cat = buildCategoryNodes('items', entities, failed);
    const focus = resolveItemFocus('items', 'e1', failed)!;
    for (const n of [...cat, focus.focus, ...focus.forward]) {
      expect(n.verdictsUnknown).toBe(true);
      expect(n.verdictsUnknownReason).toBe('500');
    }
    // The checker-only grade is still shown (as Pipelines does), but never without the flag.
    const cell = cat[0].swimlane!.cells[0];
    expect(cell.grade).not.toBe('attention');
    expect(cat[0].verdictsUnknown).toBe(true);
  });
});
