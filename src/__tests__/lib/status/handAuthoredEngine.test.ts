import { describe, it, expect } from 'vitest';
import {
  deriveCell,
  engineClass,
  engineClassNote,
  engineSourceMark,
  isTrustedClass,
  resolveEngine,
  ENGINE_CLASS,
  ENGINE_CLASS_NOTE,
  HAND_AUTHORED_ENGINE,
  type EngineClass,
  type StepFact,
} from '@/lib/status/statusModel';
import { readinessOf } from '@/lib/status/readiness';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/**
 * `Code` used to mean two different things, and `TRUSTED_CLASSES` credited both.
 *
 *   1. deterministic code that COMPUTES a result from inputs outside its own source
 *      (the packaging verifier rebuilds a package from sibling artifacts and grades it
 *      against files on disk) — a pass there is earned against reality;
 *   2. a `produce()` body that returns LITERALS a person typed — where every check that
 *      grades the artifact re-reads the same literals the author wrote, so nothing outside
 *      the file can make it fail.
 *
 * Sense 2 had not earned sense 1's credibility, and /status could not tell them apart:
 * naming a step `Code` granted it the trusted `code` class and an R3 REVIEWED rung.
 *
 * Measured over the 344 registered steps on 2026-08-20: 110 cells resolved to a code-class
 * engine — 80 named `Code` / `Code (deterministic)` and 30 named `Packaging engine`. Every
 * one of the 80 emits an artifact determined entirely by literals in its own pipeline file
 * (106 of the 110 produce a byte-identical artifact for two different entities; the other
 * four interpolate the entity's NAME into otherwise fixed prose), and the audit's own notes
 * concede it — "hand-authored constants", "hand-picked constants engineered to land exactly
 * at 1.0", "a hardcoded stub, not a measured shader-compile output".
 *
 * This suite pins the split.
 */

const art = (step: string, status: PipelineArtifact['status'], extra: Partial<PipelineArtifact> = {}): PipelineArtifact => ({
  catalogId: 'c', entityId: 'e1', step, data: {}, ueAssets: [], status, ...extra,
});

const fact = (trueEngine: string): StepFact => ({
  catalogId: 'c', step: 'S', trueEngine, deliverable: 'text-config',
  generatorWired: true, judge: 'llm-panel', checkerMeaningful: false, note: '',
});

describe('Hand-authored — the engine class for constants a person typed', () => {
  it('is a name the map can class, and that class is NOT trusted', () => {
    expect(ENGINE_CLASS[HAND_AUTHORED_ENGINE]).toBe('hand-authored');
    expect(engineClass(HAND_AUTHORED_ENGINE)).toBe('hand-authored');
    expect(isTrustedClass('hand-authored')).toBe(false);
  });

  it('`Code` keeps meaning sense 1 and keeps its credibility', () => {
    // The split must not quietly demote genuinely-computing code: the fix is a NEW name for
    // the literals case, not a downgrade of the name that was already right.
    expect(engineClass('Code')).toBe('code');
    expect(engineClass('Code (deterministic)')).toBe('code');
    expect(engineClass('Packaging engine')).toBe('code');
    expect(isTrustedClass('code')).toBe(true);
  });

  it('is distinct from `Human` — the question is what VERIFIED it, not who wrote it', () => {
    // `human` is trusted for human SELECTION: a person looked at real candidates and chose
    // one, which is a judgment act with an artifact under it. A designer typing a balance
    // number is human work too, so "who wrote it" cannot be the distinction. Folding the
    // literals case into `human` would have re-granted exactly the credibility being removed.
    expect(engineClass('Human')).toBe('human');
    expect(isTrustedClass('human')).toBe(true);
    expect(engineClass(HAND_AUTHORED_ENGINE)).not.toBe('human');
  });
});

describe('the grade consequence is real, and it is the point', () => {
  it('an L0 pass from Hand-authored is UNGATED (R2 DRAFTED), not trusted (R3 REVIEWED)', () => {
    const cell = deriveCell('S', HAND_AUTHORED_ENGINE, [art('S', 'pass', { tier: 'L0' })]);
    expect(cell.grade).toBe('ungated');
    expect(readinessOf(cell).level).toBe('R2');
  });

  it('THE ORIGINAL LIE, reproduced: the same artifact under the old `Code` name grades trusted', () => {
    // Pointing the classifier back at the pre-split mapping is what proves this fix addresses
    // the actual defect. Byte-identical artifact, byte-identical checker verdict — only the
    // engine NAME differs, and the map hands out a whole readiness rung for it.
    const lied = deriveCell('S', 'Code', [art('S', 'pass', { tier: 'L0' })]);
    expect(lied.grade).toBe('trusted');
    expect(readinessOf(lied).level).toBe('R3');
  });

  it('the demotion cannot touch a cell that passed a REAL gate or a strict judge', () => {
    // Narrowness matters as much as the demotion: an L3 gate pass is proof regardless of who
    // typed the constants, and this change must not sweep it up.
    const gated = deriveCell('S', HAND_AUTHORED_ENGINE, [art('S', 'pass', { tier: 'L3' })]);
    expect(gated.grade).toBe('verified');
  });
});

describe('the map SAYS why a cell lost credibility', () => {
  it('every engine class has a credibility sentence — no silent re-colour', () => {
    const classes: EngineClass[] = [
      'llm', 'gen2d', 'gen3d', 'audio', 'runtime', 'tooling', 'code', 'hand-authored', 'human', 'unaudited',
    ];
    for (const c of classes) expect(ENGINE_CLASS_NOTE[c].length).toBeGreaterThan(40);
  });

  it("the hand-authored sentence names the defect, not just the label", () => {
    const note = engineClassNote(HAND_AUTHORED_ENGINE);
    expect(note).toMatch(/typed/i);
    expect(note).toMatch(/same literals/i);
  });

  it('an unrecognised engine falls to the `unaudited` sentence, never to a flattering one', () => {
    expect(engineClassNote('Some New Thing')).toBe(ENGINE_CLASS_NOTE.unaudited);
  });
});

describe('resolveEngine — a step may demote itself, never promote itself', () => {
  it('an authored Hand-authored BEATS an audited Code, and the mark says so', () => {
    // step-facts.json is Director-only, so without this a known over-attribution keeps
    // grading cells credible until a separate hand lands the audit edit.
    const r = resolveEngine('c', { label: 'S', engine: HAND_AUTHORED_ENGINE }, fact('Code'));
    expect(r).toEqual({ engine: HAND_AUTHORED_ENGINE, source: 'authored-demotion' });
    const mark = engineSourceMark('authored-demotion');
    expect(mark.word).toMatch(/AUTHORED/);
    expect(mark.note).toMatch(/lower-credibility/i);
  });

  it('the rule is ONE-WAY: an authored Code cannot overrule an audited Hand-authored', () => {
    const r = resolveEngine('c', { label: 'S', engine: 'Code' }, fact(HAND_AUTHORED_ENGINE));
    expect(r).toEqual({ engine: HAND_AUTHORED_ENGINE, source: 'audited' });
  });

  it('it does not fire between two untrusted classes, or two trusted ones', () => {
    // Only a trusted→untrusted correction is unambiguously safe. Anything else is a plain
    // disagreement for the spec linter to report, not for the map to silently resolve.
    expect(resolveEngine('c', { label: 'S', engine: 'Tripo' }, fact('Leonardo')).source).toBe('audited');
    expect(resolveEngine('c', { label: 'S', engine: 'Claude' }, fact('Code')).source).toBe('audited');
  });

  it('an audit and a spec that AGREE still read as audited (family-equal, no demotion path)', () => {
    expect(resolveEngine('c', { label: 'S', engine: HAND_AUTHORED_ENGINE }, fact(HAND_AUTHORED_ENGINE)).source).toBe('audited');
  });
});
