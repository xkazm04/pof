import { describe, it, expect } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import { buildLineDetail } from '@/lib/story/orrery/detail';
import type { OrreryModel } from '@/lib/story/orrery/types';
import { FIXTURES_AVAILABLE, loadGraph } from './_fixtures';

describe.skipIf(!FIXTURES_AVAILABLE)('buildLineDetail', () => {
  // Built lazily, so a checkout without the contest arena skips instead of failing to collect.
  let cached: OrreryModel | null = null;
  const model = () => (cached ??= buildOrreryModel(loadGraph('synthetic-scale'), 'synthetic'));
  const ix = (id: string) => {
    const i = model().idx.get(id);
    if (i === undefined) throw new Error(`fixture changed: no node ${id}`);
    return i;
  };

  it('returns null outside the node range', () => {
    expect(buildLineDetail(model(), -1)).toBeNull();
    expect(buildLineDetail(model(), model().R.length)).toBeNull();
    expect(buildLineDetail(model(), 1.5)).toBeNull();
  });

  it('explains a line: the chain it sits in, what led here, and what it changes', () => {
    // A dialogue line deep inside a conversation: arc > act > quest > conversation > line.
    const i = ix('ACT1.Q1.D1.l3');
    const detail = buildLineDetail(model(), i);
    expect(detail).not.toBeNull();
    if (!detail) return;

    const chain = detail.situation.map((n) => n.id);
    expect(chain[chain.length - 1]).toBe('ACT1.Q1.D1.l3');
    expect(chain).toEqual(['ARC', 'ACT1', 'ACT1.Q1', 'ACT1.Q1.D1', 'ACT1.Q1.D1.l3']);
    expect(detail.situation[0].kind).toBe('container');

    expect(detail.predecessors.length).toBeGreaterThanOrEqual(1);
    for (const p of detail.predecessors) {
      // `contains` and `influences` are not traversal, so neither can appear here.
      expect(['then', 'option', 'gate']).toContain(p.edge.kind);
      expect(p.edge.to).toBe(i);
    }
    for (const s of detail.successors) {
      expect(['then', 'option', 'gate']).toContain(s.edge.kind);
      expect(s.edge.from).toBe(i);
    }

    expect(detail.impact.length).toBeGreaterThan(0);
    for (const w of detail.impact) {
      expect(typeof w.variable).toBe('string');
      expect(Array.isArray(w.readBy)).toBe(true);
      expect(typeof w.endingReads).toBe('boolean');
    }
    expect(detail.flags).toBe(model().R[i].flags);
    expect(detail.reach).toBe(model().R[i].reach);
  });

  it('computes readBy and endingReads from the document, not from a default', () => {
    // ACT1.Q1.c's options move standing.tide / standing.ember / standing.spire, and three of the
    // six declared endings read exactly those: this write is ending-shaping and must say so.
    const shaping = buildLineDetail(model(), ix('ACT1.Q1.c'));
    expect(shaping).not.toBeNull();
    const standing = shaping?.impact.filter((w) => w.variable.startsWith('standing.')) ?? [];
    expect(standing.length).toBeGreaterThan(0);
    for (const w of standing) {
      expect(w.endingReads).toBe(true);
      // Forward of this choice sit the act gates whose guards read the standings.
      expect(w.readBy.length).toBeGreaterThan(0);
      for (const r of w.readBy) expect(model().R[r].id.length).toBeGreaterThan(0);
    }

    // trust.* is written 4,800 times in this document and read by no guard and no ending. An
    // empty read set is the fact that makes a decoration visible, so it has to be honest.
    const quiet = buildLineDetail(model(), ix('ACT1.Q1.D1.l3'));
    const trust = quiet?.impact.filter((w) => w.variable.startsWith('trust.')) ?? [];
    expect(trust.length).toBeGreaterThan(0);
    for (const w of trust) {
      expect(w.endingReads).toBe(false);
      expect(w.readBy).toEqual([]);
    }
  });

  it('resolves both options of a false choice to the same read set', () => {
    const i = ix('FALSE1');
    expect(model().R[i].ch?.cls).toBe('false');
    const detail = buildLineDetail(model(), i);
    expect(detail).not.toBeNull();
    if (!detail) return;
    const options = detail.successors.filter((s) => s.edge.kind === 'option');
    expect(options.length).toBe(2);
    // One entry per write per edge, so both options are present with their own resolution.
    const writes = detail.impact.filter((w) => w.variable === 'trust.quill');
    expect(writes.length).toBeGreaterThanOrEqual(2);
    const resolutions = new Set(
      writes.map((w) => `${w.op}:${JSON.stringify(w.value)}|${w.readBy.join(',')}|${w.endingReads}`),
    );
    expect(resolutions.size).toBe(1);
  });

  it('carries the influence layer with its direction', () => {
    const touched = model().infl[0];
    const detail = buildLineDetail(model(), touched.from);
    expect(detail).not.toBeNull();
    const out = detail?.influences.filter((x) => x.direction === 'out') ?? [];
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((x) => x.node.i === touched.to)).toBe(true);
    const other = buildLineDetail(model(), touched.to);
    expect(other?.influences.some((x) => x.direction === 'in' && x.node.i === touched.from)).toBe(true);
  });

  it('is deterministic for the same node', () => {
    const a = buildLineDetail(model(), ix('ACT1.Q1.c'));
    const b = buildLineDetail(model(), ix('ACT1.Q1.c'));
    expect(JSON.stringify(b?.impact)).toBe(JSON.stringify(a?.impact));
    expect(b?.situation.map((n) => n.id)).toEqual(a?.situation.map((n) => n.id));
  });

  it('works on a document with no evidence and no axis', () => {
    const pof = buildOrreryModel(loadGraph('pof-exemplars'), 'pof');
    const i = pof.idx.get('Q.choose');
    expect(i).toBeDefined();
    const detail = buildLineDetail(pof, i as number);
    expect(detail).not.toBeNull();
    expect(detail?.reach).toBeNull(); // unmeasured, not zero
    expect(detail?.situation.length).toBeGreaterThan(1);
    expect(detail?.impact.length).toBeGreaterThan(0);
  });
});
