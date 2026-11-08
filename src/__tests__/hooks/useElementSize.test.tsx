/** useElementSize returns the fallback until a non-zero measurement arrives, then the measured size. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useElementSize } from '@/hooks/useElementSize';

const OriginalRO = globalThis.ResizeObserver;
afterEach(() => { cleanup(); vi.restoreAllMocks(); globalThis.ResizeObserver = OriginalRO; });

let fire: () => void = () => {};
let disconnected = 0;
class FakeRO {
  constructor(cb: () => void) { fire = cb; }
  observe() {}
  disconnect() { disconnected += 1; }
}

function Probe() {
  const [ref, size] = useElementSize<HTMLDivElement>({ width: 10, height: 20 });
  return <div ref={ref}>{size.width}x{size.height}</div>;
}

describe('useElementSize', () => {
  it('keeps the fallback for a zero-size frame, adopts a real one, disconnects on unmount', () => {
    globalThis.ResizeObserver = FakeRO as unknown as typeof ResizeObserver;
    disconnected = 0;
    const rect = { width: 0, height: 0 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect as DOMRect);
    const { container, unmount } = render(<Probe />);
    const el = container.firstElementChild as HTMLDivElement;
    expect(el.textContent).toBe('10x20');
    act(() => fire());
    expect(el.textContent).toBe('10x20');
    rect.width = 300;
    rect.height = 150;
    act(() => fire());
    expect(el.textContent).toBe('300x150');
    unmount();
    expect(disconnected).toBe(1);
  });

  it('returns the fallback when ResizeObserver is missing', () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    const { container } = render(<Probe />);
    expect((container.firstElementChild as HTMLElement).textContent).toBe('10x20');
  });
});
