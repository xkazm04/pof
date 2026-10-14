import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, act, renderHook } from '@testing-library/react';
import { useStateMachineEditor } from '@/components/modules/content/animations/StateMachineEditor/useStateMachineEditor';

afterEach(cleanup);

// Canvas is 1000x400 at (0,0) so 1% = 10px horizontally, 4px vertically.
const RECT = { left: 0, top: 0, width: 1000, height: 400, right: 1000, bottom: 400, x: 0, y: 0 } as DOMRect;
const ev = (clientX: number, clientY: number) => ({ clientX, clientY }) as unknown as React.MouseEvent;

function setup() {
  const hook = renderHook(() => useStateMachineEditor());
  const { canvasRef } = hook.result.current;
  (canvasRef as { current: unknown }).current = { getBoundingClientRect: () => RECT };
  const s = hook.result.current.states[0];
  return { hook, id: s.id, x: s.x, y: s.y };
}

describe('state node drag: movement threshold + grab offset', () => {
  it('a press with 2px of travel does not move or dirty the node', () => {
    const { hook, id, x, y } = setup();
    const px = x * 10 + 30; // press 30px right of the stored anchor, inside the node
    const py = y * 4 + 8;
    act(() => { (hook.result.current as any).beginDrag(id, px, py); });
    act(() => { hook.result.current.handleCanvasMouseMove(ev(px + 2, py + 1)); });
    act(() => { hook.result.current.handleCanvasMouseUp(); });
    const after = hook.result.current.states.find((s) => s.id === id)!;
    expect([after.x, after.y]).toEqual([x, y]);
  });

  it('past the threshold the node moves by the pointer delta (no jump to cursor)', () => {
    const { hook, id, x, y } = setup();
    const px = x * 10 + 30;
    const py = y * 4 + 8;
    act(() => { (hook.result.current as any).beginDrag(id, px, py); });
    act(() => { hook.result.current.handleCanvasMouseMove(ev(px + 100, py)); });
    const after = hook.result.current.states.find((s) => s.id === id)!;
    expect(after.x).toBeCloseTo(Math.min(100, x + 10), 5);
    expect(after.y).toBeCloseTo(y, 5);
  });

  it('Escape-style cancel restores the origin', () => {
    const { hook, id, x, y } = setup();
    act(() => { (hook.result.current as any).beginDrag(id, 100, 100); });
    act(() => { hook.result.current.handleCanvasMouseMove(ev(300, 200)); });
    act(() => { (hook.result.current as any).cancelDrag(); });
    const after = hook.result.current.states.find((s) => s.id === id)!;
    expect([after.x, after.y]).toEqual([x, y]);
    expect(hook.result.current.draggingStateId).toBeNull();
  });
});
