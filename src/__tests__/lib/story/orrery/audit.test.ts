import { describe, it, expect } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import { buildAudit, editDistance, isTwinName, walkCond, condReadVars } from '@/lib/story/orrery/audit';
import type { AuditGroup, OrreryModel } from '@/lib/story/orrery/types';
import type { StoryGraph } from '@/lib/story/types';
import { FIXTURES_AVAILABLE, loadGraph, loadSeededDefects } from './_fixtures';

/**
 * `synthetic-scale.json` carries 27 deliberately seeded defects and `seeded-defects.json` is the
 * answer key. The key is read HERE and nowhere else: `src/lib/story/orrery/*` must find these
 * generically or not at all, so this test is the only place the two sides meet.
 */
const CODE_TO_GROUP: Record<string, string> = {
  ORPHAN_NODE: 'unreach',
  NO_ENDING_REACHABLE: 'dead',
  UNDECLARED_TERMINAL: 'term',
  FALSE_CHOICE: 'false',
  VAR_UNDECLARED: 'undecl',
  VAR_SINGLETON: 'undecl',
  VAR_DOMAIN_VIOLATION: 'domain',
  TEXT_BUDGET_EXCEEDED: 'budget',
  UNTYPED_CONDITION: 'expr',
};

describe.skipIf(!FIXTURES_AVAILABLE)('the audit finds the seeded defects', () => {
  // Built lazily, so a checkout without the contest arena skips instead of failing to collect.
  let cached: { raw: StoryGraph; model: OrreryModel } | null = null;
  const built = () => {
    if (!cached) {
      const raw = loadGraph('synthetic-scale');
      cached = { raw, model: buildOrreryModel(raw, 'synthetic') };
    }
    return cached;
  };
  const groupsOf = () => new Map<string, AuditGroup>(built().model.audit.map((g) => [g.id, g]));
  const idsIn = (id: string) => {
    const { model } = built();
    return new Set((groupsOf().get(id)?.items ?? []).map((it) => (it.i >= 0 ? model.R[it.i].id : '')));
  };
  const textOf = (id: string) => (groupsOf().get(id)?.items ?? []).map((it) => it.text).join('\n');

  it('surfaces every defect in the answer key', () => {
    const key = loadSeededDefects();
    expect(key.total).toBe(27);
    const missed: string[] = [];
    for (const d of key.defects) {
      const groupId = CODE_TO_GROUP[d.code];
      expect(groupId, `no group mapped for ${d.code}`).toBeDefined();
      const found = idsIn(groupId);
      const text = textOf(groupId);
      // A node-addressed defect is covered when one of its nodes carries the finding; a
      // variable-addressed one when the finding names the variable.
      const byNode = (d.nodes ?? []).some((n) => found.has(n));
      const byVar = (d.variables ?? []).some((v) => text.includes(v));
      const covered = d.variables?.length ? byVar : byNode;
      if (!covered) missed.push(`${d.code} ${(d.nodes ?? []).join(',')} ${(d.variables ?? []).join(',')}`);
    }
    expect(missed).toEqual([]);
  });

  it('counts each structural group as the brief states it', () => {
    expect(groupsOf().get('unreach')?.items.length).toBe(3); // ORPH1..3
    expect(groupsOf().get('term')?.items.length).toBe(6); // TERM1..6
    expect(groupsOf().get('false')?.items.length).toBe(5); // FALSE1..5
    expect(groupsOf().get('domain')?.items.length).toBe(2); // standing.ember set 420, lore push L-99
    expect(groupsOf().get('expr')?.items.length).toBe(1); // ACT7.hub
    expect(groupsOf().get('budget')?.items.length).toBe(3); // ACT{2,3,4}.Q1.e
    expect(groupsOf().get('undecl')?.items.length).toBe(5); // 4 undeclared names + 1 declared twin
    // An unreachable DECLARED ending is a separate promise the game cannot deliver. It is not in
    // the answer key; the audit finds it anyway.
    expect([...idsIn('ending')]).toEqual(['E.sealed']);
  });

  it('groups both seeded dead regions, and every other ending-less node with them', () => {
    const dead = idsIn('dead');
    // The two seeded regions: a pair of nodes that reach each other and nothing else.
    for (const id of ['DEAD1a', 'DEAD1b', 'DEAD2a', 'DEAD2b']) expect(dead.has(id)).toBe(true);
    // The six undeclared terminals also have no ending ahead of them, which is true and is
    // reported: co-reachability does not care why the path stopped.
    for (const id of ['TERM1', 'TERM2', 'TERM3', 'TERM4', 'TERM5', 'TERM6']) expect(dead.has(id)).toBe(true);
    expect(groupsOf().get('dead')?.items.length).toBe(10);
  });

  it('names the twin, and every undeclared name at the site that uses it', () => {
    const text = textOf('undecl');
    expect(text).toContain('rumuorHeard');
    expect(text).toContain('rumourHeard');
    // Each undeclared name is reported once, at the site that uses it. None of these four is
    // within editing distance of a declared name, so no nearest name is claimed for them.
    for (const name of ['curfewLifted', 'knowsTheSignal', 'oathSworn', 'ledgerSeen']) {
      expect(text).toContain(`"${name}" in a guard of`);
    }
    expect(text).not.toMatch(/nearest declared: /);
  });

  it('skips writer lists that look capped by the producer', () => {
    // Every writers list in this document holds exactly 40 ids — a cap, not an authority.
    const widest = Math.max(...built().raw.variables.map((v) => v.writers.length));
    expect(widest).toBe(40);
    expect(groupsOf().get('writer')?.items.length).toBe(0);
  });

  it('attaches a reason to the node that earned it, and nothing to a clean node', () => {
    const { model } = built();
    const flagged = model.R.filter((n) => n.flags !== null);
    expect(flagged.length).toBeGreaterThan(0);
    for (const n of flagged) expect(n.flags?.length).toBeGreaterThan(0);
    const byId = new Map(model.R.map((n) => [n.id, n]));
    expect(byId.get('ORPH1')?.flags).toEqual(['unreachable']);
    expect(byId.get('FALSE1')?.flags).toEqual(['false choice']);
    expect(byId.get('TERM1')?.flags).toContain('undeclared terminal');
    // The count propagates to containers so the rim can mark a sector that holds a defect.
    const root = model.R.find((n) => n.docks !== null);
    expect(root?.nFlag).toBeGreaterThan(10);
    // A node that earns nothing keeps null, never an empty array.
    const clean = model.R.find((n) => n.kind === 'event' && n.flags === null);
    expect(clean?.flags).toBeNull();
  });

  it('declares a severity and a why for every group', () => {
    const { model } = built();
    for (const g of model.audit) {
      expect(g.id.length).toBeGreaterThan(0);
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.why.length).toBeGreaterThan(0);
      expect(['error', 'warn', 'info']).toContain(g.severity);
    }
    expect(model.auditTotal).toBe(model.audit.reduce((s, g) => s + g.items.length, 0));
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('the audit on the documents with no seeded defects', () => {
  it('finds no structural errors in the two hand-transcribed documents', () => {
    for (const name of ['mage-arena-season', 'pof-exemplars'] as const) {
      const model = buildOrreryModel(loadGraph(name), name);
      const errors = model.audit.filter((g) => g.severity === 'error' && g.items.length > 0);
      expect(errors.map((g) => g.id), name).toEqual([]);
    }
  });

  it('still reports the writes that step outside a real writers list', () => {
    const model = buildOrreryModel(loadGraph('mage-arena-season'), 'mage');
    const writer = model.audit.find((g) => g.id === 'writer');
    // Short writers lists are an authority, so a write from outside one is a finding.
    expect(writer?.items.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('the audit is a pure function of its input', () => {
  it('does not mutate the node records it is given', () => {
    const raw = loadGraph('pof-exemplars');
    const model = buildOrreryModel(raw, 'pof');
    const before = model.R.map((n) => n.flags?.join('|') ?? null);
    const again = buildAudit({
      raw,
      nodes: model.R,
      idx: model.idx,
      order: model.order,
      root: model.R.findIndex((n) => n.docks !== null),
      out: model.out,
      inn: model.inn,
      tr: model.tr,
      // Re-deriving rank is not this test's business; the flags map is.
      rank: new Int32Array(model.R.length).fill(0),
      vars: new Map(raw.variables.map((v) => [v.name, v])),
    });
    expect(model.R.map((n) => n.flags?.join('|') ?? null)).toEqual(before);
    expect(again.flags instanceof Map).toBe(true);
  });
});

describe('the guard-grammar helpers', () => {
  it('walks all/any/not and resolves a definition reference', () => {
    const atoms: string[] = [];
    walkCond(
      { all: [{ var: 'a', op: '>=', value: 1 }, { not: { any: [{ ref: 'd1' }, { expr: 'hand-written' }] } }] },
      (atom) => atoms.push(JSON.stringify(atom)),
      { d1: { var: 'b', op: '==', value: true } },
    );
    expect(atoms).toEqual([
      '{"var":"a","op":">=","value":1}',
      '{"var":"b","op":"==","value":true}',
      '{"expr":"hand-written"}',
    ]);
  });

  it('does not hang on a definition that refers to itself', () => {
    const atoms: string[] = [];
    walkCond({ ref: 'loop' }, (a) => atoms.push(JSON.stringify(a)), { loop: { all: [{ ref: 'loop' }] } });
    expect(atoms).toEqual([]);
  });

  it('reads the variables a guard depends on, once each', () => {
    expect(condReadVars({ all: [{ var: 'x', op: '>', value: 1 }, { var: 'x', op: '<', value: 9 }] })).toEqual(['x']);
    expect(condReadVars(undefined)).toEqual([]);
    expect(condReadVars({ expr: 'anything' })).toEqual([]);
  });

  it('measures name distance and spots a transposed twin', () => {
    expect(editDistance('rumourHeard', 'rumuorHeard')).toBe(2);
    expect(isTwinName('rumourHeard', 'rumuorHeard')).toBe(true);
    expect(isTwinName('coin', 'coi')).toBe(false); // too short to judge
    expect(isTwinName('standing.ash', 'standing.tide')).toBe(false);
  });
});
