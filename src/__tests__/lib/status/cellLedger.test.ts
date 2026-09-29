/**
 * The entity ledger behind the /status evidence modal.
 *
 * A map cell is an aggregate over every entity of a step, but the modal used to open on
 * entity index 0 and pair the CELL-level verdict (picked across all entities) with that
 * entity's proof. The ledger derives each entity's own rung by running the map's SAME
 * `buildSwimlane` over one entity's rows + verdicts (what `scripts/personal-loop/truth.ts`
 * `readCell` does for the CLI), orders the entity holding the step down first, and keeps
 * verdict / findings / dimensions paired per entity.
 *
 * Honest floor: the ledger is DISPLAY-ONLY. It never feeds a grade (guard below).
 */
import { describe, it, expect, vi } from 'vitest';
import { cellLedger, evidenceFor } from '@/lib/status/cellLedger';
import { buildSwimlane, type StepMeta } from '@/lib/status/statusModel';
import { stepContentHash } from '@/lib/judge/contentHash';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { ok, err } from '@/types/result';
import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

// The audited fact for the fixture step: Claude-produced, judged by the LLM panel. Mocked so
// the fixture catalog `cat` resolves an audited engine + judge exactly like a real step.
vi.mock('@/lib/status/step-facts.json', () => ({
  default: {
    steps: [
      {
        catalogId: 'cat', step: 'Stats', trueEngine: 'Claude', deliverable: 'text',
        generatorWired: true, judge: 'llm-panel', checkerMeaningful: true, note: 'fixture',
      },
    ],
  },
}));

const STEP: StepMeta = { label: 'Stats', engine: 'Claude' };
const hashOf = (id: string) => stepContentHash({ stats: id });

const row = (entityId: string, status: ArtifactVerdictRow['status'], step = 'Stats'): ArtifactVerdictRow => ({
  catalogId: 'cat', entityId, step, status, tier: 'L0',
  updatedAt: '2026-09-01T00:00:00Z', contentHash: hashOf(entityId),
});

const verdict = (entityId: string, v: Partial<JudgeVerdict>): JudgeVerdict => ({
  catalogId: 'cat', entityId, step: 'Stats', judge: 'llm-panel', verdict: 'pass', score: 80,
  findings: 'f', model: 'sonnet-fixture', rubricVersion: RUBRIC_VERSION, contentHash: hashOf(entityId), ...v,
});

/** Fixture 1: every entity passes its checker; the judge condemns b's CURRENT content. */
const F1_ROWS = [row('a', 'pass'), row('b', 'pass'), row('c', 'pass'), row('a', 'pass', 'Other Step')];
const F1_VERDICTS = [verdict('b', { verdict: 'fail', score: 41, findings: 'canon clash', dimensions: { canon: 20 } })];

/** Fixture 2: one entity passes, two still pending, nothing judged. */
const F2_ROWS = [row('a', 'pass'), row('b', 'pending'), row('c', 'pending')];

const lane = (rows: ArtifactVerdictRow[], verdicts: JudgeVerdict[]) =>
  buildSwimlane('cat', 'cat', [STEP], rows, verdicts).cells[0];

describe('cellLedger — per-entity rungs, ordered by who holds the step down', () => {
  it('a judge-condemned entity decides the cell and sorts first; the others read R3 reached', () => {
    const ledger = cellLedger({ catalogId: 'cat', step: STEP, rows: F1_ROWS, verdicts: ok(F1_VERDICTS) });
    expect(ledger.rows.map((r) => r.entityId)).toEqual(['b', 'a', 'c']);
    expect(ledger.decides).toBe('b');
    const [b, a, c] = ledger.rows;
    expect(b.readiness.state).toBe('blocked');
    expect(b.verdict).toBe('judge-blocked');
    for (const r of [a, c]) {
      expect(r.readiness).toMatchObject({ level: 'R3', state: 'reached' });
      expect(r.verdict).toBe('none');
    }
  });

  it('with nothing judged, the lowest rung decides (entityId breaks the tie) and the summary counts rungs', () => {
    const ledger = cellLedger({ catalogId: 'cat', step: STEP, rows: F2_ROWS, verdicts: ok([]) });
    expect(ledger.distribution).toEqual({ R3: 1, R1: 2 });
    expect(ledger.decides).toBe('b');
    expect(ledger.rows.map((r) => r.entityId)).toEqual(['b', 'c', 'a']);
    expect(ledger.summary).toContain('1 of 3 entities at R3');
    expect(ledger.summary).toContain('2 at R1');
  });

  it('[guard] building the ledger never moves the cell grade (display-only)', () => {
    const before1 = lane(F1_ROWS, F1_VERDICTS).grade;
    const before2 = lane(F2_ROWS, []).grade;
    const rows1 = structuredClone(F1_ROWS);
    const verdicts1 = structuredClone(F1_VERDICTS);
    cellLedger({ catalogId: 'cat', step: STEP, rows: rows1, verdicts: ok(verdicts1) });
    cellLedger({ catalogId: 'cat', step: STEP, rows: F2_ROWS, verdicts: ok([]) });
    // Inputs untouched, and the map's grade is the same with or without the ledger.
    expect(rows1).toEqual(F1_ROWS);
    expect(verdicts1).toEqual(F1_VERDICTS);
    expect([before1, before2]).toEqual(['attention', 'trusted']);
    expect(lane(rows1, verdicts1).grade).toBe('attention');
    expect(lane(F2_ROWS, []).grade).toBe('trusted');
  });

  it('a failed verdict read is UNKNOWN on every row, never "no judgment"', () => {
    const ledger = cellLedger({ catalogId: 'cat', step: STEP, rows: F1_ROWS, verdicts: err('HTTP 500') });
    expect(ledger.rows).toHaveLength(3);
    for (const r of ledger.rows) {
      expect(r.verdict).toBe('unavailable');
      expect(r.cell.judged).toBeUndefined();
    }
    expect(ledger.rows.some((r) => r.verdict === 'judge-blocked' || r.verdict === 'judge-passed')).toBe(false);
    expect(ledger.verdictNote).toMatch(/judge verdicts could not be read/i);
    expect(ledger.verdictNote).toContain('HTTP 500');
    expect(ledger.verdictNote ?? '').not.toMatch(/no content-quality judgment/i);
  });

  it("evidenceFor pairs an entity's OWN verdict, score and dimensions — never another entity's", () => {
    const verdicts = [
      ...F1_VERDICTS,
      verdict('a', { verdict: 'pass', score: 93, findings: 'clean', dimensions: { canon: 95, craft: 91 } }),
    ];
    const ledger = cellLedger({ catalogId: 'cat', step: STEP, rows: F1_ROWS, verdicts: ok(verdicts) });
    const a = evidenceFor(ledger, 'a');
    expect(a?.judged).toMatchObject({ verdict: 'pass', score: 93, findings: 'clean' });
    expect(a?.dimensions).toEqual({ canon: 95, craft: 91 });
    expect(JSON.stringify(a)).not.toContain('canon clash');
    const b = evidenceFor(ledger, 'b');
    expect(b?.judged).toMatchObject({ verdict: 'fail', score: 41, findings: 'canon clash' });
    expect(b?.dimensions).toEqual({ canon: 20 });
    expect(evidenceFor(ledger, 'nobody')).toBeNull();
  });

  it('[guard] synthetic harness entities are excluded, matching the map', () => {
    const ledger = cellLedger({
      catalogId: 'cat', step: STEP,
      rows: [...F2_ROWS, row('test-headless-1', 'fail')],
      verdicts: ok([verdict('test-headless-1', { verdict: 'fail' })]),
    });
    expect(ledger.rows.map((r) => r.entityId)).not.toContain('test-headless-1');
    expect(ledger.rows).toHaveLength(3);
  });
});
