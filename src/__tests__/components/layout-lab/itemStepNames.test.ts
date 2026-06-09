import { describe, it, expect, vi } from 'vitest';

// Importing the step registry pulls in the bespoke step components, some of which
// reach next/font/google at module scope — stub it so the import resolves headless.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { ITEM_STEP_NAMES, ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import { getStepComponent } from '@/components/layout-lab/steps';
import { labPipelineSteps } from '@/components/layout-lab/labPipelines';

/**
 * The 13 Items step labels are consumed by three lists that must stay identical:
 * the rendered pipeline timeline (`labPipelineSteps`), the bespoke-UI registry
 * (`getStepComponent`), and the step specs (`ITEM_STEP_SPECS`). All are now derived
 * from `ITEM_STEP_NAMES`; these tests fail loudly if that single source ever forks.
 */
describe('Items step names — single source of truth', () => {
  it('drives the rendered pipeline timeline from ITEM_STEP_NAMES', () => {
    expect(labPipelineSteps('items')).toEqual(ITEM_STEP_NAMES);
  });

  it('names match the ITEM_STEP_SPECS keys in order', () => {
    expect(ITEM_STEP_NAMES).toEqual(Object.keys(ITEM_STEP_SPECS));
  });

  it('routes every step to a distinct bespoke component (no placeholder fallthrough)', () => {
    const comps = ITEM_STEP_NAMES.map((name) => getStepComponent('items', name));
    expect(comps.every((c) => c != null)).toBe(true);
    expect(new Set(comps).size).toBe(ITEM_STEP_NAMES.length);
  });

  it('returns null for an unknown step name', () => {
    expect(getStepComponent('items', 'Not A Real Step')).toBeNull();
  });
});
