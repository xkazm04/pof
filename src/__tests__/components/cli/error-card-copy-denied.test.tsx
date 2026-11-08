import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { ErrorCard } from '@/components/cli/ErrorCard';
import type { BuildDiagnostic } from '@/components/cli/UE5BuildParser';

// scan-sweep night 2026-11-08 cli-terminal-shell — ErrorCard's Copy awaited
// navigator.clipboard.writeText with no catch, so a denied clipboard (insecure
// origin, permission refused) became an unhandled promise rejection. The two copy
// buttons in TerminalHeader already catch; this is the third, unguarded one.

afterEach(cleanup);

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const diag: BuildDiagnostic = {
  id: 'd1', severity: 'error', file: 'Source/PoF/Foo.cpp', line: 3, column: null, code: 'C2065',
  message: "'x': undeclared identifier", rawText: "Foo.cpp(3): error C2065: 'x': undeclared identifier", category: 'compile',
};

describe('ErrorCard copy with a denied clipboard', () => {
  it('does not leak an unhandled rejection and keeps the "copy" label', async () => {
    const writeText = vi.fn(() => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const { container } = render(<ErrorCard diagnostic={diag} />);
      const copy = container.querySelector('button[aria-label="Copy error details"]') as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(copy);
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
      expect(container.querySelector('button[aria-label="Error details copied"]')).toBeNull();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
