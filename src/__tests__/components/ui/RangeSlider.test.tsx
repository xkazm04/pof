import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { RangeSlider } from '@/components/ui/RangeSlider';

afterEach(cleanup);

const ACCENT = '#22d3ee';

describe('RangeSlider', () => {
  it('renders a range input reflecting value/min/max/step', () => {
    render(<RangeSlider value={120} min={30} max={300} step={10} accent={ACCENT} onChange={() => {}} ariaLabel="Save Interval" />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(input.value).toBe('120');
    expect(input.min).toBe('30');
    expect(input.max).toBe('300');
    expect(input.step).toBe('10');
    expect(input.getAttribute('aria-label')).toBe('Save Interval');
  });

  it('reports a numeric value through onChange', () => {
    const onChange = vi.fn();
    render(<RangeSlider value={100} min={50} max={500} accent={ACCENT} onChange={onChange} ariaLabel="Base XP" />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '250' } });
    expect(onChange).toHaveBeenCalledWith(250);
  });

  it('derives the accent (track + thumb) color from the accent prop', () => {
    // jsdom normalizes hex to rgb(); pass rgb form so the round-trip is exact.
    render(<RangeSlider value={1} min={0} max={2} accent="rgb(34, 211, 238)" onChange={() => {}} ariaLabel="x" />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(input.style.accentColor).toBe('rgb(34, 211, 238)');
  });

  it('carries the shared .focus-ring class for keyboard users', () => {
    render(<RangeSlider value={1} min={0} max={2} accent={ACCENT} onChange={() => {}} ariaLabel="x" />);
    expect(screen.getByRole('slider').className).toContain('focus-ring');
  });

  it('renders tick labels', () => {
    render(<RangeSlider value={1.5} min={1.1} max={2.5} accent={ACCENT} onChange={() => {}} ariaLabel="x" ticks={['Linear (1.1)', 'Steep (2.5)']} />);
    expect(screen.getByText('Linear (1.1)')).toBeTruthy();
    expect(screen.getByText('Steep (2.5)')).toBeTruthy();
  });

  it('shows a value bubble while dragging, formatted, and hides it after', () => {
    render(<RangeSlider value={1.5} min={1.1} max={2.5} accent={ACCENT} onChange={() => {}} ariaLabel="x" formatValue={(v) => v.toFixed(2)} />);
    const input = screen.getByRole('slider');
    expect(screen.queryByTestId('range-slider-bubble')).toBeNull();
    fireEvent.pointerDown(input);
    const bubble = screen.getByTestId('range-slider-bubble');
    expect(bubble.textContent).toBe('1.50');
    fireEvent.pointerUp(input);
    expect(screen.queryByTestId('range-slider-bubble')).toBeNull();
  });

  it('shows the value bubble on keyboard focus and hides it on blur', () => {
    render(<RangeSlider value={100} min={50} max={500} accent={ACCENT} onChange={() => {}} ariaLabel="x" />);
    const input = screen.getByRole('slider');
    fireEvent.focus(input);
    expect(screen.getByTestId('range-slider-bubble').textContent).toBe('100');
    fireEvent.blur(input);
    expect(screen.queryByTestId('range-slider-bubble')).toBeNull();
  });

  it('positions the bubble safely (no NaN) when min equals max', () => {
    render(<RangeSlider value={5} min={5} max={5} accent={ACCENT} onChange={() => {}} ariaLabel="x" />);
    fireEvent.focus(screen.getByRole('slider'));
    const bubble = screen.getByTestId('range-slider-bubble');
    expect(bubble.style.left).not.toContain('NaN');
  });
});
