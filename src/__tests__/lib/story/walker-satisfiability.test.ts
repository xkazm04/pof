/**
 * The Cond evaluator (three-valued) and domain-bounded satisfiability behind GUARD_UNSATISFIABLE.
 */
import { describe, it, expect } from 'vitest';
import { evalCond, guardSatisfiability, type EvalEnv, type SatContext } from '@/lib/story/satisfiability';
import type { Cond, StoryVariable } from '@/lib/story/types';

const v = (name: string, type: StoryVariable['type'], domain: StoryVariable['domain'], initial: unknown = null): StoryVariable =>
  ({ name, type, domain, initial, writers: [], scope: 'playthrough', external: false });

const VARS = [
  v('trust', 'int', { min: -100, max: 100 }, 0),
  v('heat', 'float', { min: 0, max: 1 }, 0),
  v('mood', 'enum', { values: ['cold', 'warm', 'sworn'] }, 'cold'),
  v('armed', 'bool', { values: [true, false] }, false),
  v('knows', 'string', { values: ['K-a', 'K-b'] }),
  v('name', 'string', {}),
];
const ctx: SatContext = {
  variables: new Map(VARS.map((x) => [x.name, x])),
  setVars: new Set(['knows']),
  axis: { name: 'day', unit: 'day', min: 0, max: 42 },
  definitions: { trusted: { var: 'trust', op: '>=', value: 60 }, loop: { ref: 'loop' } },
};
const sat = (c: Cond) => guardSatisfiability(c, ctx);

describe('guardSatisfiability', () => {
  it('numeric intervals, integrality and excluded points', () => {
    expect(sat({ var: 'trust', op: '>', value: 100 })).toBe('unsat');
    expect(sat({ var: 'trust', op: '>=', value: 100 })).toBe('sat');
    expect(sat({ all: [{ var: 'trust', op: '>', value: 3 }, { var: 'trust', op: '<', value: 4 }] })).toBe('unsat'); // int
    expect(sat({ all: [{ var: 'heat', op: '>', value: 0.3 }, { var: 'heat', op: '<', value: 0.4 }] })).toBe('sat'); // float
    expect(sat({ all: [{ var: 'trust', op: '>=', value: 5 }, { var: 'trust', op: '<=', value: 5 }, { var: 'trust', op: '!=', value: 5 }] })).toBe('unsat');
    expect(sat({ var: 'trust', op: 'in', value: [200, 300] })).toBe('unsat');
    expect(sat({ var: 'trust', op: '==', value: 'high' })).toBe('unsat');
  });

  it('value lists, negation and DNF', () => {
    expect(sat({ var: 'mood', op: '==', value: 'furious' })).toBe('unsat');
    expect(sat({ not: { var: 'mood', op: 'in', value: ['cold', 'warm', 'sworn'] } })).toBe('unsat');
    expect(sat({ any: [{ var: 'mood', op: '==', value: 'furious' }, { var: 'mood', op: '==', value: 'warm' }] })).toBe('sat');
    expect(sat({ all: [{ var: 'armed', op: '==', value: true }, { not: { var: 'armed', op: '!=', value: false } }] })).toBe('unsat');
  });

  it('sets (push-written), flags, axis, chance, refs', () => {
    expect(sat({ var: 'knows', op: 'in', value: ['K-a'] })).toBe('sat');
    expect(sat({ var: 'knows', op: 'in', value: ['K-z'] })).toBe('unsat');
    expect(sat({ all: [{ flag: 'X' }, { not: { flag: 'X' } }] })).toBe('unsat');
    expect(sat({ axis: { op: '>', value: 42 } })).toBe('unsat');
    expect(sat({ chance: 0 })).toBe('unsat');
    expect(sat({ not: { chance: 1 } })).toBe('unsat');
    expect(sat({ all: [{ ref: 'trusted' }, { var: 'trust', op: '<', value: 0 }] })).toBe('unsat');
  });

  it('never manufactures unsat from what it cannot read', () => {
    expect(sat({ all: [{ expr: 'player is sad' }, { var: 'trust', op: '>=', value: 0 }] })).toBe('unknown');
    expect(sat({ all: [{ expr: 'x' }, { var: 'trust', op: '>', value: 100 }] })).toBe('unsat'); // a known-false conjunct still kills
    expect(sat({ var: 'ghost', op: '==', value: 1 })).toBe('unknown');
    expect(sat({ ref: 'loop' })).toBe('unknown');
    expect(sat({ var: 'name', op: '==', value: 'Ada' })).toBe('sat');
  });
});

describe('evalCond (Kleene)', () => {
  const env: EvalEnv = {
    state: { trust: 10, knows: ['K-a'], mood: 'warm' },
    declared: new Set(['trust', 'knows', 'mood']),
    visited: new Set(['A']),
    fired: new Set(['A', 'take']),
    axis: 5,
    roll: () => true,
  };
  it('decides typed atoms and keeps untyped ones unknown', () => {
    expect(evalCond({ var: 'trust', op: '>=', value: 10 }, env)).toBe(true);
    expect(evalCond({ var: 'knows', op: 'in', value: ['K-b', 'K-a'] }, env)).toBe(true);
    expect(evalCond({ flag: 'take' }, env)).toBe(true);
    expect(evalCond({ visited: 'B' }, env)).toBe(false);
    expect(evalCond({ axis: { op: '<', value: 5 } }, env)).toBe(false);
    expect(evalCond({ expr: '?' }, env)).toBeNull();
    expect(evalCond({ all: [{ expr: '?' }, { var: 'trust', op: '<', value: 0 }] }, env)).toBe(false);
    expect(evalCond({ any: [{ expr: '?' }, { var: 'trust', op: '<', value: 0 }] }, env)).toBeNull();
    expect(evalCond({ var: 'undeclared', op: '==', value: 1 }, env)).toBeNull();
    expect(evalCond(undefined, env)).toBe(true);
  });
});
