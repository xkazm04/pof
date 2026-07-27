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
  nextSeq,
  selectionSource,
  pruneHistory,
  GEN_HISTORY_KEY,
  MAX_KEPT_BATCHES,
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
    // Re-selecting the SAME candidate is a no-op once the choice is already human…
    const human = selectCandidate(h, h.selectedId!);
    expect(human.selectedId).toBe(h.selectedId);
    expect(selectCandidate(human, human.selectedId!)).toBe(human);
    // …but clicking the machine's auto-pick is an explicit human confirmation, so it
    // clears the auto flag (see the selection-provenance tests below).
    expect(h.autoSelected).toBe(true);
    expect(human.autoSelected).toBe(false);
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

  describe('selection provenance (auto-picked vs human-chosen)', () => {
    it('appendBatch records the auto-pick as MACHINE selection', () => {
      const h = appendBatch(emptyHistory(), batch(0, 'first', 3));
      expect(h.autoSelected).toBe(true);
      expect(selectionSource(h)).toBe('auto');
    });

    it('a human reselect clears the flag, and a re-roll re-arms it', () => {
      let h = appendBatch(emptyHistory(), batch(0, 'first', 3));
      h = selectCandidate(h, 'b0-c2');
      expect(selectionSource(h)).toBe('human');
      // A fresh Produce auto-picks again — the claim reverts to `auto`, honestly.
      h = appendBatch(h, batch(1, 'reroll', 3));
      expect(selectionSource(h)).toBe('auto');
      expect(h.selectedId).toBe('b1-c0');
    });

    it('nothing selected reads as `none`', () => {
      expect(selectionSource(emptyHistory())).toBe('none');
    });

    it('a legacy history (no flag) reads as `unrecorded`, never as human', () => {
      const legacy: GenHistory = { batches: [batch(0, 'first', 2)], selectedId: 'b0-c0' };
      // Round-trips through readHistory without back-filling a claim nobody made.
      const read = readHistory({ [GEN_HISTORY_KEY]: legacy });
      expect(read.autoSelected).toBeUndefined();
      expect(selectionSource(read)).toBe('unrecorded');
    });

    it('the flag persists through historyData + readHistory (backward compatible shape)', () => {
      let h = appendBatch(emptyHistory(), batch(0, 'first', 2));
      h = selectCandidate(h, 'b0-c1');
      const round = readHistory(historyData(h));
      expect(selectionSource(round)).toBe('human');
      expect(round.selectedId).toBe('b0-c1');
    });

    it('provenance survives pruning (the flag is carried, not reset)', () => {
      let h = emptyHistory();
      for (let i = 0; i < MAX_KEPT_BATCHES + 3; i++) h = appendBatch(h, batch(nextSeq(h), `roll ${i}`, 2));
      h = selectCandidate(h, h.batches[h.batches.length - 1].candidates[1].id);
      expect(selectionSource(h)).toBe('human');
    });
  });

  describe('bounded history', () => {
    // Build a history by repeatedly appending, minting each seq the way the hook does.
    const grow = (n: number): GenHistory => {
      let h = emptyHistory();
      for (let i = 0; i < n; i++) h = appendBatch(h, batch(nextSeq(h), `roll ${i}`, 2));
      return h;
    };

    it('nextSeq is one past the highest surviving batch id, not batches.length', () => {
      expect(nextSeq(emptyHistory())).toBe(0);
      const h = appendBatch(appendBatch(emptyHistory(), batch(0, 'a', 2)), batch(1, 'b', 2));
      expect(nextSeq(h)).toBe(2);
    });

    it('appendBatch caps the history at MAX_KEPT_BATCHES, keeping the most recent', () => {
      const h = grow(MAX_KEPT_BATCHES + 5);
      expect(h.batches).toHaveLength(MAX_KEPT_BATCHES);
      // Oldest survivor is the 6th batch minted (b5); newest is the last (b16).
      expect(h.batches[0].id).toBe('b5');
      expect(h.batches[h.batches.length - 1].id).toBe(`b${MAX_KEPT_BATCHES + 4}`);
    });

    it('mints unique batch ids across pruning (no bN collision after the window slides)', () => {
      const h = grow(MAX_KEPT_BATCHES + 8);
      const ids = h.batches.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length); // all unique
      // The next seq is monotonic past every surviving id, so a fresh batch can't collide.
      const seq = nextSeq(h);
      expect(ids).not.toContain(`b${seq}`);
      const grown = appendBatch(h, batch(seq, 'fresh', 2));
      expect(grown.batches.map((b) => b.id).filter((id) => id === `b${seq}`)).toHaveLength(1);
    });

    it('never prunes the batch owning the selected candidate, even when it ages out', () => {
      // Raw over-cap history whose selection points at the OLDEST batch (b0-c1).
      const raw: GenHistory = { batches: [], selectedId: 'b0-c1' };
      for (let i = 0; i < MAX_KEPT_BATCHES + 5; i++) raw.batches.push(batch(i, `roll ${i}`, 2));
      const pruned = pruneHistory(raw, MAX_KEPT_BATCHES);
      // The selected (oldest) batch survives even though it is outside the recency window.
      expect(pruned.batches.some((b) => b.id === 'b0')).toBe(true);
      expect(selectedCandidate(pruned)?.id).toBe('b0-c1');
      // It is kept IN ADDITION to the last `cap` batches.
      expect(pruned.batches).toHaveLength(MAX_KEPT_BATCHES + 1);
    });

    it('pruneHistory returns the same reference when nothing is dropped', () => {
      const h = grow(3);
      expect(pruneHistory(h)).toBe(h);
    });
  });
});
