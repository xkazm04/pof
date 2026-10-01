/**
 * useModuleTab — the read side of the per-module tab location
 * (scan-sweep --challenge app-navigation/A).
 *
 * Each pane reads ITS OWN `moduleTabs[moduleId]` entry, validated against its own
 * tab ids; a jump to another module never moves it, and a jump written before the
 * pane mounted lands on its first render.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, act, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/components/cli/CompactTerminal', () => ({ CompactTerminal: () => null }));

import { useNavigationStore } from '@/stores/navigationStore';
import { useModuleTab } from '@/hooks/useModuleTab';
import { useAdvancedTexturePanel } from '@/components/modules/visual-gen/material-lab/AdvancedTexturePanel/useAdvancedTexturePanel';
import { createSimpleModuleView } from '@/components/modules/shared/createSimpleModuleView';
import { InlineTerminal } from '@/components/cli/InlineTerminal';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

const TABS = ['overview', 'roadmap'];
const EVENT = ['pof', 'navigate', 'tab'].join('-');

beforeEach(() => {
  useNavigationStore.setState({ activeCategory: null, activeSubModule: null, moduleTabs: {} });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: {} }),
  }) as unknown as Response));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useModuleTab — addressed, not broadcast', () => {
  it('a jump to arpg-combat moves combat only; a mounted arpg-loot pane stays put', () => {
    const combat = renderHook(() => useModuleTab('arpg-combat', TABS));
    const loot = renderHook(() => useModuleTab('arpg-loot', TABS));
    expect(combat.result.current[0]).toBe('overview');
    expect(loot.result.current[0]).toBe('overview');

    act(() => { useNavigationStore.getState().navigateToModule('arpg-combat', { tab: 'roadmap' }); });

    expect(combat.result.current[0]).toBe('roadmap');
    expect(loot.result.current[0]).toBe('overview');
  });

  it('cold target: a tab written before the pane mounts is read on its first render', () => {
    useNavigationStore.getState().setModuleTab('arpg-loot', 'roadmap');
    const firstRenders: string[] = [];
    renderHook(() => {
      const [tab] = useModuleTab('arpg-loot', TABS);
      firstRenders.push(tab);
      return tab;
    });
    expect(firstRenders[0]).toBe('roadmap');
  });

  it('a stale / foreign tab falls back to the first valid tab', () => {
    useNavigationStore.setState({ moduleTabs: { 'arpg-combat': 'editor' } });
    const { result } = renderHook(() => useModuleTab('arpg-combat', TABS));
    expect(result.current[0]).toBe('overview');
  });

  it('the setter writes the module entry in the store', () => {
    const { result } = renderHook(() => useModuleTab('arpg-combat', TABS));
    act(() => { result.current[1]('roadmap'); });
    expect(useNavigationStore.getState().moduleTabs['arpg-combat']).toBe('roadmap');
    expect(result.current[0]).toBe('roadmap');
  });
});

describe('producers write addressed locations', () => {
  it("Material Lab 'go to editor' targets material-lab only", () => {
    useNavigationStore.setState({ moduleTabs: { 'arpg-combat': 'roadmap' } });
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useAdvancedTexturePanel());
    act(() => { result.current.applyMap('albedo', 'https://example.test/albedo.png'); });
    expect(useNavigationStore.getState().moduleTabs).toEqual({ 'arpg-combat': 'roadmap', 'material-lab': 'editor' });
    expect(dispatch.mock.calls.some(([e]) => (e as Event).type === EVENT)).toBe(false);
  });

  it("InlineTerminal's navigate suggestion (no moduleId) targets the session's own module and dispatches no window event", () => {
    useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
    const id = useCLIPanelStore.getState().createSession({ sessionKey: 'arpg-combat-cli', moduleId: 'arpg-combat', label: 'Combat' });
    useCLIPanelStore.setState((s) => ({
      sessions: { ...s.sessions, [id]: { ...s.sessions[id], isRunning: false, lastTaskSuccess: true, lastTaskType: 'checklist', lastCallbackStatus: 'confirmed' } },
    }));
    useNavigationStore.setState({ moduleTabs: { 'arpg-loot': 'overview' } });
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    render(<InlineTerminal sessionId={id} />);
    fireEvent.click(screen.getByRole('button', { name: /Run next checklist item/ }));

    const nav = useNavigationStore.getState();
    expect(nav.activeSubModule).toBe('arpg-combat');
    expect(nav.moduleTabs).toEqual({ 'arpg-loot': 'overview', 'arpg-combat': 'roadmap' });
    expect(dispatch.mock.calls.some(([e]) => (e as Event).type === EVENT)).toBe(false);
  });
});

describe('[guard] a user tab click in ReviewableModuleView', () => {
  it('writes moduleTabs[moduleId] and shows the Roadmap pane', () => {
    const AudioView = createSimpleModuleView('audio');
    render(<AudioView />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: 'Roadmap' }));
    expect(useNavigationStore.getState().moduleTabs['audio']).toBe('roadmap');
    expect(screen.getByRole('tab', { name: 'Roadmap' }).getAttribute('aria-selected')).toBe('true');
  });
});
