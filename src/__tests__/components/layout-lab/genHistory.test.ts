import { describe, it, expect } from 'vitest';
import {
  emptyHistory,
  readHistory,
  makeBatch,
  appendBatch,
  selectCandidate,
  selectedCandidate,
  allCandidates,
  batchOf,
  historyData,
  GEN_HISTORY_KEY,
  type GenHistory,
} from '@/components/layout-lab/steps/shared/genHistory';

const batch = (seq: number, direction: string, n: number, at = '2026-05-27T00:00:00.000Z') =>
  makeBatch({
    seq,
    at,
    direction,
    prompt: `prompt for ${direction}`,
    candidates: Array.from({ length: n }, (_, i) => ({ swatch: `grad-${seq}-${i}`, payload: { selected: i } })),
  });

describe('genHistory model', () => {
  it('emptyHistory has no batches and nothing selected', () => {
    const h = emptyHistory();
    expect(h.batches).toEqual([]);
    expect(h.selectedId).toBeNull();
  });

  it('makeBatch stamps stable ids, the timestamp, and the direction/prompt', () => {
    const b = batch(0, 'weathered steel', 4);
    expect(b.id).toBe('b0');
    expect(b.candidates).toHaveLength(4);
    expect(b.candidates.map((c) => c.id)).toEqual(['b0-c0', 'b0-c1', 'b0-c2', 'b0-c3']);
    expect(b.direction).toBe('weathered steel');
    expect(b.prompt).toBe('prompt for weathered steel');
    expect(b.at).toBe('2026-05-27T00:00:00.000Z');
  });

  it('appendBatch accumulates batches and auto-selects the new batch first candidate', () => {
    const h1 = appendBatch(emptyHistory(), batch(0, 'first', 4));
    expect(h1.batches).toHaveLength(1);
    expect(h1.selectedId).toBe('b0-c0');

    const h2 = appendBatch(h1, batch(1, 'reroll', 4));
    // prior batch is preserved (history, not discarded) — the core of the feature
    expect(h2.batches).toHaveLength(2);
    expect(h2.batches[0].candidates).toHaveLength(4);
    // a fresh generation defaults selection to the new batch
    expect(h2.selectedId).toBe('b1-c0');
  });

  it('selectCandidate re-selects an older candidate across re-rolls', () => {
    let h = appendBatch(emptyHistory(), batch(0, 'first', 4));
    h = appendBatch(h, batch(1, 'reroll', 4));
    expect(h.selectedId).toBe('b1-c0');

    const back = selectCandidate(h, 'b0-c2');
    expect(back.selectedId).toBe('b0-c2');
    // re-selecting does not mutate or drop any batch
    expect(back.batches).toHaveLength(2);
  });

  it('selectCandidate ignores unknown ids (returns the same reference)', () => {
    const h = appendBatch(emptyHistory(), batch(0, 'first', 2));
    expect(selectCandidate(h, 'nope')).toBe(h);
    expect(selectCandidate(h, h.selectedId!)).toBe(h); // no-op when already selected
  });

  it('selectedCandidate / batchOf resolve the selected candidate and its batch', () => {
    let h = appendBatch(emptyHistory(), batch(0, 'first', 3));
    h = appendBatch(h, batch(1, 'reroll', 3));
    h = selectCandidate(h, 'b0-c1');
    expect(selectedCandidate(h)?.id).toBe('b0-c1');
    expect(batchOf(h, 'b0-c1')?.direction).toBe('first');
    expect(allCandidates(h)).toHaveLength(6);
  });

  it('readHistory tolerates missing/legacy data and round-trips genHistory', () => {
    expect(readHistory(undefined)).toEqual(emptyHistory());
    expect(readHistory({})).toEqual(emptyHistory());
    expect(readHistory({ selected: 0 })).toEqual(emptyHistory()); // legacy: no batches
    const h = appendBatch(emptyHistory(), batch(0, 'first', 2));
    expect(readHistory({ [GEN_HISTORY_KEY]: h })).toEqual(h);
  });

  it('historyData projects the selected candidate payload + carries the history', () => {
    let h = appendBatch(emptyHistory(), batch(0, 'first', 4)); // selects b0-c0 → payload { selected: 0 }
    h = selectCandidate(h, 'b0-c2'); // payload { selected: 2 }
    const data = historyData(h, { cap: 6000 });
    expect(data.selected).toBe(2);      // projected from the selected candidate
    expect(data.cap).toBe(6000);        // extra fields preserved
    expect((data[GEN_HISTORY_KEY] as GenHistory).selectedId).toBe('b0-c2');
  });

  it('historyData with nothing selected still carries the history and extras', () => {
    const data = historyData(emptyHistory(), { tris: 0 });
    expect(data.tris).toBe(0);
    expect((data[GEN_HISTORY_KEY] as GenHistory).batches).toEqual([]);
  });
});
