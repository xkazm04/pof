import { describe, it, expect } from 'vitest';
import * as types from '@/components/modules/core-engine/sub_combat/choreography/types';
import * as slider from '@/components/modules/core-engine/sub_combat/choreography/TuningSlider';

// Placed-enemy ids come from the draft store's `nextSeq` (encounterReducer), so a
// module-level id counter in types.ts is a second, unused id source; StatBox had
// no renderer. Zero consumers each (grep) - keep them from coming back.
describe('choreography module surface', () => {
  it('types.ts carries no module-level id counter', () => {
    expect('nextId' in types).toBe(false);
  });
  it('TuningSlider.tsx exports only the slider', () => {
    expect(Object.keys(slider)).toEqual(['TuningSlider']);
  });
});
