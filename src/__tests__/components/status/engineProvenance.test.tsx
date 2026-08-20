import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatusCell } from '@/components/status/StatusCell';
import {
  engineSourceMark,
  ENGINE_SOURCE_MARK,
  buildSwimlane,
  UNAUDITED_ENGINE,
  type StepCell,
  type CellGrade,
  type EngineSource,
} from '@/lib/status/statusModel';

/**
 * The engine name on a /status cell has THREE possible provenances — an audited fleet fact
 * (`step-facts.json`), a value the step authored on itself (`StepSpec.engine`), and a
 * heuristic guess over catalog + archetype + label. `resolveEngine` has distinguished them
 * since the audit landed and `buildSwimlane` stamps the answer onto every cell, but nothing
 * RENDERED it: all three printed the same string in the same weight, so a guess was
 * indistinguishable from a fact on the one map whose entire purpose is to say what is
 * actually behind a cell.
 *
 * These tests pin the distinction at the render seam.
 */

// This suite has no auto-cleanup (see src/__tests__/setup.ts).
afterEach(cleanup);

function cell(extra: Partial<StepCell> = {}, grade: CellGrade = 'trusted'): StepCell {
  return {
    label: 'Economy',
    engine: 'Claude',
    grade,
    counts: { pass: 1, deferred: 0, fail: 0, pending: 0 },
    ...extra,
  };
}

const glyph = (c: HTMLElement) => c.querySelector('[data-testid="engine-source-glyph"]');
const name = (c: HTMLElement) => c.querySelector('[data-testid="engine-name"]') as HTMLElement;
const label = (c: HTMLElement) => (c.querySelector('[data-readiness]') as HTMLElement).getAttribute('aria-label') ?? '';

describe('engineSourceMark — one vocabulary for engine provenance', () => {
  it('gives every source a glyph AND a word, so the distinction never rests on hue', () => {
    for (const s of ['audited', 'authored', 'inferred', 'unsourced'] as const) {
      expect(ENGINE_SOURCE_MARK[s].glyph.length).toBeGreaterThan(0);
      expect(ENGINE_SOURCE_MARK[s].word).toMatch(/^[A-Z]+$/);
      expect(ENGINE_SOURCE_MARK[s].note.length).toBeGreaterThan(30);
    }
  });

  it('a heuristic label reads UNAUTHORED and says the name is a guess', () => {
    const m = engineSourceMark('inferred');
    expect(m.word).toBe('UNAUTHORED');
    expect(m.note.toLowerCase()).toContain('guess');
  });

  it('a MISSING engineSource is loud, not silently treated as known', () => {
    // The omission case is the one that matters: a cell built without recording provenance
    // has proven nothing, and letting `undefined` fall through to the audited wording is
    // how 96.5% of a map silently becomes "authored" by omission.
    const m = engineSourceMark(undefined);
    expect(m.word).toBe('UNSOURCED');
    expect(m.word).not.toBe(engineSourceMark('audited').word);
  });

  it('the four words are mutually distinct (no two sources read the same)', () => {
    const words = (['audited', 'authored', 'inferred', 'unsourced'] as const).map((s) => ENGINE_SOURCE_MARK[s].word);
    expect(new Set(words).size).toBe(words.length);
  });
});

describe('StatusCell — an unauthored engine cannot read as a fact', () => {
  it.each([
    ['audited', '✓'],
    ['authored', '✎'],
    ['inferred', '?'],
  ] as [EngineSource, string][])('renders the %s glyph on the cell', (source, expected) => {
    const { container } = render(<StatusCell cell={cell({ engineSource: source })} />);
    expect(glyph(container)?.textContent).toBe(expected);
    expect(glyph(container)?.getAttribute('data-engine-source')).toBe(source);
  });

  it('marks a cell with NO recorded source as unsourced rather than omitting the mark', () => {
    const { container } = render(<StatusCell cell={cell()} />);
    expect(glyph(container)?.getAttribute('data-engine-source')).toBe('unsourced');
    expect(glyph(container)?.textContent).toBe('?');
  });

  it('an unauthored/unsourced engine NAME is styled apart from an audited one', () => {
    // Visually distinct, not merely semantically: the same string in the same weight is
    // exactly the defect.
    const inferred = render(<StatusCell cell={cell({ engineSource: 'inferred' })} />);
    expect(name(inferred.container).style.fontStyle).toBe('italic');
    expect(name(inferred.container).style.textDecoration).toContain('dotted');
    cleanup();
    const audited = render(<StatusCell cell={cell({ engineSource: 'audited' })} />);
    expect(audited.container.querySelector('[data-testid="engine-name"]')).not.toBeNull();
    expect((audited.container.querySelector('[data-testid="engine-name"]') as HTMLElement).style.fontStyle).not.toBe('italic');
  });

  it('the accessible label states the provenance word and its explanation', () => {
    const { container } = render(<StatusCell cell={cell({ engine: 'Leonardo', engineSource: 'inferred' })} />);
    const text = label(container);
    expect(text).toContain('engine: Leonardo [UNAUTHORED]');
    expect(text.toLowerCase()).toContain('heuristic guess');
  });

  it('an AUDITED label says the audit named it — screen readers get the same distinction', () => {
    const { container } = render(<StatusCell cell={cell({ engine: 'Code', engineSource: 'audited' })} />);
    expect(label(container)).toContain('engine: Code [AUDITED]');
    expect(label(container)).toContain('step-facts.json');
  });

  it('does NOT stamp a provenance glyph on a cell that names no engine', () => {
    // `—` (unwired) and `no engine` (unpowered) are statements about ABSENCE; marking them
    // ✓ or ? would attach a confidence to a claim nobody made.
    const unwired = render(<StatusCell cell={cell({ engineSource: 'inferred' }, 'unwired')} />);
    expect(glyph(unwired.container)).toBeNull();
    cleanup();
    const unpowered = render(<StatusCell cell={cell({ engine: 'none', engineSource: 'audited' }, 'unpowered')} />);
    expect(unpowered.container.querySelector('[data-testid="engine-source-glyph"]')).toBeNull();
  });

  it('the tier/grade line survives the provenance rewrite (no evidence class lost)', () => {
    const { container } = render(<StatusCell cell={cell({ tier: 'L2', engineSource: 'audited' })} />);
    expect(label(container)).toContain('evidence class L2');
    expect(label(container)).toContain('internal grade trusted');
  });
});

describe('buildSwimlane feeds the render seam a real source for every cell', () => {
  it('stamps a source on every cell, so a rendered cell is never accidentally UNSOURCED', () => {
    const lane = buildSwimlane('phantom-catalog-xyz', 'Phantom', [
      { label: 'Guessable Gallery', archetype: 'gallery' },
      { label: 'Nothing Matches This', archetype: 'checklist' },
      { label: 'Authored', engine: 'Blender' },
    ], [], []);
    expect(lane.cells.every((c) => c.engineSource != null)).toBe(true);
    expect(lane.cells.map((c) => [c.engine, c.engineSource])).toEqual([
      ['Leonardo', 'inferred'],
      [UNAUDITED_ENGINE, 'inferred'],
      ['Blender', 'authored'],
    ]);
  });
});
