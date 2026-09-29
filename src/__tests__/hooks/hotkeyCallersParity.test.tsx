/**
 * [guard] Per-caller parity for the keyboard-door migration (scan-sweep
 * --challenge, shared-utility-hooks/A, case 7). Pins what the legacy shell's
 * listeners did BEFORE they moved onto `@/lib/hotkeys/hotkeyRegistry`, so the
 * migration keeps each caller's reach: Ctrl+B/J/1, chords firing from a
 * textarea, the Sidebar drawer's Escape, and the rebinding capture.
 * Imports only the callers — green before and after the migration.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, renderHook, screen, fireEvent, cleanup, act } from '@testing-library/react';

// setup.ts has no afterEach(cleanup).
afterEach(cleanup);

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/hooks/useModuleActions', () => ({ useModuleActions: () => ({ sendPromptToModule: vi.fn() }) }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), isRunning: false, sessionId: null }),
}));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch };
});
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { GlobalSearchPanel } from '@/components/layout/GlobalSearchPanel';
import { Sidebar } from '@/components/layout/Sidebar';
import { InputBindingsTable } from '@/components/modules/core-engine/sub_character/input/InputBindingsTable';
import { normalizeKeyEvent } from '@/lib/character/input-bindings';
import { CATEGORIES } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';

const nav0 = useNavigationStore.getState();
const cli0 = useCLIPanelStore.getState();
const bp0 = useCharacterBlueprintStore.getState();

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ results: [], indexed: 0, lastRebuilt: null });
});
afterEach(() => {
  useNavigationStore.setState(nav0, true);
  useCLIPanelStore.setState(cli0, true);
  useCharacterBlueprintStore.setState(bp0, true);
});

const key = (init: KeyboardEventInit, target: Document | Element | Window = window) =>
  act(() => { fireEvent.keyDown(target, init); });

describe('[guard] useKeyboardShortcuts keeps its reach', () => {
  it('Ctrl+B toggles sidebarMode full <-> collapsed', () => {
    useNavigationStore.setState({ sidebarMode: 'full' });
    renderHook(() => useKeyboardShortcuts());
    key({ key: 'b', ctrlKey: true });
    expect(useNavigationStore.getState().sidebarMode).toBe('collapsed');
    key({ key: 'b', ctrlKey: true });
    expect(useNavigationStore.getState().sidebarMode).toBe('full');
  });

  it('Ctrl+J maximizes the active tab, or minimizes when a tab is maximized', () => {
    const maximizeTab = vi.fn();
    const minimizeTab = vi.fn();
    useCLIPanelStore.setState({ activeTabId: 't1', maximizedTabId: null, maximizeTab, minimizeTab });
    const { rerender } = renderHook(() => useKeyboardShortcuts());
    key({ key: 'j', ctrlKey: true });
    expect(maximizeTab).toHaveBeenCalledWith('t1');
    expect(minimizeTab).not.toHaveBeenCalled();

    act(() => { useCLIPanelStore.setState({ maximizedTabId: 't1' }); });
    rerender();
    key({ key: 'j', ctrlKey: true });
    expect(minimizeTab).toHaveBeenCalledTimes(1);
    expect(maximizeTab).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+1 switches to the first category', () => {
    const setActiveCategory = vi.fn();
    useNavigationStore.setState({ setActiveCategory });
    renderHook(() => useKeyboardShortcuts());
    const e = new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(setActiveCategory).toHaveBeenCalledWith(CATEGORIES[0].id);
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('[guard] migrated chords still fire with focus inside a <textarea>', () => {
  it('(a) Ctrl+K opens global search and Ctrl+B toggles the sidebar from a textarea', async () => {
    useNavigationStore.setState({ sidebarMode: 'full' });
    function Host() {
      useKeyboardShortcuts();
      return <><textarea aria-label="notes" /><GlobalSearchPanel /></>;
    }
    render(<Host />);
    const ta = screen.getByRole('textbox', { name: 'notes' });
    ta.focus();
    key({ key: 'k', ctrlKey: true }, ta);
    expect(await screen.findByRole('textbox', { name: /search checklist items/i })).toBeTruthy();
    key({ key: 'b', ctrlKey: true }, ta);
    expect(useNavigationStore.getState().sidebarMode).toBe('collapsed');
  });
});

describe('[guard] Sidebar overlay drawer', () => {
  it('(b) open alone + Escape -> onClose called once', () => {
    const onClose = vi.fn();
    render(<Sidebar overlay open onClose={onClose} />);
    key({ key: 'Escape' }, document);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('inline (not overlay) ignores Escape', () => {
    const onClose = vi.fn();
    render(<Sidebar open onClose={onClose} />);
    key({ key: 'Escape' }, document);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('[guard] InputBindingsTable rebinding capture', () => {
  function startRebind(): string {
    const btn = screen.getAllByTestId(/^rebind-action-/)[0];
    fireEvent.click(btn);
    return btn.getAttribute('data-testid')!.replace('rebind-action-', '');
  }

  it("(c) a visible table in rebinding binds the next key ('g')", () => {
    const setBindingOverride = vi.fn();
    useCharacterBlueprintStore.setState({ setBindingOverride });
    render(<InputBindingsTable moduleId="arpg-character" featureMap={new Map()} />);
    const action = startRebind();
    key({ key: 'g' });
    expect(setBindingOverride).toHaveBeenCalledWith(action, normalizeKeyEvent('g'));
    expect(setBindingOverride).toHaveBeenCalledTimes(1);
    // One-shot: the capture ended with the key it took.
    key({ key: 'h' });
    expect(setBindingOverride).toHaveBeenCalledTimes(1);
  });

  it('(c) Escape cancels the rebind without an override', () => {
    const setBindingOverride = vi.fn();
    useCharacterBlueprintStore.setState({ setBindingOverride });
    render(<InputBindingsTable moduleId="arpg-character" featureMap={new Map()} />);
    startRebind();
    key({ key: 'Escape' });
    expect(setBindingOverride).not.toHaveBeenCalled();
    key({ key: 'g' });
    expect(setBindingOverride).not.toHaveBeenCalled();
  });
});
