/**
 * MaterialsView instantiated SIX CLI sessions at mount — one per extra tab
 * (configurator, patterns, post-process, style-transfer, hierarchy, ask) —
 * although `ReviewableModuleView` renders exactly ONE tab body at a time, and
 * the default tab is `overview`, which needs none of them.
 *
 * Each `useModuleCLI` / `useChecklistCLI` instance subscribes to the CLI panel
 * store with an `Object.values(sessions).find(...)` selector that re-runs on
 * every store write, and each one re-renders the WHOLE view when its session's
 * running flag changes. Five of the six can never be observed by the user.
 *
 * RED before this change: `sessions at mount` was 6.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ── Session-cost instrumentation ────────────────────────────────────────────
// Spy wrappers around the two CLI hooks, recording every sessionKey a render
// pass instantiates. The real hooks still run (we are measuring cost, not
// behaviour), so the view's wiring is exercised end to end.

const instantiated: string[] = [];

/** The Ask TAB's input — distinct from the Quick Actions panel's own ask box. */
const ASK_PLACEHOLDER = 'Ask about materials, shaders, post-process...';

vi.mock('@/hooks/useModuleCLI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useModuleCLI')>();
  return {
    ...actual,
    useModuleCLI: (opts: Parameters<typeof actual.useModuleCLI>[0]) => {
      instantiated.push(opts.sessionKey);
      return actual.useModuleCLI(opts);
    },
  };
});

vi.mock('@/hooks/useChecklistCLI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useChecklistCLI')>();
  return {
    ...actual,
    useChecklistCLI: (opts: Parameters<typeof actual.useChecklistCLI>[0]) => {
      instantiated.push(opts.sessionKey);
      return actual.useChecklistCLI(opts);
    },
  };
});

import { MaterialsView } from '@/components/modules/content/materials/MaterialsView';
import { MODULE_COLORS } from '@/lib/constants';

/** Session keys owned by MaterialsView's own tabs (not ReviewableModuleView's three). */
const MATERIAL_TAB_KEYS = [
  'materials-configurator',
  'materials-catalog',
  'materials-postprocess',
  'materials-style-transfer',
  'materials-graph',
  'materials-custom',
];

function tabSessions(): string[] {
  return [...new Set(instantiated.filter((k) => MATERIAL_TAB_KEYS.includes(k)))];
}

beforeEach(() => {
  instantiated.length = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: {} }),
  }) as unknown as Response));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  instantiated.length = 0;
});

describe('MaterialsView — CLI session cost', () => {
  it('creates NO tab CLI session at mount (the default tab is Overview)', () => {
    render(<MaterialsView />);
    expect(tabSessions()).toEqual([]);
  });

  it('creates a tab session LAZILY, and only the one whose tab is open', () => {
    render(<MaterialsView />);

    fireEvent.click(screen.getByRole('tab', { name: 'Configure' }));
    expect(tabSessions()).toEqual(['materials-configurator']);

    instantiated.length = 0;
    fireEvent.click(screen.getByRole('tab', { name: 'Patterns' }));
    // The configurator's hook is gone with its tab body; only Patterns' remains.
    expect(tabSessions()).toEqual(['materials-catalog']);
  });

  it('never destroys a CLI panel session that has output when its tab closes', async () => {
    const { useCLIPanelStore } = await import('@/components/cli/store/cliPanelStore');
    render(<MaterialsView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Configure' }));

    // A dispatch created a panel session for this tab…
    const tabId = useCLIPanelStore.getState().createSession({
      label: 'Material Config',
      accentColor: MODULE_COLORS.content,
      moduleId: 'materials',
      sessionKey: 'materials-configurator',
      projectPath: undefined,
    });
    expect(useCLIPanelStore.getState().sessions[tabId]).toBeTruthy();

    // …and navigating away from the tab must not take it with them.
    fireEvent.click(screen.getByRole('tab', { name: 'Patterns' }));
    expect(useCLIPanelStore.getState().sessions[tabId]).toBeTruthy();

    useCLIPanelStore.getState().removeSession(tabId);
  });
});

describe('MaterialsView — tab body identity', () => {
  it('typing in the Ask box does not remount the tab body', () => {
    render(<MaterialsView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    const before = screen.getByPlaceholderText(ASK_PLACEHOLDER);
    fireEvent.change(before, { target: { value: 'how do I fake SSS' } });
    const after = screen.getByPlaceholderText(ASK_PLACEHOLDER);

    // Same DOM node → React reconciled rather than remounting; a remount would
    // also have dropped the typed text.
    expect(after).toBe(before);
    expect((after as HTMLInputElement).value).toBe('how do I fake SSS');
  });

  it('typing in the Ask box does not re-instantiate any other tab session', () => {
    render(<MaterialsView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    instantiated.length = 0;

    fireEvent.change(screen.getByPlaceholderText(ASK_PLACEHOLDER), {
      target: { value: 'x' },
    });

    // Ask owns its own draft state, so the re-render is scoped to its own tab.
    expect(tabSessions()).toEqual(['materials-custom']);
  });
});
