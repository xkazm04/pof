import { describe, it, expect } from 'vitest';
import {
  PRODUCE_DIRECTION_KEY, withProduceDirection, readProduceDirection,
} from '@/lib/catalog/produceDirection';
import { isCliEligible, CLI_ELIGIBLE_ARCHETYPES } from '@/components/layout-lab/labProduceMode';

describe('produceDirection stamp', () => {
  it('stamps direction + prompt onto the produced data', () => {
    const out = withProduceDirection({ data: { brief: 'x' }, ueAssets: ['/Game/A'] }, { direction: 'grim, wet stone', prompt: 'P' });
    expect(out.data?.[PRODUCE_DIRECTION_KEY]).toEqual({ direction: 'grim, wet stone', prompt: 'P' });
    // additive — the step's own fields and assets are untouched
    expect(out.data?.brief).toBe('x');
    expect(out.ueAssets).toEqual(['/Game/A']);
  });

  it('is a no-op without a ctx (demo seeding / linter / headless keep the old shape)', () => {
    const base = { data: { brief: 'x' } };
    expect(withProduceDirection(base)).toBe(base);
  });

  it('records an empty direction/prompt honestly rather than omitting the stamp', () => {
    const out = withProduceDirection({ data: {} }, { direction: '', prompt: '' });
    expect(readProduceDirection(out.data)).toEqual({ direction: '', prompt: '' });
  });

  it('reads back nothing for artifacts that predate the stamp', () => {
    expect(readProduceDirection({ brief: 'x' })).toBeNull();
    expect(readProduceDirection(null)).toBeNull();
    expect(readProduceDirection({ [PRODUCE_DIRECTION_KEY]: 'oops' })).toBeNull();
  });
});

describe('CLI-eligible archetypes', () => {
  it('covers the text deliverables a CLI session can author, and nothing generative', () => {
    expect([...CLI_ELIGIBLE_ARCHETYPES].sort()).toEqual(['brief', 'graph', 'rules']);
    expect(isCliEligible('brief')).toBe(true);
    expect(isCliEligible('gallery')).toBe(false);
    expect(isCliEligible('balance')).toBe(false);
  });
});
