/**
 * The selection toolbar acts on mousedown (so the text selection survives the
 * press). A keyboard user who Tabs onto a button and presses Enter/Space fires a
 * click with detail 0 and no mousedown — which did nothing. Keyboard clicks now
 * act; a mouse press still acts exactly once (mousedown, not its trailing click).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { SelectionToolbar } from '@/components/cli/TerminalOutput/SelectionToolbar';

afterEach(cleanup);

function setup() {
  const handlers = { onCopy: vi.fn(), onSearch: vi.fn(), onFix: vi.fn() };
  const containerRef = createRef<HTMLDivElement>();
  const { container } = render(
    <div ref={containerRef}>
      <SelectionToolbar
        state={{ text: 'error C2065', anchorX: 50, anchorTop: 40, anchorBottom: 52 }}
        containerRef={containerRef}
        {...handlers}
      />
    </div>,
  );
  const button = (title: string) => container.querySelector(`button[title="${title}"]`) as HTMLButtonElement;
  return { handlers, button };
}

describe('SelectionToolbar — keyboard activation', () => {
  it.each([
    ['Copy selected text', 'onCopy'],
    ['Search in project', 'onSearch'],
    ['Fix with Claude', 'onFix'],
  ] as const)('a keyboard click on "%s" runs %s', (title, handler) => {
    const { handlers, button } = setup();
    fireEvent.click(button(title), { detail: 0 });
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
  });

  it('a mouse press runs the action once, not twice', () => {
    const { handlers, button } = setup();
    fireEvent.mouseDown(button('Copy selected text'));
    fireEvent.click(button('Copy selected text'), { detail: 1 });
    expect(handlers.onCopy).toHaveBeenCalledTimes(1);
  });
});
