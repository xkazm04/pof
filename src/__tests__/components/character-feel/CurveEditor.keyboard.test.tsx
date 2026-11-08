import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Gauge } from 'lucide-react';
import { CurveEditor } from '@/components/modules/core-engine/sub_character/playground/CurveEditor';
import { MovementStateMachine } from '@/components/modules/core-engine/sub_character/movement/MovementStateMachine';
import type { CurvePoint } from '@/components/modules/core-engine/sub_character/playground/types';

afterEach(() => cleanup());

const POINTS: CurvePoint[] = [
  { x: 0, y: 0 }, { x: 0.25, y: 0.3 }, { x: 0.5, y: 0.6 }, { x: 0.75, y: 0.9 }, { x: 1, y: 1 },
];

function renderCurve(onChange = vi.fn(), points = POINTS) {
  render(
    <CurveEditor
      label="Acceleration" icon={Gauge} color="var(--accent)" points={points}
      onChange={onChange} xLabel="Time" yLabel="Speed"
    />,
  );
  return onChange;
}

/* The curve handles were pointer-only: the Playground's core edit was unreachable
 * from the keyboard. Each draggable handle is now a focusable slider. */
describe('CurveEditor — keyboard-operable handles', () => {
  it('exposes one slider per draggable point (3 of 5 by default)', () => {
    renderCurve();
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(3);
    expect(sliders[0].getAttribute('tabindex')).toBe('0');
    expect(sliders[0].getAttribute('aria-valuenow')).toBe('30');
    expect(sliders[0].getAttribute('aria-valuemin')).toBe('0');
    expect(sliders[0].getAttribute('aria-valuemax')).toBe('100');
    expect(sliders[0].getAttribute('aria-valuetext')).toContain('Time 0.25');
  });

  it('ArrowUp raises y and ArrowRight moves x through onChange', () => {
    const onChange = renderCurve();
    const [first] = screen.getAllByRole('slider');
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    const afterUp = onChange.mock.calls[0][0] as CurvePoint[];
    expect(afterUp[1].y).toBeCloseTo(0.32, 5);
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const afterRight = onChange.mock.calls[1][0] as CurvePoint[];
    expect(afterRight[1].x).toBeCloseTo(0.27, 5);
  });

  it('respects the neighbour X constraint the drag uses', () => {
    const tight: CurvePoint[] = [
      { x: 0, y: 0 }, { x: 0.48, y: 0.3 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 },
    ];
    const onChange = renderCurve(vi.fn(), tight);
    const [first] = screen.getAllByRole('slider');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const next = onChange.mock.calls[0][0] as CurvePoint[];
    expect(next[1].x).toBeLessThanOrEqual(0.5 - 0.02 + 1e-9);
  });
});

describe('MovementStateMachine — keyboard-reachable nodes', () => {
  it('every state node takes focus and focus reveals its transition labels like hover', () => {
    const { container } = render(<MovementStateMachine />);
    const nodes = screen.getAllByRole('button', { name: /state/i });
    expect(nodes).toHaveLength(5);
    expect(container.textContent).not.toContain('Release');
    fireEvent.focus(nodes[0]);
    expect(container.textContent).toContain('Input');
    fireEvent.blur(nodes[0]);
    expect(container.textContent).not.toContain('Input');
  });
});
