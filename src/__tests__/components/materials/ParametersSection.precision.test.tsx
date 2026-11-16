import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Gem } from 'lucide-react';

import { ParametersSection } from '@/components/modules/content/materials/MaterialParameterConfigurator/ParametersSection';
import { BASE_PARAMS } from '@/components/modules/content/materials/MaterialParameterConfigurator/constants';
import type { ParamDef, SurfaceDef } from '@/components/modules/content/materials/MaterialParameterConfigurator/types';

afterEach(cleanup);

/**
 * The slider readout used `toFixed(step < 1 ? 2 : 0)`. A live parent's scalar
 * over a small range (0 – 0.07, step 0.0007) then read "0.00" at every value
 * below 0.005, and the screen-reader valuetext said the same — the designer
 * could not see what would dispatch. Precision must follow the step.
 */

const SURFACE: SurfaceDef = {
  id: 'stone', label: 'Stone', icon: Gem, color: 'var(--text)', description: '', defaultFeatures: [], plain: '',
};

function param(over: Partial<ParamDef>): ParamDef {
  return {
    name: 'Probe', label: 'Probe', min: 0, max: 1, defaultValue: 0, step: 0.01,
    plain: { label: 'Probe', explanation: '', cue: 'level', lowLabel: 'Low', highLabel: 'High' },
    ...over,
  };
}

function readout(p: ParamDef, value: number): { shown: string; valueText: string } {
  const { container } = render(
    <ParametersSection applicableParams={[p]} paramValues={{ [p.name]: value }} explainMode={false} surfaceDef={SURFACE} setParam={() => {}} />,
  );
  const shown = container.querySelector('span.font-mono')?.textContent ?? '';
  const valueText = container.querySelector('input[type="range"]')?.getAttribute('aria-valuetext') ?? '';
  cleanup();
  return { shown, valueText };
}

describe('ParametersSection readout precision', () => {
  it('shows a sub-hundredth value on a fine-step slider', () => {
    const r = readout(param({ min: 0, max: 0.07, step: 0.0007 }), 0.0035);
    expect(r.shown).toBe('0.0035');
    expect(r.valueText.startsWith('0.0035 ')).toBe(true);
  });

  it('keeps every built-in parameter readout unchanged (two decimals below a unit step)', () => {
    for (const p of BASE_PARAMS) {
      expect(readout(p, p.defaultValue).shown).toBe(p.defaultValue.toFixed(2));
    }
  });

  it('shows whole numbers on an integer step', () => {
    expect(readout(param({ min: 0, max: 1000, step: 10 }), 340).shown).toBe('340');
  });
});
