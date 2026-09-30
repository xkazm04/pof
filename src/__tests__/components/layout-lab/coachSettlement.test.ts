// scan-sweep --challenge pipeline-acceptance-engine/B: the coach names the act that settles each
// step (stepSettlement.settlementOf), and the lab ladder names the same next step as the MCP loop.
// Display/pick logic only — no case here moves a status.
import { describe, it, expect, vi } from 'vitest';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// Deterministic derivation (same trick as matrixRows/globalCoach tests): each step's accept
// reads its verdict off the artifact data, so the lab builders run their real derivation.
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: (data.__tier as string) ?? 'L0', detail: '',
    ...(data.__reason ? { reason: data.__reason as string } : {}),
  }),
}));

import { pickNextActionableStep, type StepStatus } from '@/components/layout-lab/nextActionableStep';
import { drainableCount, unsettleable, ladderStatusOf } from '@/components/layout-lab/coachSettlement';
import { entityNextStep, type SettleVerdict } from '@/lib/catalog/stepSettlement';
import { buildMatrixRows } from '@/components/layout-lab/matrixRows';
import { buildCatalogCandidates } from '@/components/layout-lab/globalCoachModel';
import { ungradedResult } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { STATUS_GLOSSARY, plainEntitySummary } from '@/components/layout-lab/labGlossary';
import { summarizeEntity } from '@/lib/catalog/rollup';

const UNGRADED_VO = 'UNGRADED: content invariant "dialog-vo-line-length" is PoF law and is not law under canon profile "diablo1" — there is no threshold to grade this against yet (derive it from the reference).';
const SOURCED_SUB = 'SOURCED: seeded from Diablo I town dialog (row 7) — never produced.';
const DIALOG = ['VO Script', 'Subtitles & Choices UI', 'Test Gate'];
const dialogVerdicts: Record<string, SettleVerdict> = {
  'VO Script': { status: 'pending', tier: 'L0', reason: UNGRADED_VO },
  'Subtitles & Choices UI': { status: 'pending', tier: 'L0', reason: SOURCED_SUB },
  'Test Gate': { status: 'deferred', tier: 'L3' },
};
const verdictOf = (s: string) => dialogVerdicts[s] ?? null;
const statusOf = (s: string) => (verdictOf(s)?.status ?? 'unproduced') as StepStatus;

const entity = (id: string): LabEntity => ({ id, name: id.toUpperCase(), lifecycle: 'planned', data: {} });
function serverFor(entityId: string, verdicts: Record<string, SettleVerdict>): Map<string, Map<string, PipelineArtifact>> {
  const row = new Map<string, PipelineArtifact>();
  for (const [step, v] of Object.entries(verdicts)) {
    row.set(step, {
      catalogId: 'c', entityId, step, ueAssets: [], status: v.status as PipelineArtifact['status'],
      data: { __status: v.status, __tier: v.tier, ...(v.reason ? { __reason: v.reason } : {}) },
    } as PipelineArtifact);
  }
  return new Map([[entityId, row]]);
}

/** One pick for a single pending/deferred step carrying `v`. */
const pickOne = (v: SettleVerdict) => pickNextActionableStep(['S'], () => v.status as StepStatus, undefined, () => v);

describe('parity — the lab ladder and the MCP loop name the same next step', () => {
  it('skips the UNGRADED row in the per-entity coach, the MCP loop, the matrix and the global coach', () => {
    const lab = pickNextActionableStep(DIALOG, statusOf, undefined, verdictOf);
    const mcp = entityNextStep(DIALOG.map((label) => ({ label })), verdictOf);
    expect(lab?.step).toBe('Subtitles & Choices UI');
    expect(mcp?.step).toBe(lab?.step);

    const rows = buildMatrixRows('c', [entity('e1')], serverFor('e1', dialogVerdicts), {}, DIALOG);
    expect(rows[0].issue?.step).toBe('Subtitles & Choices UI');
    const cands = buildCatalogCandidates({
      catalogId: 'c', catalogLabel: 'C', steps: DIALOG, entities: [entity('e1')],
      serverByEntity: serverFor('e1', dialogVerdicts), localByEntity: {},
    });
    expect(cands[0]?.step).toBe('Subtitles & Choices UI');
  });
});

describe('coachActionFor — the act that settles the pick', () => {
  it('a declared reference gap reads "Fill gap" and names the field', () => {
    const next = pickOne({ status: 'pending', tier: 'L0', reason: 'field "stats" missing: moveSpeed (declared gap: moveSpeed — "not in the reference")' });
    expect(next?.settlement?.kind).toBe('fill-gap');
    expect(next?.actionWord).toBe('Fill gap');
    expect(next?.plainHint).toContain('moveSpeed');
    expect(next?.plainHint).not.toMatch(/still resolving/);
  });

  it('SOURCED reads "Produce" (seeded, never produced); TEMPLATE reads "Produce for this entity" naming the exemplar', () => {
    const sourced = pickOne({ status: 'pending', tier: 'L0', reason: SOURCED_SUB });
    expect(sourced?.actionWord).toBe('Produce');
    expect(sourced?.plainHint).toMatch(/seeded from a reference/i);
    expect(sourced?.plainHint).toMatch(/never produced/i);
    expect(sourced?.settlement?.tool).toBe('pof_get_step');

    const template = pickOne({ status: 'pending', tier: 'L0', reason: 'TEMPLATE: bestiary-melee-grunt template, not produced for this entity (zombie) — the step body does not read the entity.' });
    expect(template?.actionWord).toBe('Produce for this entity');
    expect(template?.plainHint).toContain('bestiary-melee-grunt');
    expect(template?.settlement?.tool).toBe('pof_get_step');
  });

  it('an L2 deferral jumps and names the settle passes (never drain); an L3 deferral drains', () => {
    const l2 = pickOne({ status: 'deferred', tier: 'L2' });
    expect(l2?.cta).toBe('jump');
    expect(l2?.plainHint).toMatch(/bind-icons.*verify-static.*verify-packaging/);
    expect(pickOne({ status: 'deferred', tier: 'L3' })?.cta).toBe('drain');
  });
});

describe('drainableCount — only what the live drain can settle', () => {
  it('counts L3/L4 and tierless deferrals, never an L2 one', () => {
    expect(drainableCount([
      { status: 'deferred', tier: 'L2' }, { status: 'deferred', tier: 'L3' },
      { status: 'deferred', tier: 'L4' }, { status: 'deferred' },
    ])).toBe(3);
  });
});

describe('honesty — naming the unsettleable row moves no status', () => {
  it('reports the UNGRADED row, and its display status stays pending', () => {
    expect(unsettleable(DIALOG, verdictOf)).toEqual(['VO Script']);
    const rows = buildMatrixRows('c', [entity('e1')], serverFor('e1', dialogVerdicts), {}, DIALOG);
    expect(rows[0].statusByStep('VO Script')).toBe('pending');
  });
});

describe('glossary + rollup — held rows are not "not started"', () => {
  it('pending no longer claims the step was never produced; the summary splits held from unstarted', () => {
    expect(STATUS_GLOSSARY.pending.plain).not.toContain('not been produced');
    expect(plainEntitySummary({ done: 1, total: 6, deferred: 0, pending: 5, unproduced: 2, failed: 0, highestTier: 'L0', configComplete: false }))
      .toBe('1 of 6 done · 3 held for authoring · 2 not started.');
    const art = (step: string, status: PipelineArtifact['status']) => ({ catalogId: 'c', entityId: 'e', step, data: {}, ueAssets: [], status, tier: 'L0' }) as PipelineArtifact;
    expect(summarizeEntity([art('A', 'pass'), art('B', 'pending'), art('C', 'pending'), art('D', 'pending')], 6))
      .toMatchObject({ pending: 5, unproduced: 2 });
  });
});

describe('[guard] no verdict known → today\'s picks', () => {
  it('without verdictOf the lab ladder still picks the first pending row', () => {
    expect(pickNextActionableStep(DIALOG, statusOf)?.step).toBe('VO Script');
    expect(pickNextActionableStep(DIALOG, statusOf)?.plainHint).toBe('This step is produced — its acceptance is still resolving.');
  });

  it('a lab-local thrown checker is still coached (it is a defect to fix, not an MCP-unsettleable row)', () => {
    const thrown = ungradedResult('Boom', new Error('data.rows.map is not a function'));
    expect(ladderStatusOf('fail', thrown)).toBe('fail');
  });
});
