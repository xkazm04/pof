/**
 * BuildBlock (cli-terminal-shell/B): the ONE build block both terminal render
 * sites use. It shows what changed since the previous build of the session
 * (fixed / new / remaining) and a single 'Fix all N' that dispatches one run
 * for every error still standing. The counts come only from the two parsed
 * builds, never from anything the CLI claims.
 */

import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { BuildBlock } from '@/components/cli/TerminalOutput/BuildBlock';
import { ErrorCard } from '@/components/cli/ErrorCard';
import { buildFixAllPrompt, diffBuildErrors } from '@/components/cli/buildLedger';
import type { BuildDiagnostic, BuildParseResult } from '@/components/cli/UE5BuildParser';

afterEach(cleanup);

// ErrorCard's TruncateWithTooltip observes its size; jsdom has no ResizeObserver.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

let seq = 0;
function err(file: string, code: string, message: string, line: number | null = 1): BuildDiagnostic {
  return {
    id: `b-${seq++}`, severity: 'error', file, line, column: null, code, message,
    rawText: `${file}(${line}): error ${code}: ${message}`, category: 'compile',
  };
}

function build(errors: BuildDiagnostic[], success = errors.length === 0): BuildParseResult {
  return {
    diagnostics: errors,
    summary: { success, errorCount: errors.length, warningCount: 0, duration: null, rawText: success ? 'Build SUCCEEDED' : 'Build FAILED' },
    isBuildOutput: true,
  };
}

const persist = err('Source/X/Foo.cpp', 'C2065', "'Bar': undeclared identifier", 10);
const gone1 = err('Source/X/Foo.cpp', 'C2143', "syntax error: missing ';'", 20);
const gone2 = err('Source/X/Qux.h', 'C2061', 'syntax error: identifier FBaz', 4);

describe('BuildBlock ledger', () => {
  it('shows fixed / new / remaining against the previous build and dispatches ONE fix-all run', () => {
    const prev = build([persist, gone1, gone2]);
    const moved = { ...persist, id: 'moved', line: 12 };
    const parsed = build([moved]);
    const onFix = vi.fn();
    const { getByText, getByRole } = render(<BuildBlock parsed={parsed} prev={prev} onFix={onFix} isRunning={false} />);

    expect(getByText('2 fixed')).toBeTruthy();
    expect(getByText('0 new')).toBeTruthy();
    expect(getByText('1 remaining')).toBeTruthy();

    const btn = getByRole('button', { name: /Fix all 1/ });
    fireEvent.click(btn);
    expect(onFix).toHaveBeenCalledTimes(1);
    const d = diffBuildErrors(prev.diagnostics, parsed.diagnostics);
    expect(onFix).toHaveBeenCalledWith(buildFixAllPrompt([...d.remaining, ...d.introduced]));
  });

  it('disables Fix all while a run streams', () => {
    const onFix = vi.fn();
    const { getByRole } = render(<BuildBlock parsed={build([persist, gone1])} prev={null} onFix={onFix} isRunning />);
    const btn = getByRole('button', { name: /Fix all 2/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onFix).not.toHaveBeenCalled();
  });

  it('a green build after a red one reports what was fixed and offers no Fix all', () => {
    const prev = build([persist, gone1, gone2, err('Source/X/Bar.cpp', 'C2039', 'is not a member', 3)]);
    const { getByText, queryByRole } = render(<BuildBlock parsed={build([], true)} prev={prev} onFix={vi.fn()} isRunning={false} />);
    expect(getByText('4 fixed')).toBeTruthy();
    expect(queryByRole('button', { name: /Fix all/ })).toBeNull();
  });
});

describe('[guard] ErrorCard single-diagnostic Fix dispatches the same text as before', () => {
  it('collapsed Fix sends the frozen single-diagnostic prompt', () => {
    const onFix = vi.fn();
    const d = err('Source/X/Foo.cpp', 'C2065', "'Bar': undeclared identifier", 10);
    const { getByRole } = render(<ErrorCard diagnostic={d} onFix={onFix} isRunning={false} />);
    fireEvent.click(getByRole('button', { name: 'Fix error in Foo.cpp' }));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(onFix).toHaveBeenCalledWith(
      "Fix this compilation error (C2065) in file Source/X/Foo.cpp at line 10:\n\n'Bar': undeclared identifier"
      + '\n\nStart by reading Source/X/Foo.cpp to understand the context around line 10.'
      + '\n\nAfter fixing, verify the build compiles successfully.',
    );
  });
});
