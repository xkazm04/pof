import { describe, it, expect } from 'vitest';
import { buildCapabilityRows, capabilityClassOf, type CapabilityBenchmarkRow } from '@/lib/status/capabilityModel';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { stepContentHash } from '@/lib/judge/contentHash';

/** Instance-path builder: no benchmark overlay, so these assert PURE project-instance grading
 *  independent of the real capability-benchmarks.json. The benchmark overlay is covered in its
 *  own describe block below (passing explicit rows). */
function build(verdicts: JudgeVerdict[], artifacts: PipelineArtifact[] = []): ReturnType<typeof buildCapabilityRows> {
  return buildCapabilityRows(verdicts, artifacts, []);
}

/** llm-panel verdict (rubric 3 by default so it counts). */
function v(catalogId: string, entityId: string, step: string, score: number, extra: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    catalogId,
    entityId,
    step,
    judge: 'llm-panel',
    verdict: score >= 90 ? 'pass' : 'fail',
    score,
    findings: '',
    model: 'sonnet-fleet',
    rubricVersion: 3,
    ...extra,
  };
}

/** Qwen-VL verdict — NOT rubric-gated (predates the rubric column). */
function vlm(catalogId: string, entityId: string, step: string, score: number, extra: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return { catalogId, entityId, step, judge: 'vlm', verdict: score >= 70 ? 'pass' : 'fail', score, findings: '', model: 'qwen3-vl-4b', ...extra };
}

/** L3/L4 gate artifact for the gate-judged classes. */
function art(catalogId: string, entityId: string, step: string, status: PipelineArtifact['status'], tier: PipelineArtifact['tier'] = 'L3'): PipelineArtifact {
  return { catalogId, entityId, step, data: {}, ueAssets: [], status, tier };
}

/** Fetch one class row by id. */
function row(rows: ReturnType<typeof buildCapabilityRows>, klass: string) {
  const r = rows.find((x) => x.klass === klass);
  if (!r) throw new Error(`no row for ${klass}`);
  return r;
}

// `items/Icon 2D Art` is deliverable 2d-art + judge VLM with NO ceiling → the clean class for
// exercising the numeric ladder (via vlm verdicts, its audited stream). `items/Concept Brief`
// is text-config + llm-panel WITH a documented technique wall. `achievements/Test Gate` is
// ue-runtime + ue-test (a gate-judged class).
const ICON = 'Icon 2D Art';
const GATE_STEP = 'Test Gate';

describe('capabilityClassOf', () => {
  it('reuses the judge text/2D split (ui-glyph) and passes non-rubric deliverables through', () => {
    expect(capabilityClassOf('2d-art', 'items')).toBe('2d-art');
    expect(capabilityClassOf('2d-art', 'hud-elements')).toBe('ui-glyph'); // UI_GLYPH_CATALOGS
    expect(capabilityClassOf('text-config')).toBe('text-config');
    expect(capabilityClassOf('ue-runtime')).toBe('ue-runtime');
    expect(capabilityClassOf('vfx-particles')).toBe('vfx-particles');
  });
});

describe('vlm-stream aggregation (2d-art)', () => {
  it('pools vlm verdicts by class and takes the median of included scores', () => {
    const rows = build([vlm('items', 'e1', ICON, 80), vlm('items', 'e2', ICON, 90), vlm('items', 'e3', ICON, 70)]);
    const r = row(rows, '2d-art');
    expect(r.n).toBe(3);
    expect(r.median).toBe(80); // sorted 70,80,90 → 80
    expect(r.stream).toBe('vlm');
  });

  it('normalizes a legacy 0-10 vlm score (stored raw) onto the 0-100 axis', () => {
    // A legacy 8/10 stored as 8 must count as 80, not 8, so it does not tank the median.
    const rows = build([vlm('items', 'e1', ICON, 8), vlm('items', 'e2', ICON, 80)]);
    expect(row(rows, '2d-art').median).toBe(80); // (80 + 80) / 2, not (8 + 80)/2
  });

  it('an llm-panel verdict on a vlm-judged step does NOT count (cell scored by its own judge)', () => {
    const rows = build([v('items', 'e1', ICON, 95)]);
    expect(row(rows, '2d-art').n).toBe(0);
  });
});

describe('mixed-stream class (text-config: llm-panel + vlm cells)', () => {
  it('aggregates each cell by its own step judge and labels the stream mixed', () => {
    const rows = build([
      v('achievements', 'e1', 'Concept Brief', 80), // text-config, llm-panel
      vlm('character-pipeline', 'e2', 'Face Gate 2D', 80), // text-config, vlm
    ]);
    const r = row(rows, 'text-config');
    expect(r.n).toBe(2);
    expect(r.stream).toBe('mixed');
  });
});

describe('score-ladder edges (vlm on 2d-art — no technique wall)', () => {
  it('even count → rounded mean of the two middles', () => {
    expect(row(build([vlm('items', 'e1', ICON, 80), vlm('items', 'e2', ICON, 90)]), '2d-art').median).toBe(85);
  });

  it('proven: median ≥90 with n≥3', () => {
    const rows = build([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 92), vlm('items', 'c', ICON, 94)]);
    expect(row(rows, '2d-art').grade).toBe('proven');
  });

  it('90 boundary is proven; 89 boundary is strong', () => {
    const at90 = build([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 90), vlm('items', 'c', ICON, 90)]);
    expect(row(at90, '2d-art').grade).toBe('proven');
    const at89 = build([vlm('items', 'a', ICON, 89), vlm('items', 'b', ICON, 89), vlm('items', 'c', ICON, 89)]);
    expect(row(at89, '2d-art').grade).toBe('strong');
  });

  it('median ≥90 but n<3 → strong (insufficient evidence to certify proven)', () => {
    expect(row(build([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 92)]), '2d-art').grade).toBe('strong');
  });

  it('85 boundary → strong; below 85 with evidence → capped', () => {
    expect(row(build([vlm('items', 'a', ICON, 85), vlm('items', 'b', ICON, 85)]), '2d-art').grade).toBe('strong');
    expect(row(build([vlm('items', 'a', ICON, 84), vlm('items', 'b', ICON, 80)]), '2d-art').grade).toBe('capped');
  });

  it('a documented technique wall caps the class even at a high median (conservative)', () => {
    // text-config carries technique ceilings (items Concept Brief etc.) → capped, not proven.
    const rows = build([
      v('items', 'e1', 'Concept Brief', 92),
      v('items', 'e2', 'Concept Brief', 94),
      v('items', 'e3', 'Concept Brief', 96),
    ]);
    const r = row(rows, 'text-config');
    expect(r.cappedByTechnique).toBe(true);
    expect(r.grade).toBe('capped');
  });
});

describe('gate-judged classes (ue-runtime — L3/L4 pass-rate ladder)', () => {
  function gates(pass: number, deferred: number): PipelineArtifact[] {
    const out: PipelineArtifact[] = [];
    for (let i = 0; i < pass; i += 1) out.push(art('achievements', `p${i}`, GATE_STEP, 'pass'));
    for (let i = 0; i < deferred; i += 1) out.push(art('achievements', `d${i}`, GATE_STEP, 'deferred'));
    return out;
  }

  it('no declared gates → unproven, N/M is 0/0', () => {
    const r = row(build([]), 'ue-runtime');
    expect(r.grade).toBe('unproven');
    expect(r.stream).toBe('gates');
    expect(r.gatesDeclared).toBe(0);
    expect(r.median).toBeNull();
  });

  it('proven: rate ≥0.9 AND passed ≥10 (18 pass, 2 deferred = 0.9)', () => {
    const r = row(build([], gates(18, 2)), 'ue-runtime');
    expect(r.gatesPassed).toBe(18);
    expect(r.gatesDeclared).toBe(20);
    expect(r.grade).toBe('proven');
  });

  it('0.9 rate but passed <10 → strong (count floor blocks proven)', () => {
    // 9 pass + 1 deferred = 0.9 rate, but only 9 passed → strong, not proven.
    expect(row(build([], gates(9, 1)), 'ue-runtime').grade).toBe('strong');
  });

  it('0.7 boundary → strong (7 pass, 3 deferred); below 0.7 → capped (6 pass, 3 deferred)', () => {
    expect(row(build([], gates(7, 3)), 'ue-runtime').grade).toBe('strong');
    expect(row(build([], gates(6, 3)), 'ue-runtime').grade).toBe('capped');
  });

  it('passed <5 → capped even at 100% rate (strong count floor)', () => {
    expect(row(build([], gates(4, 0)), 'ue-runtime').grade).toBe('capped');
  });

  it('a failing gate counts as declared-not-passed and lowers the rate', () => {
    const arts = [...gates(6, 0), art('achievements', 'f0', GATE_STEP, 'fail')];
    const r = row(build([], arts), 'ue-runtime');
    expect(r.gatesPassed).toBe(6);
    expect(r.gatesDeclared).toBe(7); // 6 pass + 1 fail
    expect(r.grade).toBe('strong'); // 6/7 ≈ 0.857 ≥0.7, passed 6 ≥5
  });
});

describe('human / none classes', () => {
  it('audio stays unproven with no human verdicts, graded when human review exists', () => {
    const none = build([]);
    expect(row(none, 'audio').grade).toBe('unproven');
    expect(row(none, 'audio').stream).toBe('none');

    const judged = build([
      { catalogId: 'codex', entityId: 'e1', step: 'Audio Sting', judge: 'human', verdict: 'pass', score: 90, findings: '', model: 'human' },
    ]);
    const r = row(judged, 'audio');
    expect(r.stream).toBe('human');
    expect(r.grade).not.toBe('unproven');
  });

  it('vfx-particles (judge none) is always unproven', () => {
    expect(row(build([]), 'vfx-particles').grade).toBe('unproven');
  });
});

describe('exclusion honors ceiling-facts', () => {
  it('checker-structural / project-data cells are excluded from the median and counted separately', () => {
    const rows = build([
      v('items', 'e1', 'Economy', 62), // checker-structural (all entities) → excluded
      v('items', 'e2', 'Concept Brief', 80), // included
    ]);
    const r = row(rows, 'text-config');
    expect(r.excluded).toBeGreaterThanOrEqual(1);
    expect(r.n).toBe(1); // only Concept Brief counted
    expect(r.median).toBe(80);
  });

  it('entity-scoped project-data excludes only the named entity', () => {
    const rows = build([
      v('items', 'item-lightsaber', 'Tooltip / Compare', 60), // project-data (this entity) → excluded
      v('items', 'other-item', 'Tooltip / Compare', 88), // NOT excluded
    ]);
    const r = row(rows, 'text-config');
    expect(r.excluded).toBe(1);
    expect(r.n).toBe(1);
    expect(r.median).toBe(88);
  });
});

describe('filters and invariants', () => {
  it('skips synthetic entities', () => {
    const rows = build([vlm('items', 'test-headless-mcp', ICON, 95), vlm('items', 'item-mcp-smoke', ICON, 95)]);
    expect(row(rows, '2d-art').n).toBe(0);
  });

  it('ignores stale (rubric<3) llm-panel verdicts but keeps un-rubriced vlm', () => {
    const rows = build([
      vlm('items', 'e1', ICON, 95), // vlm, no rubric → counts
      v('achievements', 'e2', 'Concept Brief', 95, { rubricVersion: 2 }), // stale panel → dropped
    ]);
    expect(row(rows, '2d-art').n).toBe(1);
    expect(row(rows, 'text-config').n).toBe(0);
  });

  it('keeps the latest verdict per (catalog|entity|step)', () => {
    const rows = build([
      vlm('items', 'e1', ICON, 40, { judgedAt: '2026-07-01' }),
      vlm('items', 'e1', ICON, 90, { judgedAt: '2026-07-16' }),
    ]);
    const r = row(rows, '2d-art');
    expect(r.n).toBe(1);
    expect(r.median).toBe(90);
  });

  it('provenance is the derived-from-project-instances constant on every row', () => {
    const rows = build([vlm('items', 'e1', ICON, 90)]);
    expect(rows.every((r) => r.provenance === 'derived-from-project-instances')).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('rows sort proven → strong → capped → unproven', () => {
    const rows = build([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 92), vlm('items', 'c', ICON, 94)]);
    const ranks = { proven: 0, strong: 1, capped: 2, unproven: 3 } as const;
    for (let i = 1; i < rows.length; i += 1) {
      expect(ranks[rows[i - 1].grade]).toBeLessThanOrEqual(ranks[rows[i].grade]);
    }
  });
});

describe('neutral-benchmark overlay (Phase 2)', () => {
  const bench = (rows: CapabilityBenchmarkRow[]) => rows;
  const scored = (klass: string, briefId: string, score: number): CapabilityBenchmarkRow =>
    ({ class: klass, briefId, score, engine: 'Claude', model: 'sonnet', effort: 'medium' });

  it('a scored benchmark DRIVES the grade and flips provenance to neutral-benchmark', () => {
    // 2d-art project instances are weak (median 60 → capped), but the neutral benchmark is strong.
    const rows = buildCapabilityRows(
      [vlm('items', 'e1', ICON, 60), vlm('items', 'e2', ICON, 60)],
      [],
      bench([scored('2d-art', 'art-item-icon', 88), scored('2d-art', 'art-environment', 90)]),
    );
    const r = row(rows, '2d-art');
    expect(r.provenance).toBe('neutral-benchmark');
    expect(r.median).toBe(89); // benchmark median (88,90 → 89), not the project 60
    expect(r.n).toBe(2);
    expect(r.grade).toBe('strong'); // 89 median → strong
  });

  it('keeps the project-instance median visible as the secondary field', () => {
    const rows = buildCapabilityRows(
      [vlm('items', 'e1', ICON, 72), vlm('items', 'e2', ICON, 72)],
      [],
      bench([scored('2d-art', 'art-item-icon', 84)]),
    );
    const r = row(rows, '2d-art');
    expect(r.projectMedian).toBe(72); // project stays visible
    expect(r.median).toBe(84); // benchmark drives
    expect(r.gapStatement).toContain('project-instance median 72');
  });

  it('the benchmark escapes a documented project technique wall (neutral score is the pure measure)', () => {
    // text-config carries technique ceilings → instance path caps it. A strong neutral benchmark
    // is NOT force-capped: the canon-free score directly measures portable technique.
    const rows = buildCapabilityRows(
      [v('items', 'e1', 'Concept Brief', 80)],
      [],
      bench([scored('text-config', 'text-save-schema', 90), scored('text-config', 'text-codex-lore', 92), scored('text-config', 'text-ability-tuning', 91)]),
    );
    const r = row(rows, 'text-config');
    expect(r.provenance).toBe('neutral-benchmark');
    expect(r.grade).toBe('proven'); // median 91, n=3, not force-capped
    expect(r.cappedByTechnique).toBe(true); // flag still visible for context
  });

  it('a deferred (notes-only) benchmark row surfaces the note but does NOT change the grade', () => {
    const rows = buildCapabilityRows(
      [],
      [],
      bench([{ class: 'audio', briefId: null, score: null, deferred: true, note: 'no automated judge class — human review required.' }]),
    );
    const r = row(rows, 'audio');
    expect(r.provenance).toBe('derived-from-project-instances'); // unchanged
    expect(r.grade).toBe('unproven'); // unchanged instance grade
    expect(r.gapStatement).toContain('human review required');
  });

  it('an unavailable scored brief (score null with a note) does not fabricate a number', () => {
    // Only the credit-failed row is present → notes-only → grade untouched.
    const rows = buildCapabilityRows(
      [vlm('items', 'e1', ICON, 90), vlm('items', 'e2', ICON, 92), vlm('items', 'e3', ICON, 94)],
      [],
      bench([{ class: '2d-art', briefId: 'art-item-icon', score: null, engine: 'Leonardo', styleDna: false, note: 'benchmark-unavailable: credits.' }]),
    );
    const r = row(rows, '2d-art');
    expect(r.provenance).toBe('derived-from-project-instances');
    expect(r.median).toBe(92); // still the project median (no benchmark score to drive)
    expect(r.gapStatement).toContain('credits');
  });

  it('the real bundled capability-benchmarks.json wires through without throwing', () => {
    // Default overlay (the committed json) must always build a valid row set.
    const rows = buildCapabilityRows([]);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(['proven', 'strong', 'capped', 'unproven']).toContain(r.grade);
  });
});

describe('content binding — a verdict that judged other content is not capability evidence', () => {
  // `latestVerdictsByJudge` used to pool every stored verdict, so a score about content the
  // step no longer holds sat in the class median forever — the same gap `deriveCell` had.
  const DATA = { icon: 'the icon on record' };
  const HASH = stepContentHash(DATA);
  const held = (entityId: string) => ({
    catalogId: 'items', entityId, step: ICON, data: DATA, ueAssets: [], status: 'pass' as const, tier: 'L1' as const,
  });

  it('a STALE verdict is dropped from the class median (it scored content that is gone)', () => {
    const artifacts = [held('e1'), held('e2'), held('e3')];
    const bound = [
      vlm('items', 'e1', ICON, 90, { contentHash: HASH }),
      vlm('items', 'e2', ICON, 90, { contentHash: HASH }),
      vlm('items', 'e3', ICON, 90, { contentHash: HASH }),
    ];
    expect(row(build(bound, artifacts), '2d-art').n).toBe(3);
    // Re-bind ONE of them to content the step no longer holds: it stops counting.
    const withStale = [...bound.slice(0, 2), vlm('items', 'e3', ICON, 20, { contentHash: stepContentHash({ icon: 'the OLD icon' }) })];
    const r = row(build(withStale, artifacts), '2d-art');
    expect(r.n).toBe(2);
    expect(r.median).toBe(90); // the obsolete 20 no longer drags the class down
  });

  it('an UNKNOWN binding (legacy, hash-less) is KEPT — real evidence nobody can refute', () => {
    const artifacts = [held('e1')];
    const r = row(build([vlm('items', 'e1', ICON, 88)], artifacts), '2d-art');
    expect(r.n).toBe(1);
  });

  it('a step with no artifact on record is unaffected (nothing to compare against)', () => {
    const r = row(build([vlm('items', 'e1', ICON, 88)], []), '2d-art');
    expect(r.n).toBe(1);
  });

  it('falls back to an older BINDING verdict when the newest one went stale', () => {
    const artifacts = [held('e1')];
    const verdicts = [
      vlm('items', 'e1', ICON, 95, { contentHash: HASH, judgedAt: '2026-01-01 00:00:00' }),
      vlm('items', 'e1', ICON, 40, { contentHash: stepContentHash({ icon: 'gone' }), judgedAt: '2026-06-01 00:00:00' }),
    ];
    const r = row(build(verdicts, artifacts), '2d-art');
    expect(r.n).toBe(1);
    expect(r.median).toBe(95); // not 40: the newer verdict judged content the step no longer holds
  });
});
