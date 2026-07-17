import { describe, it, expect } from 'vitest';
import { buildCapabilityRows, capabilityClassOf } from '@/lib/status/capabilityModel';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

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
    const rows = buildCapabilityRows([vlm('items', 'e1', ICON, 80), vlm('items', 'e2', ICON, 90), vlm('items', 'e3', ICON, 70)]);
    const r = row(rows, '2d-art');
    expect(r.n).toBe(3);
    expect(r.median).toBe(80); // sorted 70,80,90 → 80
    expect(r.stream).toBe('vlm');
  });

  it('normalizes a legacy 0-10 vlm score (stored raw) onto the 0-100 axis', () => {
    // A legacy 8/10 stored as 8 must count as 80, not 8, so it does not tank the median.
    const rows = buildCapabilityRows([vlm('items', 'e1', ICON, 8), vlm('items', 'e2', ICON, 80)]);
    expect(row(rows, '2d-art').median).toBe(80); // (80 + 80) / 2, not (8 + 80)/2
  });

  it('an llm-panel verdict on a vlm-judged step does NOT count (cell scored by its own judge)', () => {
    const rows = buildCapabilityRows([v('items', 'e1', ICON, 95)]);
    expect(row(rows, '2d-art').n).toBe(0);
  });
});

describe('mixed-stream class (text-config: llm-panel + vlm cells)', () => {
  it('aggregates each cell by its own step judge and labels the stream mixed', () => {
    const rows = buildCapabilityRows([
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
    expect(row(buildCapabilityRows([vlm('items', 'e1', ICON, 80), vlm('items', 'e2', ICON, 90)]), '2d-art').median).toBe(85);
  });

  it('proven: median ≥90 with n≥3', () => {
    const rows = buildCapabilityRows([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 92), vlm('items', 'c', ICON, 94)]);
    expect(row(rows, '2d-art').grade).toBe('proven');
  });

  it('90 boundary is proven; 89 boundary is strong', () => {
    const at90 = buildCapabilityRows([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 90), vlm('items', 'c', ICON, 90)]);
    expect(row(at90, '2d-art').grade).toBe('proven');
    const at89 = buildCapabilityRows([vlm('items', 'a', ICON, 89), vlm('items', 'b', ICON, 89), vlm('items', 'c', ICON, 89)]);
    expect(row(at89, '2d-art').grade).toBe('strong');
  });

  it('median ≥90 but n<3 → strong (insufficient evidence to certify proven)', () => {
    expect(row(buildCapabilityRows([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 92)]), '2d-art').grade).toBe('strong');
  });

  it('85 boundary → strong; below 85 with evidence → capped', () => {
    expect(row(buildCapabilityRows([vlm('items', 'a', ICON, 85), vlm('items', 'b', ICON, 85)]), '2d-art').grade).toBe('strong');
    expect(row(buildCapabilityRows([vlm('items', 'a', ICON, 84), vlm('items', 'b', ICON, 80)]), '2d-art').grade).toBe('capped');
  });

  it('a documented technique wall caps the class even at a high median (conservative)', () => {
    // text-config carries technique ceilings (items Concept Brief etc.) → capped, not proven.
    const rows = buildCapabilityRows([
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
    const r = row(buildCapabilityRows([]), 'ue-runtime');
    expect(r.grade).toBe('unproven');
    expect(r.stream).toBe('gates');
    expect(r.gatesDeclared).toBe(0);
    expect(r.median).toBeNull();
  });

  it('proven: rate ≥0.9 AND passed ≥10 (18 pass, 2 deferred = 0.9)', () => {
    const r = row(buildCapabilityRows([], gates(18, 2)), 'ue-runtime');
    expect(r.gatesPassed).toBe(18);
    expect(r.gatesDeclared).toBe(20);
    expect(r.grade).toBe('proven');
  });

  it('0.9 rate but passed <10 → strong (count floor blocks proven)', () => {
    // 9 pass + 1 deferred = 0.9 rate, but only 9 passed → strong, not proven.
    expect(row(buildCapabilityRows([], gates(9, 1)), 'ue-runtime').grade).toBe('strong');
  });

  it('0.7 boundary → strong (7 pass, 3 deferred); below 0.7 → capped (6 pass, 3 deferred)', () => {
    expect(row(buildCapabilityRows([], gates(7, 3)), 'ue-runtime').grade).toBe('strong');
    expect(row(buildCapabilityRows([], gates(6, 3)), 'ue-runtime').grade).toBe('capped');
  });

  it('passed <5 → capped even at 100% rate (strong count floor)', () => {
    expect(row(buildCapabilityRows([], gates(4, 0)), 'ue-runtime').grade).toBe('capped');
  });

  it('a failing gate counts as declared-not-passed and lowers the rate', () => {
    const arts = [...gates(6, 0), art('achievements', 'f0', GATE_STEP, 'fail')];
    const r = row(buildCapabilityRows([], arts), 'ue-runtime');
    expect(r.gatesPassed).toBe(6);
    expect(r.gatesDeclared).toBe(7); // 6 pass + 1 fail
    expect(r.grade).toBe('strong'); // 6/7 ≈ 0.857 ≥0.7, passed 6 ≥5
  });
});

describe('human / none classes', () => {
  it('audio stays unproven with no human verdicts, graded when human review exists', () => {
    const none = buildCapabilityRows([]);
    expect(row(none, 'audio').grade).toBe('unproven');
    expect(row(none, 'audio').stream).toBe('none');

    const judged = buildCapabilityRows([
      { catalogId: 'codex', entityId: 'e1', step: 'Audio Sting', judge: 'human', verdict: 'pass', score: 90, findings: '', model: 'human' },
    ]);
    const r = row(judged, 'audio');
    expect(r.stream).toBe('human');
    expect(r.grade).not.toBe('unproven');
  });

  it('vfx-particles (judge none) is always unproven', () => {
    expect(row(buildCapabilityRows([]), 'vfx-particles').grade).toBe('unproven');
  });
});

describe('exclusion honors ceiling-facts', () => {
  it('checker-structural / project-data cells are excluded from the median and counted separately', () => {
    const rows = buildCapabilityRows([
      v('items', 'e1', 'Economy', 62), // checker-structural (all entities) → excluded
      v('items', 'e2', 'Concept Brief', 80), // included
    ]);
    const r = row(rows, 'text-config');
    expect(r.excluded).toBeGreaterThanOrEqual(1);
    expect(r.n).toBe(1); // only Concept Brief counted
    expect(r.median).toBe(80);
  });

  it('entity-scoped project-data excludes only the named entity', () => {
    const rows = buildCapabilityRows([
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
    const rows = buildCapabilityRows([vlm('items', 'test-headless-mcp', ICON, 95), vlm('items', 'item-mcp-smoke', ICON, 95)]);
    expect(row(rows, '2d-art').n).toBe(0);
  });

  it('ignores stale (rubric<3) llm-panel verdicts but keeps un-rubriced vlm', () => {
    const rows = buildCapabilityRows([
      vlm('items', 'e1', ICON, 95), // vlm, no rubric → counts
      v('achievements', 'e2', 'Concept Brief', 95, { rubricVersion: 2 }), // stale panel → dropped
    ]);
    expect(row(rows, '2d-art').n).toBe(1);
    expect(row(rows, 'text-config').n).toBe(0);
  });

  it('keeps the latest verdict per (catalog|entity|step)', () => {
    const rows = buildCapabilityRows([
      vlm('items', 'e1', ICON, 40, { judgedAt: '2026-07-01' }),
      vlm('items', 'e1', ICON, 90, { judgedAt: '2026-07-16' }),
    ]);
    const r = row(rows, '2d-art');
    expect(r.n).toBe(1);
    expect(r.median).toBe(90);
  });

  it('provenance is the derived-from-project-instances constant on every row', () => {
    const rows = buildCapabilityRows([vlm('items', 'e1', ICON, 90)]);
    expect(rows.every((r) => r.provenance === 'derived-from-project-instances')).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('rows sort proven → strong → capped → unproven', () => {
    const rows = buildCapabilityRows([vlm('items', 'a', ICON, 90), vlm('items', 'b', ICON, 92), vlm('items', 'c', ICON, 94)]);
    const ranks = { proven: 0, strong: 1, capped: 2, unproven: 3 } as const;
    for (let i = 1; i < rows.length; i += 1) {
      expect(ranks[rows[i - 1].grade]).toBeLessThanOrEqual(ranks[rows[i].grade]);
    }
  });
});
