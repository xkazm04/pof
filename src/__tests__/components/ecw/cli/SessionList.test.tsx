import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionList } from '@/components/ecw/cli/SessionList';
import { useEcwStore } from '@/stores/ecwStore';
import { useCLIPanelStore, type CLISessionState } from '@/components/cli/store/cliPanelStore';

function mkSession(id: string, opts: Partial<CLISessionState> = {}): CLISessionState {
  const now = Date.now();
  return {
    id,
    label: `Session ${id}`,
    projectPath: null,
    claudeSessionId: null,
    currentExecutionId: null,
    currentTaskId: null,
    isRunning: false,
    lastTaskSuccess: null,
    accentColor: '#00ff88',
    createdAt: now,
    lastActivityAt: now,
    enabledSkills: [],
    ...opts,
  };
}

describe('SessionList', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeCatalogId: null, activeEntityId: null });
    useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
  });
  afterEach(cleanup);

  it('shows empty state when no sessions exist', () => {
    render(<SessionList />);
    expect(screen.getByText(/no sessions yet/i)).toBeTruthy();
  });

  it('renders all sessions in project scope', () => {
    useCLIPanelStore.setState({
      sessions: {
        a: mkSession('a', { label: 'Gen Fireball', sessionKey: 'gen-ga-fireball' }),
        b: mkSession('b', { label: 'Gen Brute', sessionKey: 'gen-brute' }),
      },
      tabOrder: ['a', 'b'],
      activeTabId: null,
      maximizedTabId: null,
    });
    render(<SessionList />);
    expect(screen.getByText('Gen Fireball')).toBeTruthy();
    expect(screen.getByText('Gen Brute')).toBeTruthy();
  });

  it('filters to entity sessions when entity is selected', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'ga-fireball' });
    useCLIPanelStore.setState({
      sessions: {
        a: mkSession('a', { label: 'Gen Fireball', sessionKey: 'gen-ga-fireball' }),
        b: mkSession('b', { label: 'Gen Brute', sessionKey: 'gen-brute' }),
      },
      tabOrder: ['a', 'b'],
      activeTabId: null,
      maximizedTabId: null,
    });
    render(<SessionList />);
    expect(screen.getByText('Gen Fireball')).toBeTruthy();
    expect(screen.queryByText('Gen Brute')).toBeNull();
  });

  it('shows entity-scoped empty state when no matching sessions', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'ga-frost' });
    useCLIPanelStore.setState({
      sessions: { a: mkSession('a', { label: 'Gen Fireball', sessionKey: 'gen-ga-fireball' }) },
      tabOrder: ['a'],
      activeTabId: null,
      maximizedTabId: null,
    });
    render(<SessionList />);
    expect(screen.getByText(/no sessions for/i)).toBeTruthy();
  });
});
