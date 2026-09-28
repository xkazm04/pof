import { describe, it, expect } from 'vitest';
import { decide } from '@/lib/one-shot/skip-policy';
import type { ViewDescriptor } from '@/lib/catalog/stepSpec';

const view = (kind: ViewDescriptor['kind']): ViewDescriptor => ({ kind } as ViewDescriptor);

describe('skip-policy.decide', () => {
  it('gallery → skip-needs-art regardless of tier', () => {
    for (const tier of ['L0', 'L1', 'L2', 'L3', 'L4'] as const) {
      expect(decide('gallery', tier, view('gallery'))).toEqual({ mode: 'skip-needs-art' });
    }
  });

  it('L3 → defer-runtime', () => {
    expect(decide('brief', 'L3', view('prose'))).toEqual({ mode: 'defer-runtime', tier: 'L3' });
    expect(decide('schema', 'L3', view('table'))).toEqual({ mode: 'defer-runtime', tier: 'L3' });
  });

  it('L4 → defer-runtime tier L4', () => {
    expect(decide('schema', 'L4', view('table'))).toEqual({ mode: 'defer-runtime', tier: 'L4' });
  });

  it('brief → run-cli', () => {
    expect(decide('brief', 'L0', view('prose'))).toEqual({ mode: 'run-cli' });
  });

  it('graph → run-cli', () => {
    expect(decide('graph', 'L0', view('graph'))).toEqual({ mode: 'run-cli' });
  });

  it('table-style rules → run-deterministic by default', () => {
    expect(decide('rules', 'L0', view('table'))).toEqual({ mode: 'run-deterministic' });
  });

  // catalog-pipelines/B — one CLI-eligibility rule (brief/graph/rules) shared with the lab:
  // an operator override is honoured for those archetypes only.
  it('rules with a cli override → run-cli', () => {
    expect(decide('rules', 'L0', view('table'), { autoMode: 'cli' })).toEqual({ mode: 'run-cli' });
  });

  it('schema ignores a cli override (not model-authorable)', () => {
    expect(decide('schema', 'L0', view('table'), { autoMode: 'cli' })).toEqual({ mode: 'run-deterministic' });
  });

  it('[guard] gallery and L3 are immune to a cli override; no hint keeps the default', () => {
    expect(decide('gallery', 'L0', view('gallery'), { autoMode: 'cli' })).toEqual({ mode: 'skip-needs-art' });
    expect(decide('rules', 'L3', view('table'), { autoMode: 'cli' })).toEqual({ mode: 'defer-runtime', tier: 'L3' });
    expect(decide('rules', 'L0', view('table'))).toEqual({ mode: 'run-deterministic' });
  });

  it('a brief can be sent to its built-in produce by override', () => {
    expect(decide('brief', 'L0', view('prose'), { autoMode: 'deterministic' })).toEqual({ mode: 'run-deterministic' });
  });

  it('schema/balance/checklist/manifest → run-deterministic', () => {
    for (const a of ['schema', 'balance', 'checklist', 'manifest'] as const) {
      expect(decide(a, 'L0', view('table'))).toEqual({ mode: 'run-deterministic' });
    }
  });

  it('custom uses autoMode hint', () => {
    expect(decide('custom', 'L0', view('table'), { autoMode: 'cli' })).toEqual({ mode: 'run-cli' });
    expect(decide('custom', 'L0', view('table'), { autoMode: 'skip' })).toEqual({ mode: 'skip-needs-art' });
    expect(decide('custom', 'L0', view('table'), undefined)).toEqual({ mode: 'run-deterministic' });
  });
});
