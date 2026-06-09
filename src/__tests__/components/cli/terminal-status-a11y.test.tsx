/**
 * Accessibility regression tests for the CLI terminal status + icon-only buttons.
 *
 * WCAG 1.4.1 (use of color): the Ready/Running/Done/Error status must not rely on
 * color alone — each state pairs a distinct leading icon with a text label and lives
 * in an aria-live=polite role=status region so transitions are announced. The
 * icon-only header/input buttons must expose accessible names + a 24px hit target.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { TerminalHeader } from '@/components/cli/TerminalHeader';
import { TerminalInput } from '@/components/cli/TerminalInput';

afterEach(cleanup);

type HeaderProps = Parameters<typeof TerminalHeader>[0];

function renderHeader(overrides: Partial<HeaderProps> = {}) {
  const props: HeaderProps = {
    title: 'Test Terminal',
    sessionId: null,
    isStreaming: false,
    executionInfo: null,
    lastResult: null,
    logFilePath: null,
    editCount: 0,
    writeCount: 0,
    queuePendingCount: 0,
    onClear: vi.fn(),
    onResume: vi.fn(),
    ...overrides,
  };
  return render(<TerminalHeader {...props} />);
}

describe('TerminalHeader status region (color-independence)', () => {
  it('wraps the status in an aria-live=polite role=status region', () => {
    const { getByRole } = renderHeader();
    const status = getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('shows a Ready label with a leading icon when idle', () => {
    const { getByRole } = renderHeader();
    const status = getByRole('status');
    expect(status.textContent).toContain('Ready');
    expect(status.querySelector('svg')).not.toBeNull();
  });

  it('shows a Running label with a (spinner) icon while streaming', () => {
    const { getByRole } = renderHeader({ isStreaming: true });
    const status = getByRole('status');
    expect(status.textContent).toContain('Running');
    expect(status.querySelector('svg')).not.toBeNull();
  });

  it('shows a Done label with a leading icon after a successful result', () => {
    const { getByRole } = renderHeader({ lastResult: { isError: false } });
    const status = getByRole('status');
    expect(status.textContent).toContain('Done');
    expect(status.querySelector('svg')).not.toBeNull();
  });

  it('shows an Error label with a leading icon after a failed result', () => {
    const { getByRole } = renderHeader({ lastResult: { isError: true } });
    const status = getByRole('status');
    expect(status.textContent).toContain('Error');
    expect(status.querySelector('svg')).not.toBeNull();
  });
});

describe('TerminalHeader icon-only buttons (accessible names + hit target)', () => {
  it('gives the Clear button an accessible name and a 24px hit target', () => {
    const { getByRole } = renderHeader();
    const clear = getByRole('button', { name: /clear/i });
    expect(clear.className).toContain('p-1.5');
  });

  it('gives the Resume button an accessible name when a session can be resumed', () => {
    const { getByRole } = renderHeader({ sessionId: 'abc123', isStreaming: false });
    const resume = getByRole('button', { name: /resume/i });
    expect(resume.className).toContain('p-1.5');
  });
});

describe('TerminalInput icon-only buttons', () => {
  function renderInput(overrides: Partial<Parameters<typeof TerminalInput>[0]> = {}) {
    return render(
      <TerminalInput
        input="hello"
        setInput={vi.fn()}
        inputRef={createRef<HTMLTextAreaElement>()}
        isStreaming={false}
        onSubmit={vi.fn()}
        onAbort={vi.fn()}
        onNavigateHistory={vi.fn()}
        {...overrides}
      />
    );
  }

  it('gives the Send button an accessible name and a 24px hit target', () => {
    const { getByRole } = renderInput();
    const send = getByRole('button', { name: /send/i });
    expect(send.className).toContain('p-1.5');
  });

  it('gives the Abort button an accessible name while streaming', () => {
    const { getByRole } = renderInput({ isStreaming: true });
    const abort = getByRole('button', { name: /abort|stop/i });
    expect(abort.className).toContain('p-1.5');
  });
});
