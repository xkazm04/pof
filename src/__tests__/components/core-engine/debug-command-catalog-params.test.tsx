import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CommandCatalog } from '@/components/modules/core-engine/sub_debug/console/CommandCatalog';
import { CONSOLE_COMMANDS } from '@/components/modules/core-engine/sub_debug/_shared/data';

/**
 * scan-sweep night 2026-11-08 (debug-performance, bounty-hunter): the catalog's
 * RUN button sent the bare syntax to UE5 even for commands whose catalog entry
 * declares a REQUIRED parameter (`<factor>`, `<x> <y> <z>`, ...), so `slomo`,
 * `teleport`, `loadlevel` and `log verbose` went out incomplete. A command that
 * needs an argument is filled into the input instead of executed.
 */

afterEach(cleanup);

const needsArg = (params?: string) => !!params && params.includes('<');

function rowButton(container: HTMLElement, syntax: string): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll('div.group')).find((r) =>
    r.textContent?.includes(`> ${syntax}`));
  if (!row) throw new Error(`no row for ${syntax}`);
  return Array.from(row.querySelectorAll('button')).find((b) => /^(RUN|FILL)$/.test(b.textContent?.trim() ?? '')) as HTMLButtonElement;
}

describe('CommandCatalog required parameters', () => {
  it('a command with a required <param> is never executed bare', () => {
    const onExecute = vi.fn();
    const onPopulate = vi.fn();
    const { container } = render(<CommandCatalog onExecute={onExecute} onPopulate={onPopulate} isExecuting={false} />);
    const withArgs = CONSOLE_COMMANDS.filter((c) => needsArg(c.params));
    expect(withArgs.length).toBe(4);
    for (const cmd of withArgs) fireEvent.click(rowButton(container, cmd.syntax));
    expect(onExecute).not.toHaveBeenCalled();
    expect(onPopulate.mock.calls.map((c) => c[0])).toEqual(withArgs.map((c) => `${c.syntax} `));
  });

  it('control: a command without a required param still runs directly', () => {
    const onExecute = vi.fn();
    const { container } = render(<CommandCatalog onExecute={onExecute} onPopulate={vi.fn()} isExecuting={false} />);
    fireEvent.click(rowButton(container, 'stat fps'));
    fireEvent.click(rowButton(container, 'show collision'));
    expect(onExecute.mock.calls.map((c) => c[0])).toEqual(['stat fps', 'show collision']);
  });
});
