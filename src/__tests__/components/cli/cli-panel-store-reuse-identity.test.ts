/**
 * At the session cap a tab is recycled. A keyed caller finds its tab and hears its
 * completion by sessionKey, so a recycled tab that kept the old key silently lost both.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

const store = () => useCLIPanelStore.getState();

function fill() {
  for (let i = 0; i < 8; i++) store().createSession({ label: `t${i}`, sessionKey: `old-${i}` });
}

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
});

describe('createSession at the cap', () => {
  it('gives a keyed caller a tab it can find again, on a fresh conversation', () => {
    fill();
    const first = store().tabOrder[0];
    useCLIPanelStore.setState({
      sessions: Object.fromEntries(Object.entries(store().sessions).map(([id, s]) => [
        id, { ...s, lastActivityAt: id === first ? 0 : 100, claudeSessionId: 'old-conversation' },
      ])),
    });

    const id = store().createSession({ label: 'New', sessionKey: 'new-key', moduleId: 'arpg-combat' });

    expect(id).toBe(first);
    expect(store().tabOrder).toHaveLength(8);
    expect(store().findSessionByKey('new-key')).toBe(id);
    expect(store().findSessionByKey('old-0')).toBeFalsy();
    expect(store().sessions[id]).toMatchObject({ label: 'New', moduleId: 'arpg-combat', claudeSessionId: null });
  });

  it('leaves the recycled tab alone for an unkeyed caller', () => {
    fill();
    const before = store().sessions;
    store().createSession({ label: 'Plain' });
    expect(store().sessions).toEqual(before);
  });
});
