import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

// scan-sweep 2026-11-08 cli-terminal-shell: closing a running inline terminal must
// abort its server-side run (DELETE by executionId) before the session is removed.

const apiFetch = vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/components/cli/CompactTerminal', () => ({ CompactTerminal: () => null }));

import { InlineTerminal } from '@/components/cli/InlineTerminal';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

function seed(running: boolean, executionId: string | null) {
  const id = useCLIPanelStore.getState().createSession({ label: 'T' });
  useCLIPanelStore.setState((s) => ({
    sessions: { ...s.sessions, [id]: { ...s.sessions[id], isRunning: running, currentExecutionId: executionId } },
  }));
  return id;
}

describe('InlineTerminal close', () => {
  beforeEach(() => { apiFetch.mockClear(); });
  afterEach(cleanup);

  it('DELETEs the execution of a running session, then removes it', () => {
    const id = seed(true, 'exec-1');
    const { getByLabelText } = render(<InlineTerminal sessionId={id} />);
    fireEvent.click(getByLabelText('Close terminal'));
    const deletes = apiFetch.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'DELETE');
    expect(deletes.length).toBe(1);
    expect(String(deletes[0][0])).toContain('executionId=exec-1');
    expect(useCLIPanelStore.getState().sessions[id]).toBeUndefined();
  });

  it('does not DELETE when the session is idle', () => {
    const id = seed(false, null);
    const { getByLabelText } = render(<InlineTerminal sessionId={id} />);
    fireEvent.click(getByLabelText('Close terminal'));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(useCLIPanelStore.getState().sessions[id]).toBeUndefined();
  });
});
