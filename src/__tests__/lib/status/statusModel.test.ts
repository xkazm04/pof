import { describe, it, expect } from 'vitest';
import { buildSwimlane, deriveCell, engineClass, gateHeadless, getHeadlessFact, getStepFact, inferEngine, isSyntheticEntity, sortLanes, type HeadlessLookup, type StepCell, type StepFact } from '@/lib/status/statusModel';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { stepContentHash } from '@/lib/judge/contentHash';
import { bridgeJudgeVerdict, judgedContentOf } from '@/lib/catalog/acceptance/judgeBridge';

const art = (step: string, status: PipelineArtifact['status'], extra: Partial<PipelineArtifact> = {}): PipelineArtifact => ({
  catalogId: 'c', entityId: 'e1', step, data: {}, ueAssets: [], status, ...extra,
});

// Synthetic catalog ids in these fixtures have no coverage entry, so the real headless gate
// would demote their would-be `verified` cells to trusted. Inject an all-operable lookup so
// the ladder assertions still test the ladder, not the (separately-tested) headless gate.
const allOperable: HeadlessLookup = (catalogId, step) => ({ catalogId, step, operable: true });

describe('inferEngine', () => {
  it('explicit StepSpec.engine wins', () => {
    expect(inferEngine('items', { label: 'Anything', engine: 'Tripo' })).toBe('Tripo');
  });
  it('player-movement is UE Python; galleries split 2D/3D; default is Claude', () => {
    expect(inferEngine('player-movement', { label: 'Retarget Clips' })).toBe('UE Python');
    expect(inferEngine('items', { label: 'Icon 2D Art', archetype: 'gallery' })).toBe('Leonardo');
    expect(inferEngine('items', { label: '3D Mesh', archetype: 'gallery' })).toBe('Tripo');
    expect(inferEngine('items', { label: 'Brief', archetype: 'brief' })).toBe('Claude');
  });
  it('classifies engines into credibility classes', () => {
    expect(engineClass('Claude')).toBe('llm');
    expect(engineClass('Tripo')).toBe('gen3d');
    expect(engineClass('UE Python')).toBe('runtime');
    expect(engineClass('SomethingNew')).toBe('llm');
  });
});

describe('deriveCell — the strict grade ladder', () => {
  it('no artifacts → unwired (the bottleneck color)', () => {
    expect(deriveCell('Brief', 'Claude', []).grade).toBe('unwired');
  });

  it('GREEN is reserved for gate-proven: an L3/L4 pass grades verified', () => {
    const c = deriveCell('Gate', 'UE Python', [art('Gate', 'pass', { tier: 'L3' })]);
    expect(c.grade).toBe('verified');
  });

  it('an L0 pass on an LLM step grades trusted, NOT verified', () => {
    const c = deriveCell('Brief', 'Claude', [art('Brief', 'pass', { tier: 'L0' })]);
    expect(c.grade).toBe('trusted');
  });

  it('an L0/L1 pass on generative 3D/2D grades UNGATED (quality not provable)', () => {
    expect(deriveCell('3D Gen', 'Tripo', [art('3D Gen', 'pass', { tier: 'L1' })]).grade).toBe('ungated');
    expect(deriveCell('Icon', 'Leonardo', [art('Icon', 'pass', { tier: 'L1' })]).grade).toBe('ungated');
  });

  it('an L0-L2 pass on unproven runtime claims grades ungated too', () => {
    expect(deriveCell('Import', 'UE Python', [art('Import', 'pass', { tier: 'L0' })]).grade).toBe('ungated');
  });

  it('deferred outranks fail/pending when nothing passes; fail alone → attention', () => {
    expect(deriveCell('G', 'Claude', [art('G', 'deferred', { tier: 'L3' })]).grade).toBe('deferred');
    expect(deriveCell('G', 'Claude', [art('G', 'deferred'), art('G', 'fail', { entityId: 'e2' })]).grade).toBe('deferred');
    expect(deriveCell('G', 'Claude', [art('G', 'fail')]).grade).toBe('attention');
    expect(deriveCell('G', 'Claude', [art('G', 'pending')]).grade).toBe('pending');
  });

  it('reports the best PASSING tier and first reason for the tooltip', () => {
    const c = deriveCell('G', 'Claude', [
      art('G', 'pass', { tier: 'L0' }),
      art('G', 'pass', { tier: 'L3', entityId: 'e2' }),
      art('G', 'deferred', { tier: 'L4', reason: 'why', entityId: 'e3' }),
    ]);
    expect(c.grade).toBe('verified');
    expect(c.tier).toBe('L3');
    expect(c.reason).toBe('why');
  });
});

describe('buildSwimlane', () => {
  it('computes verified/credible/wired percentages on the strict ladder', () => {
    const lane = buildSwimlane('c', 'Catalog', [
      { label: 'A', engine: 'Claude' },
      { label: 'B', engine: 'Tripo' },
      { label: 'C', engine: 'UE Python' },
      { label: 'D', engine: 'Claude' },
    ], [
      art('A', 'pass', { tier: 'L0' }),   // trusted
      art('B', 'pass', { tier: 'L1' }),   // ungated
      art('C', 'pass', { tier: 'L3' }),   // verified
      // D unwired
    ], [], allOperable);
    expect(lane.cells.map((c) => c.grade)).toEqual(['trusted', 'ungated', 'verified', 'unwired']);
    // Readiness ladder: trusted=R3, ungated=R2, verified=R4, unwired=R0.
    expect(lane.readyPct).toBe(25);    // R4+ : C
    expect(lane.crediblePct).toBe(50); // R3+ : A, C
    expect(lane.startedPct).toBe(75);  // R1+ : A, B, C
    expect(lane.blockedCount).toBe(0);
  });
});

describe('sortLanes', () => {
  it('gate-verified first, credible tiebreak, then alpha', () => {
    const mk = (id: string, tier?: 'L0' | 'L3') =>
      buildSwimlane(id, id, [{ label: 'S', engine: 'Claude' }], tier ? [art('S', 'pass', { tier })] : [], [], allOperable);
    const verified = mk('v', 'L3');
    const trusted = mk('t', 'L0');
    const empty = mk('e');
    expect(sortLanes([empty, trusted, verified]).map((l) => l.catalogId)).toEqual(['v', 't', 'e']);
  });
});

describe('unpowered — the audited no-engine gap', () => {
  const fact = (over: Partial<StepFact> = {}): StepFact => ({
    catalogId: 'vfx', step: 'Variants', trueEngine: 'None', deliverable: 'vfx-particles',
    generatorWired: false, judge: 'none', checkerMeaningful: false, note: 'no particle engine wired', ...over,
  });

  it('a pass on a claim with NO engine grades unpowered, never trusted/ungated', () => {
    const c = deriveCell('Variants', 'Leonardo', [art('Variants', 'pass', { tier: 'L1' })], fact());
    expect(c.grade).toBe('unpowered');
    expect(c.engine).toBe('none');
    expect(c.judge).toBe('none');
  });

  it('a media deliverable without a wired generator is unpowered even when trueEngine is Claude', () => {
    const c = deriveCell('Layers', 'Claude', [art('Layers', 'pass', { tier: 'L0' })],
      fact({ trueEngine: 'Claude', deliverable: 'audio' }));
    expect(c.grade).toBe('unpowered');
  });

  it('a real gate pass STILL wins over unpowered (evidence beats audit priors)', () => {
    const c = deriveCell('Variants', 'Leonardo', [art('Variants', 'pass', { tier: 'L4' })], fact());
    expect(c.grade).toBe('verified');
  });

  it('text-config with a wired path stays trusted; audit metadata rides along', () => {
    const c = deriveCell('Brief', 'Claude', [art('Brief', 'pass', { tier: 'L0' })],
      fact({ trueEngine: 'Claude', deliverable: 'text-config', generatorWired: true, judge: 'llm-panel' }));
    expect(c.grade).toBe('trusted');
    expect(c.judge).toBe('llm-panel');
    expect(c.checkerMeaningful).toBe(false);
  });

  it('the audit dataset is loaded (real fact lookup)', () => {
    const f = getStepFact('characters', 'Combat Anim');
    expect(f?.trueEngine).toBe('None');
    expect(f?.generatorWired).toBe(false);
  });
});

describe('browserMirror — dual-execution annotation', () => {
  const fact = (over: Partial<StepFact> = {}): StepFact => ({
    catalogId: 'spellbook', step: 'Effect Logic', trueEngine: 'Claude', deliverable: 'text-config',
    generatorWired: true, judge: 'llm-panel', checkerMeaningful: false, note: '', ...over,
  });

  it('text-config steps carry browserMirror: direct', () => {
    const c = deriveCell('Effect Logic', 'Claude', [art('Effect Logic', 'pass')], fact());
    expect(c.browserMirror).toBe('direct');
  });

  it('media deliverables carry partial; the ue-runtime moat carries nothing', () => {
    const mesh = deriveCell('3D & Rig', 'Tripo', [art('3D & Rig', 'pass')],
      fact({ deliverable: '3d-mesh', trueEngine: 'Tripo' }));
    expect(mesh.browserMirror).toBe('partial');
    const gate = deriveCell('Test Gate', 'UE', [art('Test Gate', 'deferred')],
      fact({ deliverable: 'ue-runtime', trueEngine: 'UE gates' }));
    expect(gate.browserMirror).toBeUndefined();
  });

  it('no fact → no browserMirror claim', () => {
    const c = deriveCell('Brief', 'Claude', [art('Brief', 'pass')]);
    expect(c.browserMirror).toBeUndefined();
  });

  it('buildSwimlane attaches realization evidence for reviewed pipelines only', () => {
    const lane = buildSwimlane('spellbook', 'Spellbook',
      [{ label: 'Effect Logic' }], [art('Effect Logic', 'pass', { catalogId: 'spellbook' })]);
    expect(lane.cells[0].realization?.browser).toBe('proven');
    // A pipeline with NO realization-facts entry claims nothing. Uses a phantom catalog id
    // rather than a real one: this assertion previously named `items`, which was later
    // reviewed, so the test began failing on data growth rather than on a regression.
    const other = buildSwimlane('phantom-catalog-xyz', 'Phantom',
      [{ label: 'Concept Brief' }], [art('Concept Brief', 'pass', { catalogId: 'phantom-catalog-xyz' })]);
    expect(other.cells[0].realization).toBeUndefined();
  });
});

describe('judge verdict merge — the content-quality layer', () => {
  const llmFact: StepFact = {
    catalogId: 'items', step: 'Brief', trueEngine: 'Claude', deliverable: 'text-config',
    generatorWired: true, judge: 'llm-panel', checkerMeaningful: false, note: 'prose brief',
  };
  // The content the step holds in these fixtures, and the artifact that carries it. A verdict
  // is only binding when it is stamped with THIS content's hash (see the provenance block).
  const DATA = { brief: 'a written concept brief', budget: 42 };
  const HASH = stepContentHash(DATA);
  const held = (status: PipelineArtifact['status'], extra: Partial<PipelineArtifact> = {}) =>
    art('Brief', status, { data: DATA, ...extra });

  // A STRICT pass (CURRENT rubric, >=90, BOUND to the content on record) is what verifies under
  // the WS2 ladder; a lenient/old/unbound pass does not.
  const jv = (verdict: 'pass' | 'fail', judge: 'llm-panel' | 'vlm' = 'llm-panel') => ({
    catalogId: 'items', entityId: 'e1', step: 'Brief', judge, verdict,
    score: verdict === 'pass' ? 92 : 31, findings: 'panel findings text', model: 'claude-opus-4-8',
    rubricVersion: RUBRIC_VERSION, contentHash: HASH,
  });

  it('a matching STRICT judge PASS (current rubric, >=90) elevates a checker-pass to verified', () => {
    const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [jv('pass')]);
    expect(c.grade).toBe('verified');
    expect(c.judged?.score).toBe(92);
    expect(c.judgeAttribution?.provenance).toBe('current');
    expect(c.judgeAttribution?.applied).toBe(true);
  });

  it('a LENIENT judge pass (old rubric / <90) does NOT verify — stays trusted', () => {
    const lenient = { catalogId: 'items', entityId: 'e1', step: 'Brief', judge: 'llm-panel' as const, verdict: 'pass' as const, score: 86, findings: 'lenient panel', model: 'sonnet-fleet-w1', rubricVersion: 1, contentHash: HASH };
    const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [lenient]);
    expect(c.grade).toBe('trusted');
  });

  it('a SUPERSEDED-rubric pass at >=90 does NOT verify — a canon-blind v(N-1) pass is provisional until re-judged', () => {
    const stale = { catalogId: 'items', entityId: 'e1', step: 'Brief', judge: 'llm-panel' as const, verdict: 'pass' as const, score: 93, findings: 'pre-canon pass', model: 'claude-opus-4-8', rubricVersion: RUBRIC_VERSION - 1, contentHash: HASH };
    const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [stale]);
    expect(c.grade).toBe('trusted'); // demoted from verified until a current-rubric verdict lands
  });

  it('a judge FAIL condemns the content to attention even when the shape checker passed', () => {
    const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [jv('fail')]);
    expect(c.grade).toBe('attention');
    expect(c.judged?.verdict).toBe('fail');
    expect(c.judgeAttribution?.applied).toBe(true);
  });

  it('a verdict from the WRONG judge class does not elevate (vlm verdict on an llm-panel step)', () => {
    const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [jv('pass', 'vlm')]);
    expect(c.grade).toBe('trusted');
  });

  it('a judge pass without any checker-pass does not fabricate verified (nothing produced)', () => {
    const c = deriveCell('Brief', 'Claude', [], llmFact, [jv('pass')]);
    expect(c.grade).toBe('unwired');
  });

  /* ── content binding: a verdict speaks only for the content it judged ──────────────── */

  describe('verdict provenance — the map may not trust a verdict that judged other content', () => {
    /** The same verdict, but stamped with the hash of content the step no longer holds. */
    const boundToOther = (verdict: 'pass' | 'fail') => ({ ...jv(verdict), contentHash: stepContentHash({ brief: 'the OLD content', budget: 7 }) });

    it('a STALE pass cannot hold a cell green — content regressed since it was judged', () => {
      const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [boundToOther('pass')]);
      expect(c.grade).not.toBe('verified');
      expect(c.grade).toBe('trusted'); // where a plain checker-pass from an llm engine lands
      expect(c.judgeAttribution?.provenance).toBe('stale');
      expect(c.judgeAttribution?.applied).toBe(false);
    });

    it('a STALE fail cannot hold a fixed, re-produced step red', () => {
      const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [boundToOther('fail')]);
      expect(c.grade).not.toBe('attention');
      expect(c.judgeAttribution?.provenance).toBe('stale');
      expect(c.judgeAttribution?.applied).toBe(false);
      // …and it SAYS so, rather than the red simply vanishing.
      expect(c.judgeAttribution?.note).toContain('UNJUDGED');
      expect(c.judged?.verdict).toBe('fail'); // still reported: the verdict is not hidden
    });

    it('a legacy hash-less verdict judged BEFORE the last write is stale (dated, not guessed)', () => {
      const legacy = { ...jv('fail'), contentHash: undefined, judgedAt: '2026-01-01 00:00:00' };
      const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0', updatedAt: '2026-06-01 00:00:00' })], llmFact, [legacy]);
      expect(c.grade).not.toBe('attention');
      expect(c.judgeAttribution?.provenance).toBe('stale');
    });

    it('UNKNOWN provenance still CONDEMNS but can never PROVE (asymmetric on purpose)', () => {
      const unbound = (verdict: 'pass' | 'fail') => ({ ...jv(verdict), contentHash: undefined });
      // Nobody can confirm or refute it — a recorded fail is still evidence.
      const failed = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [unbound('fail')]);
      expect(failed.grade).toBe('attention');
      expect(failed.judgeAttribution?.provenance).toBe('unknown');
      expect(failed.judgeAttribution?.applied).toBe(true);
      // …but the same unconfirmable binding may not manufacture green.
      const passed = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [unbound('pass')]);
      expect(passed.grade).not.toBe('verified');
      expect(passed.judgeAttribution?.applied).toBe(false);
    });

    it('a SUPERSEDED-rubric fail does not condemn — it needs a re-judge, it is not a verdict', () => {
      const old = { ...jv('fail'), rubricVersion: RUBRIC_VERSION - 1 };
      const c = deriveCell('Brief', 'Claude', [held('pass', { tier: 'L0' })], llmFact, [old]);
      expect(c.grade).not.toBe('attention');
      expect(c.judgeAttribution?.provenance).toBe('superseded');
      expect(c.judgeAttribution?.note).toContain('re-judge');
    });

    it('a DEFERRED cell is not swept into the downgrade — an unrun gate is not a stale verdict', () => {
      const c = deriveCell('Gate', 'UE Python', [art('Gate', 'deferred', { tier: 'L3', reason: 'gate declared, not run' })], undefined, [boundToOther('fail')]);
      expect(c.grade).toBe('deferred');
      expect(c.reason).toBe('gate declared, not run');
    });

    it('the L3/L4 GATE pass is untouched by verdict provenance (the checker gate is not a judgment)', () => {
      const c = deriveCell('Gate', 'UE Python', [art('Gate', 'pass', { tier: 'L3' })], undefined, [boundToOther('pass')]);
      expect(c.grade).toBe('verified');
    });

    it('AGREEMENT: the map condemns exactly when the per-step Acceptance banner does', () => {
      // The disagreement between these two was the defect: `deriveCell` applied verdicts the
      // banner (bridgeJudgeVerdict) had already ruled non-binding. Walk every provenance and
      // pin that they now answer identically for the SAME verdict.
      const cases: { name: string; v: JudgeVerdict; a: PipelineArtifact }[] = [
        { name: 'current', v: jv('fail') as JudgeVerdict, a: held('pass') },
        { name: 'stale', v: boundToOther('fail') as JudgeVerdict, a: held('pass') },
        { name: 'unknown', v: { ...jv('fail'), contentHash: undefined } as JudgeVerdict, a: held('pass') },
        { name: 'superseded', v: { ...jv('fail'), rubricVersion: RUBRIC_VERSION - 1 } as JudgeVerdict, a: held('pass') },
      ];
      for (const { name, v, a } of cases) {
        const cell = deriveCell('Brief', 'Claude', [a], llmFact, [v]);
        const bridged = bridgeJudgeVerdict(
          { label: 'Brief', status: 'pass', tier: 'L0', detail: 'checker passed' },
          [v], llmFact.judge, judgedContentOf(a.data, a.updatedAt),
        );
        const mapCondemns = cell.grade === 'attention';
        const bannerCondemns = bridged.status === 'fail';
        expect(mapCondemns, `${name}: map=${cell.grade} banner=${bridged.status}`).toBe(bannerCondemns);
        expect(cell.judgeAttribution?.provenance, `${name} provenance`).toBe(bridged.judge?.provenance);
      }
    });
  });
});

describe('synthetic test-fixture entities are not content', () => {
  it('recognises the harness fixtures and nothing else', () => {
    expect(isSyntheticEntity('test-headless-concept-brief')).toBe(true);
    expect(isSyntheticEntity('item-mcp-smoke')).toBe(true);
    expect(isSyntheticEntity('item-1')).toBe(false);
    expect(isSyntheticEntity('test-dummy-real-entity')).toBe(false);
  });

  it("a fixture's failing verdict does not red out a step whose real content is shippable", () => {
    const strict = (entityId: string, score: number) => ({
      catalogId: 'items', entityId, step: 'Brief', judge: 'llm-panel' as const,
      verdict: (score >= 90 ? 'pass' : 'fail') as 'pass' | 'fail',
      score, findings: '', model: 'claude-opus-4-8', rubricVersion: RUBRIC_VERSION,
      // Bound to the content this entity holds — only a BINDING pass may elevate.
      contentHash: stepContentHash({ brief: entityId }),
    });
    const artFor = (entityId: string): PipelineArtifact => ({
      catalogId: 'items', entityId, step: 'Brief', data: { brief: entityId }, ueAssets: [], status: 'pass', tier: 'L0',
    });
    const lane = buildSwimlane(
      'items', 'Items', [{ label: 'Brief', engine: 'Claude' }],
      [artFor('item-1'), artFor('test-headless-concept-brief')],
      [strict('item-1', 92), strict('test-headless-concept-brief', 3)],
      allOperable,
    );
    expect(lane.cells[0].grade).toBe('verified');
    expect(lane.cells[0].judged?.score).toBe(92);
  });

  it('a REAL sibling below 90 still reds the cell (the fixture filter is not a whitewash)', () => {
    const strict = (entityId: string, score: number) => ({
      catalogId: 'items', entityId, step: 'Brief', judge: 'llm-panel' as const,
      verdict: (score >= 90 ? 'pass' : 'fail') as 'pass' | 'fail',
      score, findings: '', model: 'claude-opus-4-8', rubricVersion: RUBRIC_VERSION,
      // Bound to the content this entity holds — only a BINDING pass may elevate.
      contentHash: stepContentHash({ brief: entityId }),
    });
    const artFor = (entityId: string): PipelineArtifact => ({
      catalogId: 'items', entityId, step: 'Brief', data: { brief: entityId }, ueAssets: [], status: 'pass', tier: 'L0',
    });
    const lane = buildSwimlane(
      'items', 'Items', [{ label: 'Brief', engine: 'Claude' }],
      [artFor('item-1'), artFor('item-lightsaber')],
      [strict('item-1', 92), strict('item-lightsaber', 83)],
      allOperable,
    );
    expect(lane.cells[0].grade).toBe('attention');
  });
});

describe('headless-operability gate — verified demands a machine-reproducible gate', () => {
  const cell = (grade: StepCell['grade'], reason?: string): StepCell => ({
    label: 'S', engine: 'UE Python', grade,
    counts: { pass: 1, deferred: 0, fail: 0, pending: 0 }, ...(reason ? { reason } : {}),
  });
  const operable: HeadlessLookup = (catalogId, step) => ({ catalogId, step, operable: true });
  const inoperable: HeadlessLookup = (catalogId, step) => ({ catalogId, step, operable: false });
  const missing: HeadlessLookup = () => undefined;

  it('verified + operable stays verified', () => {
    expect(gateHeadless(cell('verified'), 'c', 'S', operable).grade).toBe('verified');
  });

  it('would-be verified + operable:false demotes to trusted with the prefixed reason', () => {
    const g = gateHeadless(cell('verified'), 'c', 'S', inoperable);
    expect(g.grade).toBe('trusted');
    expect(g.reason).toBe('not headless-operable via pof-mcp');
  });

  it('would-be verified + MISSING coverage entry also demotes to trusted', () => {
    const g = gateHeadless(cell('verified'), 'c', 'S', missing);
    expect(g.grade).toBe('trusted');
    expect(g.reason).toBe('not headless-operable via pof-mcp');
  });

  it('prepends the prefix to an existing reason', () => {
    const g = gateHeadless(cell('verified', 'gate passed in PIE'), 'c', 'S', inoperable);
    expect(g.grade).toBe('trusted');
    expect(g.reason).toBe('not headless-operable via pof-mcp: gate passed in PIE');
  });

  it('non-verified grades pass through unchanged regardless of coverage', () => {
    for (const grade of ['trusted', 'ungated', 'unpowered', 'deferred', 'attention', 'pending', 'unwired'] as const) {
      const c = cell(grade, 'r');
      expect(gateHeadless(c, 'c', 'S', missing)).toBe(c); // same reference — untouched
      expect(gateHeadless(c, 'c', 'S', inoperable)).toBe(c);
    }
  });

  it('buildSwimlane with the REAL json demotes a would-be-verified cell whose step is not covered', () => {
    // A phantom catalog id absent from the coverage json → its verified cell is demoted.
    const lane = buildSwimlane('phantom-catalog-xyz', 'Phantom', [
      { label: 'Gate', engine: 'UE Python' },
    ], [art('Gate', 'pass', { tier: 'L3' })]); // real getHeadlessFact default lookup
    expect(lane.cells[0].grade).toBe('trusted');
    expect(lane.cells[0].reason).toContain('not headless-operable via pof-mcp');
    expect(lane.readyPct).toBe(0);
  });

  it('the coverage dataset is loaded (real headless fact lookup)', () => {
    const f = getHeadlessFact('achievements', 'Concept Brief');
    expect(f?.operable).toBe(true);
  });
});
