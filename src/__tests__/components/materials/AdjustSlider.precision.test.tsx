import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { AdjustSlider } from '@/components/modules/content/materials/MaterialStyleTransfer/AdjustSlider';

afterEach(cleanup);

/**
 * The style-transfer readout used `v > 1 ? toFixed(1) : toFixed(2)`, so one
 * slider changed its decimal count mid-drag: Emissive (step 0.5) read
 * "0.50", "1.00", then "1.5". Precision must follow the step, as the
 * configurator's ParametersSection readout does (at least two decimals, as
 * many as the step carries, none for a unit-or-larger step).
 */

function readout(value: number, step: number, max: number, defaultValue = value): { shown: string; valueText: string } {
  const { container } = render(
    <AdjustSlider label="Probe" value={value} defaultValue={defaultValue} min={0} max={max} step={step} onChange={() => {}} onReset={() => {}} />,
  );
  const shown = container.querySelector('span.font-mono')?.textContent ?? '';
  const valueText = container.querySelector('input[type="range"]')?.getAttribute('aria-valuetext') ?? '';
  cleanup();
  return { shown, valueText };
}

describe('AdjustSlider readout precision', () => {
  it('keeps one decimal count across the whole Emissive range (step 0.5)', () => {
    const shown = [0, 0.5, 1, 1.5, 2, 7.5, 20].map((v) => readout(v, 0.5, 20).shown);
    expect(shown).toEqual(['0.00', '0.50', '1.00', '1.50', '2.00', '7.50', '20.00']);
    const decimalCounts = new Set(shown.map((s) => s.split('.')[1]?.length ?? 0));
    expect(decimalCounts.size).toBe(1);
  });

  it('keeps the Roughness / Metallic readouts at two decimals (step 0.05)', () => {
    expect([0, 0.35, 1].map((v) => readout(v, 0.05, 1).shown)).toEqual(['0.00', '0.35', '1.00']);
  });

  it('says the same figure in aria-valuetext and in the reset target', () => {
    const r = readout(1.5, 0.5, 20, 3);
    expect(r.valueText.startsWith('1.50 of 0 to 20')).toBe(true);
    expect(r.valueText).toContain('adjusted from the analyzed 3.00');
  });

  it('shows whole numbers on an integer step', () => {
    expect(readout(12, 1, 100).shown).toBe('12');
  });
});
