import { describe, it, expect, beforeEach } from 'vitest';

// scan-sweep --challenge cli-terminal-system/B — a session remembers the server run it
// owns across a reload (persisted currentExecutionId), and forgets it once the run ends.

import { useCLIPanelStore, type CLISessionState } from '@/components/cli/store/cliPanelStore';
import { bindSessionRun } from '@/components/cli/store/sessionRun';

type PersistApi = {
  getOptions: () => {
    partialize: (s: ReturnType<typeof useCLIPanelStore.getState>) => { sessions: Record<string, CLISessionState> };
    merge: (persisted: unknown, current: ReturnType<typeof useCLIPanelStore.getState>) => ReturnType<typeof useCLIPanelStore.getState>;
  };
};
const persistApi = () => (useCLIPanelStore as unknown as { persist: PersistApi }).persist.getOptions();

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
});

describe('cliPanelStore — the execution a session owns survives a reload', () => {
  it('setCurrentExecution is persisted; merge keeps the id but still resets isRunning', () => {
    const s1 = useCLIPanelStore.getState().createSession({ label: 'T' });
    useCLIPanelStore.getState().beginRun(s1);
    useCLIPanelStore.getState().setCurrentExecution(s1, 'exec-1', null);

    const persisted = persistApi().partialize(useCLIPanelStore.getState());
    expect(persisted.sessions[s1].currentExecutionId).toBe('exec-1');

    const reloaded = persistApi().merge(
      { sessions: { [s1]: { ...persisted.sessions[s1], currentExecutionId: 'exec-1', isRunning: true } } },
      useCLIPanelStore.getState(),
    );
    expect(reloaded.sessions[s1].currentExecutionId).toBe('exec-1');
    expect(reloaded.sessions[s1].isRunning).toBe(false);
    expect(reloaded.sessions[s1].runPhase).toBe('idle');
  });

  it('endRun clears the execution id — a settled run is never re-attached', () => {
    const s1 = useCLIPanelStore.getState().createSession({ label: 'T' });
    const seq = useCLIPanelStore.getState().beginRun(s1);
    useCLIPanelStore.getState().setCurrentExecution(s1, 'exec-1', null);
    useCLIPanelStore.getState().endRun(s1, seq, { success: true });
    expect(useCLIPanelStore.getState().sessions[s1].currentExecutionId).toBeNull();
  });

  it('bindSessionRun: a completion whose outcome is unknown (run gone from the server) records null, not a failure', () => {
    const s1 = useCLIPanelStore.getState().createSession({ label: 'T' });
    const h = bindSessionRun(s1);
    h.onTaskStart('interactive');
    useCLIPanelStore.getState().setCurrentExecution(s1, 'exec-1', null);
    h.onTaskComplete('interactive', false, { outcomeUnknown: true });
    const sess = useCLIPanelStore.getState().sessions[s1];
    expect(sess.isRunning).toBe(false);
    expect(sess.lastTaskSuccess).toBeNull();
    expect(sess.currentExecutionId).toBeNull();
  });
});
