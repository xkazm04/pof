import { describe, it, expect } from 'vitest';
import {
  summarizeDoneProvenance,
  doneHeadline,
  type DoneProvenance,
} from '@/components/layout-lab/coachProvenance';
import type { StepFact } from '@/lib/status/statusModel';

const fact = (over: Partial<StepFact> = {}): StepFact => ({
  catalogId: 'items',
  step: 'Step',
  trueEngine: 'Claude CLI',
  deliverable: 'text',
  generatorWired: true,
  judge: 'llm-panel',
  checkerMeaningful: true,
  note: '',
  ...over,
});

/** Bind a step→fact map into the lookup shape the summarizer takes. */
const lookup = (m: Record<string, StepFact | undefined>) => (step: string) => m[step];

const steps = ['Concept', 'Art', 'Attributes', 'Economy'];

describe('summarizeDoneProvenance', () => {
  it('reports every step solid when each fact is fully backed', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact(), Art: fact(), Attributes: fact(), Economy: fact(),
    }));
    expect(p.total).toBe(4);
    expect(p.solid).toBe(4);
    expect(p.shapeOnly).toBe(0);
    expect(p.unjudged).toBe(0);
    expect(p.unwired).toBe(0);
    expect(p.unaudited).toBe(0);
    expect(p.weakest).toBeNull();
  });

  it('counts a shape-only checker as not solid', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact(), Art: fact({ checkerMeaningful: false }), Attributes: fact(), Economy: fact(),
    }));
    expect(p.shapeOnly).toBe(1);
    expect(p.solid).toBe(3);
    expect(p.weakest?.step).toBe('Art');
  });

  it('counts an absent judge as not solid', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact(), Art: fact(), Attributes: fact({ judge: 'none' }), Economy: fact(),
    }));
    expect(p.unjudged).toBe(1);
    expect(p.solid).toBe(3);
    expect(p.weakest?.step).toBe('Attributes');
  });

  it('counts an unwired generator as not solid', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact(), Art: fact({ generatorWired: false }), Attributes: fact(), Economy: fact(),
    }));
    expect(p.unwired).toBe(1);
    expect(p.solid).toBe(3);
  });

  it('counts a step with NO audited fact as unaudited, never as solid', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact(), Art: undefined, Attributes: fact(), Economy: fact(),
    }));
    expect(p.unaudited).toBe(1);
    expect(p.solid).toBe(3);
    expect(p.weakest?.step).toBe('Art');
  });

  it('tallies one step under EVERY weakness it has (they are not exclusive)', () => {
    const p = summarizeDoneProvenance(['Art'], lookup({
      Art: fact({ checkerMeaningful: false, judge: 'none', generatorWired: false }),
    }));
    expect(p.shapeOnly).toBe(1);
    expect(p.unjudged).toBe(1);
    expect(p.unwired).toBe(1);
    // …but it is ONE step, so it can only be weak once.
    expect(p.weak).toBe(1);
    expect(p.solid).toBe(0);
  });

  it('ranks an unwired generator above a shape-only checker as the weakest link', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact({ checkerMeaningful: false }),
      Art: fact({ generatorWired: false }),
      Attributes: fact(), Economy: fact(),
    }));
    expect(p.weakest?.step).toBe('Art');
    expect(p.weakest?.index).toBe(1);
    expect(p.weakest?.reason).toMatch(/generator/i);
  });

  it('ranks a shape-only checker above a merely unjudged step', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact({ judge: 'none' }),
      Art: fact({ checkerMeaningful: false }),
      Attributes: fact(), Economy: fact(),
    }));
    expect(p.weakest?.step).toBe('Art');
    expect(p.weakest?.reason).toMatch(/checker|shape/i);
  });

  it('ranks a known defect above an unaudited step', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: undefined,
      Art: fact({ judge: 'none' }),
      Attributes: fact(), Economy: fact(),
    }));
    expect(p.weakest?.step).toBe('Art');
  });

  it('picks the FIRST step at the weakest rung, so the pick is stable', () => {
    const p = summarizeDoneProvenance(steps, lookup({
      Concept: fact(),
      Art: fact({ generatorWired: false }),
      Attributes: fact({ generatorWired: false }),
      Economy: fact(),
    }));
    expect(p.weakest?.step).toBe('Art');
  });

  it('is total over an empty pipeline (no steps → nothing weak)', () => {
    const p = summarizeDoneProvenance([], lookup({}));
    expect(p.total).toBe(0);
    expect(p.weak).toBe(0);
    expect(p.weakest).toBeNull();
  });
});

describe('doneHeadline', () => {
  const p = (over: Partial<DoneProvenance> = {}): DoneProvenance => ({
    total: 4, solid: 4, weak: 0, shapeOnly: 0, unjudged: 0, unwired: 0, unaudited: 0,
    weakest: null, ...over,
  });

  it('says plainly done when every pass is backed', () => {
    const h = doneHeadline(p());
    expect(h.verified).toBe(true);
    expect(h.headline).toMatch(/all done/i);
  });

  it('refuses to claim done when the passes rest on unproven ground', () => {
    const h = doneHeadline(p({
      solid: 1, weak: 3, shapeOnly: 3,
      weakest: { step: 'Art', index: 1, reason: 'its checker only checks shape' },
    }));
    expect(h.verified).toBe(false);
    // The count must be visible — "all done" over 3 unproven steps is the overclaim.
    expect(h.headline).toContain('3');
    expect(h.headline).not.toMatch(/^all done\.$/i);
    expect(h.detail).toContain('Art');
  });

  it('names each distinct weakness it actually counted, and no other', () => {
    const h = doneHeadline(p({
      solid: 1, weak: 3, shapeOnly: 2, unjudged: 1, unwired: 0, unaudited: 1,
      weakest: { step: 'Art', index: 1, reason: 'its checker only checks shape' },
    }));
    expect(h.detail).toMatch(/shape/i);
    expect(h.detail).toMatch(/judge/i);
    expect(h.detail).toMatch(/unaudited/i);
    expect(h.detail).not.toMatch(/generator/i);
  });

  it('says nothing about provenance for an empty pipeline', () => {
    const h = doneHeadline(p({ total: 0, solid: 0 }));
    expect(h.verified).toBe(true);
  });
});
