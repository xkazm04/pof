import { describe, it, expect } from 'vitest';
import { buildSwimlane, type HeadlessLookup } from '@/lib/status/statusModel';
import { buildCapabilityRows } from '@/lib/status/capabilityModel';
import { toStepSummary, summaryToVerdictRow } from '@/components/layout-lab/stepSummary';
import { stepContentHash } from '@/lib/judge/contentHash';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { PipelineArtifact, ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * THE equivalence gate for "the status model takes the row's hash".
 *
 * The model used to bind every judge verdict to the content it judged by RE-hashing
 * `artifact.data`, which structurally required the whole produce blob: feeding it the
 * blob-free summary projection made a hash-bound CURRENT pass compare against the hash of
 * `{}` and read `stale` — a silent UNDERSTATEMENT (measured: `verified`/`current`/readyPct
 * 100 from full rows vs `trusted`/`stale`/readyPct 0 from the projection).
 *
 * The risk of the fix is the mirror image: a hash taken from the row must not make a STALE
 * verdict read as current, and a row that carries NO binding at all must degrade to
 * NOT-PROVEN — never to proven. So the gate here is EQUIVALENCE, not bytes: the same three
 * verdict provenances, graded from full rows and from the projection of those same rows,
 * must produce byte-identical lanes.
 */

/** Headless coverage is injectable so a `verified` grade is not gated away by the real
 *  audit JSON (which knows nothing about this fixture's catalog). */
const OPERABLE: HeadlessLookup = (catalogId, step) => ({ catalogId, step, operable: true });

const CATALOG = 'fixture-row-hash';

/** A step whose judge PASS is bound to exactly the content on record → `current`. */
const CURRENT_DATA = { brief: 'real produced content' };
/** A step whose judge FAIL judged content it no longer holds → `stale`. */
const STALE_NOW = { balance: 2 };
const STALE_THEN = { balance: 1 };
/** A step judged by a legacy verdict that records NO content binding → `unknown`. */
const LEGACY_DATA = { note: 'produced before the binding column existed' };

const rows: PipelineArtifact[] = [
  {
    catalogId: CATALOG, entityId: 'e1', step: 'Concept Brief',
    data: CURRENT_DATA, ueAssets: [], status: 'pass', tier: 'L0',
    updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    catalogId: CATALOG, entityId: 'e1', step: 'Balance Pass',
    data: STALE_NOW, ueAssets: [], status: 'pass', tier: 'L2',
    updatedAt: '2026-08-02T00:00:00Z',
  },
  {
    catalogId: CATALOG, entityId: 'e1', step: 'Legacy Note',
    data: LEGACY_DATA, ueAssets: [], status: 'pass', tier: 'L2',
    updatedAt: '2026-08-03T00:00:00Z',
  },
];

const verdict = (v: Partial<JudgeVerdict> & Pick<JudgeVerdict, 'step' | 'verdict' | 'score'>): JudgeVerdict => ({
  catalogId: CATALOG, entityId: 'e1', judge: 'human', model: 'fixture', findings: 'f',
  rubricVersion: RUBRIC_VERSION, ...v,
});

const verdicts: JudgeVerdict[] = [
  // CURRENT: bound to the content on record → elevates.
  verdict({ step: 'Concept Brief', verdict: 'pass', score: 95, contentHash: stepContentHash(CURRENT_DATA) }),
  // STALE: bound to content the step no longer holds → must NOT condemn.
  verdict({ step: 'Balance Pass', verdict: 'fail', score: 20, contentHash: stepContentHash(STALE_THEN) }),
  // UNHASHABLE legacy: no binding recorded, judged AFTER the last write so it cannot even be
  // dated as stale → `unknown`, which still condemns (a recorded fail is evidence).
  verdict({ step: 'Legacy Note', verdict: 'fail', score: 30, judgedAt: '2026-08-04T00:00:00Z' }),
];

const metas = rows.map((r) => ({ label: r.step }));

/** The projection /status reads: server-side `toStepSummary`, lifted back to a verdict row. */
const projected: ArtifactVerdictRow[] = rows.map((r) => summaryToVerdictRow(CATALOG, toStepSummary(r)));

describe('status model takes the row content hash — equivalence', () => {
  it('projects a hash that is the same one the full row would compute', () => {
    for (const r of rows) {
      expect(toStepSummary(r).contentHash).toBe(stepContentHash(r.data));
    }
    // …and the lift carries it onto the row the model grades, with no blob.
    expect(projected.map((p) => p.contentHash)).toEqual(rows.map((r) => stepContentHash(r.data)));
    expect(projected.every((p) => p.data === undefined)).toBe(true);
  });

  it('grades the blob-free projection IDENTICALLY to the full rows', () => {
    const full = buildSwimlane(CATALOG, CATALOG, metas, rows, verdicts, OPERABLE);
    const thin = buildSwimlane(CATALOG, CATALOG, metas, projected, verdicts, OPERABLE);
    expect(thin).toEqual(full);
  });

  it('pins the three provenances the fix must not move', () => {
    const lane = buildSwimlane(CATALOG, CATALOG, metas, projected, verdicts, OPERABLE);
    const cell = (label: string) => lane.cells.find((c) => c.label === label)!;

    // 1. hash-bound CURRENT pass → applied, and it elevates the cell.
    const current = cell('Concept Brief');
    expect(current.judgeAttribution?.provenance).toBe('current');
    expect(current.judgeAttribution?.applied).toBe(true);
    expect(current.grade).toBe('verified');

    // 2. STALE fail → reported, NOT applied, and the cell is not condemned.
    const stale = cell('Balance Pass');
    expect(stale.judgeAttribution?.provenance).toBe('stale');
    expect(stale.judgeAttribution?.applied).toBe(false);
    expect(stale.grade).not.toBe('attention');

    // 3. UNHASHABLE legacy fail → `unknown`, still condemning.
    const legacy = cell('Legacy Note');
    expect(legacy.judgeAttribution?.provenance).toBe('unknown');
    expect(legacy.judgeAttribution?.applied).toBe(true);
    expect(legacy.grade).toBe('attention');

    // The lane headline the whole dashboard is read by must match the full-row lane too.
    expect(lane.readyPct).toBe(buildSwimlane(CATALOG, CATALOG, metas, rows, verdicts, OPERABLE).readyPct);
  });

  it('degrades a row with NO binding to not-proven, never to proven', () => {
    // A reader that has neither the blob nor a hash cannot prove anything. The would-be
    // `current` PASS must stop elevating — the direction must not weaken the provenance work.
    const unbound: ArtifactVerdictRow[] = projected.map((r) => {
      const row = { ...r };
      delete row.contentHash;
      return row;
    });
    const lane = buildSwimlane(CATALOG, CATALOG, metas, unbound, verdicts, OPERABLE);
    const current = lane.cells.find((c) => c.label === 'Concept Brief')!;
    expect(current.judgeAttribution?.provenance).not.toBe('current');
    expect(current.judgeAttribution?.applied).toBe(false);
    expect(current.grade).not.toBe('verified');
    // …and the previously-stale FAIL now CONDEMNS rather than being silently retired:
    // unprovable must fall to the conservative side, not the optimistic one.
    expect(lane.cells.find((c) => c.label === 'Balance Pass')!.grade).toBe('attention');
  });

  it('binds capability evidence from the row hash too', () => {
    // capabilityModel drops a `stale` verdict from the capability median. Same rows, same
    // verdicts, blob or no blob → the same evidence set.
    const full = buildCapabilityRows(verdicts, rows, []);
    const thin = buildCapabilityRows(verdicts, projected, []);
    expect(thin).toEqual(full);
  });
});
