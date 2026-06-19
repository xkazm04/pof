import type { GateAssertion } from '@/lib/test-gate-runner/types';

export interface AssertionToggles {
  moved?: boolean;
  animated?: boolean;
  montage?: boolean;
}

/** Map the scenario assertion checkboxes to GateAssertion[]. Pure. */
export function buildAssertions(t: AssertionToggles): GateAssertion[] {
  const a: GateAssertion[] = [];
  if (t.moved) a.push({ kind: 'moved' });
  if (t.animated) a.push({ kind: 'animated' });
  if (t.montage) a.push({ kind: 'montage-playing' });
  return a;
}
