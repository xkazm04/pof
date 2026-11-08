import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ConfigInput } from '@/components/modules/core-engine/sub_inventory/economy-simulator/ConfigInput';

afterEach(cleanup);

function typeInto(raw: string): ReturnType<typeof vi.fn> {
  const onChange = vi.fn();
  const { container } = render(
    <ConfigInput label="Players" value={500} onChange={onChange} min={10} max={5000} step={50} />,
  );
  fireEvent.change(container.querySelector('input')!, { target: { value: raw } });
  cleanup();
  return onChange;
}

describe('Economy Simulator ConfigInput bounds', () => {
  it('clamps a typed value above max, so the synchronous Monte Carlo run stays inside its declared range', () => {
    expect(typeInto('999999').mock.calls[0][0]).toBe(5000);
  });

  it('maps a negative value to min', () => {
    expect(typeInto('-40').mock.calls[0][0]).toBe(10);
  });

  it('passes an in-range value through unchanged', () => {
    expect(typeInto('1200').mock.calls[0][0]).toBe(1200);
  });
});
