import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CommandCatalog } from '@/components/modules/core-engine/sub_debug/console/CommandCatalog';
import { CONSOLE_COMMANDS } from '@/components/modules/core-engine/sub_debug/_shared/data';

/**
 * scan-sweep night 2026-11-08 (debug-performance, accessibility-checker): a catalog
 * row was a click-only div and its RUN button was opacity-0 until mouse hover, so
 * a keyboard user could neither fill a command nor see the focused RUN button.
 * Every row now has a real populate button and RUN is visible on focus.
 */

afterEach(cleanup);

describe('CommandCatalog keyboard access', () => {
  it('every row exposes a real, tabbable populate button that fills the console', () => {
    const onPopulate = vi.fn();
    const { container } = render(<CommandCatalog onExecute={vi.fn()} onPopulate={onPopulate} isExecuting={false} />);
    const fills = Array.from(container.querySelectorAll('button[aria-label^="Fill console with"]')) as HTMLButtonElement[];
    expect(fills.length).toBe(CONSOLE_COMMANDS.length);
    for (const b of fills) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.tabIndex).toBe(0);
    }
    fireEvent.click(fills[0]);
    expect(onPopulate).toHaveBeenCalledTimes(1);
    expect(onPopulate).toHaveBeenCalledWith(CONSOLE_COMMANDS[0].syntax);
  });

  it('no catalog row is a click-only div: no interactive button is nested in another', () => {
    const { container } = render(<CommandCatalog onExecute={vi.fn()} onPopulate={vi.fn()} isExecuting={false} />);
    expect(container.querySelectorAll('button button').length).toBe(0);
  });

  it('RUN/FILL buttons become visible on keyboard focus, not only on mouse hover', () => {
    const { container } = render(<CommandCatalog onExecute={vi.fn()} onPopulate={vi.fn()} isExecuting={false} />);
    const runs = Array.from(container.querySelectorAll('button')).filter((b) => /^(RUN|FILL)$/.test(b.textContent?.trim() ?? ''));
    expect(runs.length).toBe(CONSOLE_COMMANDS.length);
    for (const b of runs) {
      expect(b.className).toContain('focus-visible:opacity-100');
      expect(b.className).toContain('group-focus-within:opacity-100');
    }
  });
});
