import { describe, it, expect } from 'vitest';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';

describe('StepSpec contract', () => {
  it('a spec produces output and derives acceptance from it', () => {
    const spec: StepSpec = {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e) => ({ data: { brief: `${e.name} is a thing `.repeat(40) } }),
      accept: minLength('brief', 'Brief ≥ 300 chars', 300),
    };
    const out = spec.produce({ id: 'x', name: 'Sword', lifecycle: 'planned', data: {} });
    expect(spec.accept(out.data ?? {}).status).toBe('pass');
    expect(spec.view.kind).toBe('prose');
  });
});
