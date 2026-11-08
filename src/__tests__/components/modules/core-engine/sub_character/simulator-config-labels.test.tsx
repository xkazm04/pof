import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ConfigPanel } from '@/components/modules/core-engine/sub_character/simulator/predictive/ConfigPanel';
import { DEFAULT_PREDICTIVE_CONFIG } from '@/components/modules/core-engine/sub_character/simulator/predictive/data';

afterEach(cleanup);

const noop = () => {};

/** A control is named when it carries aria-label/aria-labelledby or sits inside a <label>. */
const hasName = (el: Element) =>
  !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby') || !!el.closest('label');

describe('predictive ConfigPanel — every sweep control has an accessible name', () => {
  it('names all inputs and selects (CellTuner already does)', () => {
    const { container } = render(<ConfigPanel config={DEFAULT_PREDICTIVE_CONFIG} setConfig={noop} />);
    const controls = [...container.querySelectorAll('input, select')];
    expect(controls.length).toBeGreaterThan(0);
    const unnamed = controls.filter(c => !hasName(c));
    expect(unnamed.length).toBe(0);
  });

  it('exposes the level range, iterations, gear and level step by name', () => {
    render(<ConfigPanel config={DEFAULT_PREDICTIVE_CONFIG} setConfig={noop} />);
    expect(screen.getByLabelText('Lowest player level')).toBeTruthy();
    expect(screen.getByLabelText('Highest player level')).toBeTruthy();
    expect(screen.getByLabelText('Iterations')).toBeTruthy();
    expect(screen.getByLabelText('Gear')).toBeTruthy();
    expect(screen.getByLabelText('Level step')).toBeTruthy();
    expect(screen.getByLabelText('Encounter 1 archetype')).toBeTruthy();
    expect(screen.getByLabelText('Encounter 1 enemy count')).toBeTruthy();
  });
});
