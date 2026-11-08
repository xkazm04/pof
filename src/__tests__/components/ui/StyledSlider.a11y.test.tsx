import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StyledSlider } from '@/components/ui/StyledSlider';
import { TuningSlider } from '@/components/modules/core-engine/sub_combat/choreography/TuningSlider';

afterEach(cleanup);

const base = { min: 0, max: 10, step: 1, value: 5, onChange: vi.fn() };

describe('StyledSlider accessible name', () => {
  it('wires the visible label to the range input', () => {
    const { container } = render(<StyledSlider {...base} label="Health %" />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    const id = input.getAttribute('aria-labelledby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)?.textContent).toBe('Health %');
  });

  it('takes an ariaLabel when the caller draws its own label', () => {
    const { container } = render(<StyledSlider {...base} ariaLabel="Speed" />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Speed');
    expect(input.getAttribute('aria-labelledby')).toBeNull();
  });

  it('announces the formatted value', () => {
    const { container } = render(<StyledSlider {...base} label="L" displayValue="50%" />);
    expect(container.querySelector('input')?.getAttribute('aria-valuetext')).toBe('50%');
  });

  it('names the combat tuning slider from its row label', () => {
    const { container } = render(
      <TuningSlider label="Aggression" value={1} defaultValue={1} onChange={vi.fn()} />,
    );
    expect(container.querySelector('input')?.getAttribute('aria-label')).toBe('Aggression');
  });
});
