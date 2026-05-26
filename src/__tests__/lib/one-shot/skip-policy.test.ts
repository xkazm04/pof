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

  it('prose-style rules → run-cli; table-style rules → run-deterministic', () => {
    expect(decide('rules', 'L0', view('prose'))).toEqual({ mode: 'run-cli' });
    expect(decide('rules', 'L0', view('table'))).toEqual({ mode: 'run-deterministic' });
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
