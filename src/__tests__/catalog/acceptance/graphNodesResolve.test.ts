// /diablo W22: a cross-reference graph node written `<catalog>::<id>` claims an entity exists.
import { describe, it, expect } from 'vitest';
import { graphNodesResolve } from '@/lib/catalog/acceptance/graphCheckers';

const catalogs = () => new Set(['codex', 'quests', 'bestiary']);
const check = graphNodesResolve('graph', 'Cross-referenced entities exist', catalogs);
const ctx = (existing: string[]) => ({ catalog: 'codex', siblings: {}, has: (c: string, e: string) => existing.includes(`${c}::${e}`) });
const graph = (...ids: string[]) => ({ graph: { nodes: ids.map((id) => ({ id })), edges: [] } });

describe('graphNodesResolve', () => {
  it('passes plain concept nodes and catalog nodes that exist', () => {
    expect(check(graph('the-book', 'quests::q1'), ctx(['quests::q1'])).status).toBe('pass');
    expect(check(graph('concept-a'), ctx([])).status).toBe('pass');
  });
  it('fails a node in a catalog PoF does not have (an invented catalog)', () => {
    const r = check(graph('codex::me', 'locations::heaven'), ctx(['codex::me']));
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('locations::heaven');
  });
  it('defers a node naming an entity that does not exist, naming it', () => {
    const r = check(graph('codex::me', 'bestiary::nobody'), ctx(['codex::me']));
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('bestiary::nobody');
  });
});
