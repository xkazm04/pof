import { describe, it, expect } from 'vitest';
import { buildProduceLog, summarizeProduceLog } from '@/components/layout-lab/produceLog';
import { PRODUCE_DIRECTION_KEY } from '@/lib/catalog/produceDirection';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';

const art = (over: Partial<LabStepArtifact> = {}): LabStepArtifact => ({
  done: true, data: {}, ueAssets: [], at: '2026-07-20T10:00:00.000Z', ...over,
});

const withDirection = (direction: string, prompt = '') =>
  ({ [PRODUCE_DIRECTION_KEY]: { direction, prompt } }) as Record<string, unknown>;

const steps = ['Concept', 'Art', 'Attributes', 'Economy'];

describe('buildProduceLog', () => {
  it('omits steps that were never produced and never failed', () => {
    const log = buildProduceLog(steps, { Art: art() });
    expect(log.map((e) => e.step)).toEqual(['Art']);
  });

  it('is empty when nothing has run', () => {
    expect(buildProduceLog(steps, {})).toEqual([]);
  });

  it('orders newest first', () => {
    const log = buildProduceLog(steps, {
      Concept: art({ at: '2026-07-20T09:00:00.000Z' }),
      Art: art({ at: '2026-07-20T11:00:00.000Z' }),
      Attributes: art({ at: '2026-07-20T10:00:00.000Z' }),
    });
    expect(log.map((e) => e.step)).toEqual(['Art', 'Attributes', 'Concept']);
  });

  it('carries the pipeline index so an entry can jump to its step', () => {
    const log = buildProduceLog(steps, { Attributes: art() });
    expect(log[0].index).toBe(2);
  });

  it('surfaces a step the pipeline no longer declares rather than dropping it', () => {
    const log = buildProduceLog(steps, { 'Retired Step': art() });
    expect(log[0].step).toBe('Retired Step');
    expect(log[0].index).toBe(-1);
  });

  it('reads back the direction the operator typed', () => {
    const log = buildProduceLog(steps, {
      Art: art({ data: withDirection('grimdark, muted palette', 'PROMPT') }),
    });
    expect(log[0].direction).toBe('grimdark, muted palette');
    expect(log[0].hadPrompt).toBe(true);
  });

  it('reports no prompt for a deterministic produce, rather than inventing one', () => {
    const log = buildProduceLog(steps, { Art: art({ data: withDirection('go', '') }) });
    expect(log[0].hadPrompt).toBe(false);
  });

  it('leaves the direction empty for an artifact produced before the stamp existed', () => {
    const log = buildProduceLog(steps, { Art: art({ data: { foo: 1 } }) });
    expect(log[0].direction).toBe('');
    expect(log[0].hadPrompt).toBe(false);
  });

  describe('outcome', () => {
    it('is produced for a clean run', () => {
      const log = buildProduceLog(steps, { Art: art() });
      expect(log[0].outcome).toBe('produced');
      expect(log[0].reason).toBe('');
    });

    it('is failed when a produce error is on record, with the reason verbatim', () => {
      const log = buildProduceLog(steps, { Art: art({ done: false, error: 'boom: bad payload' }) });
      expect(log[0].outcome).toBe('failed');
      expect(log[0].reason).toBe('boom: bad payload');
      expect(log[0].hasContent).toBe(false);
    });

    it('records that earlier content survived a later failed re-produce', () => {
      const log = buildProduceLog(steps, { Art: art({ done: true, error: 'retry blew up' }) });
      expect(log[0].outcome).toBe('failed');
      expect(log[0].hasContent).toBe(true);
    });

    it('is unsynced when the write-through failed, with the server reason verbatim', () => {
      const log = buildProduceLog(steps, { Art: art({ syncError: 'server said 500' }) });
      expect(log[0].outcome).toBe('unsynced');
      expect(log[0].reason).toBe('server said 500');
    });

    it('ranks a produce failure above a sync failure — the produce never happened', () => {
      const log = buildProduceLog(steps, { Art: art({ error: 'threw', syncError: 'also unsynced' }) });
      expect(log[0].outcome).toBe('failed');
      expect(log[0].reason).toBe('threw');
    });
  });

  it('timestamps a failure by WHEN IT FAILED, not by the last successful produce', () => {
    const log = buildProduceLog(steps, {
      Art: art({ at: '2026-07-20T10:00:00.000Z', error: 'boom', errorAt: '2026-07-20T12:00:00.000Z' }),
    });
    expect(log[0].at).toBe('2026-07-20T12:00:00.000Z');
  });

  it('falls back to the produce time when a legacy failure has no errorAt', () => {
    const log = buildProduceLog(steps, { Art: art({ at: '2026-07-20T10:00:00.000Z', error: 'boom' }) });
    expect(log[0].at).toBe('2026-07-20T10:00:00.000Z');
  });

  it('re-orders once a failure timestamp moves an entry to the front', () => {
    const log = buildProduceLog(steps, {
      Concept: art({ at: '2026-07-20T11:00:00.000Z' }),
      Art: art({ at: '2026-07-20T09:00:00.000Z', error: 'boom', errorAt: '2026-07-20T13:00:00.000Z' }),
    });
    expect(log.map((e) => e.step)).toEqual(['Art', 'Concept']);
  });

  it('carries the server verdict when one is known', () => {
    const log = buildProduceLog(steps, { Art: art({ status: 'deferred', tier: 'L3' }) });
    expect(log[0].status).toBe('deferred');
    expect(log[0].tier).toBe('L3');
  });
});

describe('summarizeProduceLog', () => {
  it('counts each outcome', () => {
    const log = buildProduceLog(steps, {
      Concept: art(),
      Art: art({ error: 'boom' }),
      Attributes: art({ syncError: 'unsynced' }),
      Economy: art(),
    });
    expect(summarizeProduceLog(log)).toEqual({ total: 4, produced: 2, failed: 1, unsynced: 1, needsAttention: 2 });
  });

  it('reports nothing needing attention on a clean entity', () => {
    const s = summarizeProduceLog(buildProduceLog(steps, { Art: art() }));
    expect(s.needsAttention).toBe(0);
  });

  it('is total over an empty log', () => {
    expect(summarizeProduceLog([])).toEqual({ total: 0, produced: 0, failed: 0, unsynced: 0, needsAttention: 0 });
  });
});
