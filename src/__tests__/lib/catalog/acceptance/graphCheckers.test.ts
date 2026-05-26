import { describe, it, expect } from 'vitest';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';

const checker = graphValid('graph', 'Objective graph is reachable + has a terminal');

const validGraph = {
  graph: {
    nodes: [
      { id: 'start', label: 'Accept' },
      { id: 'middle', label: 'Do thing' },
      { id: 'end', label: 'Resolve', terminal: true },
    ],
    edges: [
      { from: 'start', to: 'middle' },
      { from: 'middle', to: 'end' },
    ],
  },
};

describe('graphValid', () => {
  it('pass: valid graph with a terminal node', () => {
    const r = checker(validGraph);
    expect(r).toMatchObject({ tier: 'L0', status: 'pass' });
    expect(r.detail).toContain('3 nodes');
    expect(r.detail).toContain('2 edges');
    expect(r.detail).toContain('reachable');
  });

  it('fail: dangling edge (references a missing node)', () => {
    const r = checker({
      graph: {
        nodes: [{ id: 'start' }, { id: 'end', terminal: true }],
        edges: [{ from: 'start', to: 'ghost' }],
      },
    });
    expect(r).toMatchObject({ tier: 'L0', status: 'fail', detail: 'dangling edge' });
    expect(r.reason).toContain('start→ghost');
  });

  it('fail: unreachable node', () => {
    const r = checker({
      graph: {
        nodes: [{ id: 'start' }, { id: 'island' }, { id: 'end', terminal: true }],
        edges: [{ from: 'start', to: 'end' }],
      },
    });
    expect(r).toMatchObject({ tier: 'L0', status: 'fail' });
    expect(r.detail).toContain('1 unreachable');
    expect(r.reason).toContain('island');
  });

  it('pending: no terminal node', () => {
    const r = checker({
      graph: {
        nodes: [{ id: 'start' }, { id: 'end' }],
        edges: [{ from: 'start', to: 'end' }],
      },
    });
    expect(r).toMatchObject({ tier: 'L0', status: 'pending', detail: 'no terminal node' });
  });

  it('pending: empty graph (no nodes)', () => {
    const r = checker({ graph: {} });
    expect(r).toMatchObject({ tier: 'L0', status: 'pending', detail: 'no graph' });
  });

  it('pending: field absent', () => {
    const r = checker({});
    expect(r).toMatchObject({ tier: 'L0', status: 'pending', detail: 'no graph' });
  });
});
