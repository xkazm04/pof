import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CenterSlider } from '@/components/ui/CenterSlider';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

describe('CenterSlider', () => {
  it('shows a signed delta readout relative to the neutral anchor', () => {
    const { rerender } = render(
      <CenterSlider value={135} min={50} max={200} neutral={100} onChange={() => {}} ariaLabel="Player HP multiplier" />,
    );
    expect(screen.getByText('+35%')).toBeTruthy(); // buff

    rerender(<CenterSlider value={80} min={50} max={200} neutral={100} onChange={() => {}} ariaLabel="Player HP multiplier" />);
    expect(screen.getByText('-20%')).toBeTruthy(); // nerf

    rerender(<CenterSlider value={100} min={50} max={200} neutral={100} onChange={() => {}} ariaLabel="Player HP multiplier" />);
    expect(screen.getByText('0%')).toBeTruthy(); // neutral
  });

  it('announces the delta via aria-valuetext and exposes the slider range', () => {
    render(<CenterSlider value={135} min={50} max={200} neutral={100} onChange={() => {}} ariaLabel="Player HP multiplier" />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuetext')).toBe('+35%');
    expect(slider.getAttribute('aria-label')).toBe('Player HP multiplier');
    expect(slider.getAttribute('min')).toBe('50');
    expect(slider.getAttribute('max')).toBe('200');
  });

  it('reports the raw numeric value on change', () => {
    const onChange = vi.fn();
    render(<CenterSlider value={100} min={50} max={200} neutral={100} onChange={onChange} ariaLabel="x" />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '150' } });
    expect(onChange).toHaveBeenCalledWith(150);
  });
});
