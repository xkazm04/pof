import { describe, it, expect, beforeEach } from 'vitest';
import { useCLIPanelStore, type CLISessionState } from '@/components/cli/store/cliPanelStore';
import { MODULE_COLORS } from '@/lib/chart-colors';

function makeSession(id: string, isRunning: boolean, lastActivityAt: number): CLISessionState {
  return {
    id,
    label: id,
    projectPath: null,
    claudeSessionId: null,
    currentExecutionId: null,
    currentTaskId: null,
    isRunning,
    lastTaskSuccess: null,
    accentColor: MODULE_COLORS.core,
    createdAt: 0,
    lastActivityAt,
    enabledSkills: [],
  };
}

/** Seed the store with exactly the given sessions (in order). */
function seed(sessions: CLISessionState[]) {
  const map: Record<string, CLISessionState> = {};
  for (const s of sessions) map[s.id] = s;
  useCLIPanelStore.setState({
    sessions: map,
    tabOrder: sessions.map((s) => s.id),
    activeTabId: sessions[0]?.id ?? null,
    maximizedTabId: null,
  });
}

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
});

describe('cliPanelStore.createSession cap guard', () => {
  it('creates a new session when under the cap', () => {
    const id = useCLIPanelStore.getState().createSession();
    expect(useCLIPanelStore.getState().tabOrder).toContain(id);
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(1);
  });

  it('at the cap, reuses the least-recently-active IDLE session', () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      // all running except #2 (lastActivityAt 50) and #5 (lastActivityAt 10 — stalest idle)
      makeSession(`s${i}`, i !== 2 && i !== 5, i === 5 ? 10 : i === 2 ? 50 : 100 + i),
    );
    seed(sessions);
    const returned = useCLIPanelStore.getState().createSession();
    expect(returned).toBe('s5'); // stalest idle by lastActivityAt
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(8); // no new tab
  });

  it('at the cap with EVERY session running, creates a new session (exceeds the cap rather than clobber)', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => makeSession(`r${i}`, true, 100 + i));
    seed(sessions);
    const returned = useCLIPanelStore.getState().createSession();
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(9);
    expect(useCLIPanelStore.getState().tabOrder).toContain(returned);
    expect(sessions.map((s) => s.id)).not.toContain(returned);
  });
});
