/**
 * The keyboard door through React (scan-sweep --challenge, shared-utility-hooks/A):
 * `useHotkey` / `useEscapeLayer` / `useCaptureNext` read SuspendContext, so a
 * pane hidden in the keep-alive LRU is keyboard-inert — the display:none
 * condition and the keyboard condition are the same condition.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

// setup.ts has no afterEach(cleanup).
afterEach(cleanup);

const { apiFetch, NO_SPELLS } = vi.hoisted(() => ({ apiFetch: vi.fn(), NO_SPELLS: [] as unknown[] }));

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
vi.mock('@/components/modules/core-engine/sub_ability/spellbook-search-index', () => ({
  // A stable identity: SpellbookSearch resets its selection when the index changes.
  useSpellbookSearchIndex: () => NO_SPELLS,
  MAX_RESULTS: 12,
}));

import { SuspendContext } from '@/hooks/useSuspend';
import { PaneIdContext } from '@/hooks/usePaneHold';
import { useHotkey } from '@/hooks/useHotkey';
import { hotkeys } from '@/lib/hotkeys/hotkeyRegistry';
import { GlobalSearchPanel } from '@/components/layout/GlobalSearchPanel';
import { SpellbookSearch } from '@/components/modules/core-engine/sub_ability/SpellbookSearch';
import { InputBindingsTable } from '@/components/modules/core-engine/sub_character/input/InputBindingsTable';
import { useReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView/useReviewableModuleView';
import { useModuleStore } from '@/stores/moduleStore';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';

const ctrlK = () => act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
const escape = () => act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
const globalSearchBox = () => screen.queryByRole('textbox', { name: /search checklist items/i });
const spellbookBox = () => screen.queryByRole('combobox', { name: /search abilities/i });

beforeEach(() => {
  // jsdom does not implement scrollIntoView, which the spellbook palette calls in an effect.
  Element.prototype.scrollIntoView = vi.fn();
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ results: [], indexed: 0, lastRebuilt: null });
});
afterEach(() => { hotkeys.reset(); });

function ModuleKey({ onKey }: { onKey: () => void }) {
  useHotkey('mod+k', onKey, { allowInInput: true, id: 'module-k' });
  return null;
}

describe('useHotkey — a hidden pane never receives keys', () => {
  it('case 2: suspended -> only the shell owner; visible -> only the module owner', () => {
    const shell = vi.fn();
    const mod = vi.fn();
    hotkeys.register('mod+k', shell, { scope: 'shell', id: 'shell-k' });

    const tree = (hidden: boolean) => (
      <SuspendContext.Provider value={hidden}>
        <PaneIdContext.Provider value="arpg-ability">
          <ModuleKey onKey={mod} />
        </PaneIdContext.Provider>
      </SuspendContext.Provider>
    );
    const { rerender } = render(tree(true));
    ctrlK();
    expect(shell).toHaveBeenCalledTimes(1);
    expect(mod).toHaveBeenCalledTimes(0);

    rerender(tree(false));
    ctrlK();
    expect(shell).toHaveBeenCalledTimes(1);
    expect(mod).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+K in the ability pane opens ONE palette (spellbook), and none of it once the pane is hidden', async () => {
    const tree = (hidden: boolean) => (
      <>
        <GlobalSearchPanel />
        <SuspendContext.Provider value={hidden}>
          <PaneIdContext.Provider value="arpg-ability">
            <SpellbookSearch onNavigate={vi.fn()} />
          </PaneIdContext.Provider>
        </SuspendContext.Provider>
      </>
    );
    const { rerender } = render(tree(false));
    ctrlK();
    expect(spellbookBox()).not.toBeNull();
    expect(globalSearchBox()).toBeNull();
    ctrlK();
    await waitFor(() => expect(spellbookBox()).toBeNull());

    rerender(tree(true));
    ctrlK();
    expect(await screen.findByRole('textbox', { name: /search checklist items/i })).toBeTruthy();
    expect(spellbookBox()).toBeNull();
  });
});

function ReviewHost() {
  useReviewableModuleView({ moduleId: 'arpg-combat', moduleLabel: 'Combat', accentColor: 'var(--accent)', checklist: [], extraTabs: [] });
  return null;
}

describe('useEscapeLayer — Escape closes only the top layer', () => {
  it('case 4: Escape over open global search closes search and leaves the quick-actions panel expanded', async () => {
    useModuleStore.setState({ quickActionsPanelCollapsed: false });
    render(<><ReviewHost /><GlobalSearchPanel /></>);
    ctrlK();
    expect(await screen.findByRole('textbox', { name: /search checklist items/i })).toBeTruthy();

    escape();
    await waitFor(() => expect(globalSearchBox()).toBeNull());
    expect(useModuleStore.getState().quickActionsPanelCollapsed).toBe(false);

    escape();
    expect(useModuleStore.getState().quickActionsPanelCollapsed).toBe(true);
  });
});

describe('useCaptureNext — exclusive rebinding capture is released when the pane hides', () => {
  const original = useCharacterBlueprintStore.getState().setBindingOverride;
  afterEach(() => { useCharacterBlueprintStore.setState({ setBindingOverride: original }); });

  it('case 5: a suspended rebinding pane lets the next Ctrl+K reach the shell owner', () => {
    const setBindingOverride = vi.fn();
    useCharacterBlueprintStore.setState({ setBindingOverride });
    const shell = vi.fn();
    hotkeys.register('mod+k', shell, { scope: 'shell', allowInInput: true, id: 'shell-k' });

    const tree = (hidden: boolean) => (
      <SuspendContext.Provider value={hidden}>
        <PaneIdContext.Provider value="arpg-character">
          <InputBindingsTable moduleId="arpg-character" featureMap={new Map()} />
        </PaneIdContext.Provider>
      </SuspendContext.Provider>
    );
    const { rerender } = render(tree(false));
    fireEvent.click(screen.getAllByTestId(/^rebind-action-/)[0]);
    rerender(tree(true));

    ctrlK();
    expect(shell).toHaveBeenCalledTimes(1);
    expect(setBindingOverride).not.toHaveBeenCalled();
  });
});
