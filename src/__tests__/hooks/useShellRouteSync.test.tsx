import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { useShellRouteSync } from '@/hooks/useShellRouteSync';
import { useNavigationStore } from '@/stores/navigationStore';
import { readShellPref } from '@/lib/ecw/shell-pref';
import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { NewShellButton } from '@/components/layout/TopBar/HeaderButtons';

/**
 * The legacy shell keeps its location in Zustand. That owes the Back gesture and deep
 * links explicitly: the module travels in the URL (Next's app-router copies its own
 * history state into plain pushState calls, so a URL-carried location survives Back).
 */

/** Real jsdom traversal: resolves once the popstate for it has been dispatched. */
function traverse(dir: 'back' | 'forward'): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    act(() => { window.history[dir](); });
  });
}

const moduleParam = (url: unknown) => new URL(String(url), 'http://localhost').searchParams.get('module');

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useShellRouteSync - modules get addresses', () => {
  it('applies a deep link, pushes one entry per module move, and a Back is never re-pushed', async () => {
    window.history.replaceState({}, '', '/?legacy=1&module=audio');
    const push = vi.spyOn(window.history, 'pushState');
    renderHook(() => useShellRouteSync());

    // The deep link lands, validated, through the one navigate door. Arrival never pushes.
    expect(useNavigationStore.getState().activeCategory).toBe('content');
    expect(useNavigationStore.getState().activeSubModule).toBe('audio');
    expect(push).not.toHaveBeenCalled();

    // A module-to-module move is a history entry whose address names the new module.
    act(() => { useNavigationStore.getState().setActiveSubModule('models'); });
    expect(push).toHaveBeenCalledTimes(1);
    expect(moduleParam(push.mock.calls[0][2])).toBe('models');
    expect(moduleParam(window.location.href)).toBe('models');

    // Back re-applies the address, and applying it pushes NOTHING (no sync loop).
    await traverse('back');
    expect(window.location.search).toBe('?legacy=1&module=audio');
    expect(useNavigationStore.getState().activeSubModule).toBe('audio');
    expect(push).toHaveBeenCalledTimes(1);

    // So Forward still has somewhere to go.
    await traverse('forward');
    expect(useNavigationStore.getState().activeSubModule).toBe('models');
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('an arrival with no module param REPLACES the entry to name the persisted module', () => {
    window.history.replaceState({}, '', '/?legacy=1');
    useNavigationStore.getState().navigateToModule('packaging');
    const push = vi.spyOn(window.history, 'pushState');
    renderHook(() => useShellRouteSync());
    expect(push).not.toHaveBeenCalled();
    expect(moduleParam(window.location.href)).toBe('packaging');
  });

  it('an unknown module id falls back to the persisted location', () => {
    useNavigationStore.getState().navigateToModule('evaluator');
    window.history.replaceState({}, '', '/?legacy=1&module=not-a-module');
    renderHook(() => useShellRouteSync());
    expect(useNavigationStore.getState().activeCategory).toBe('evaluator');
    expect(moduleParam(window.location.href)).toBe('evaluator');
  });
});

describe('Back undoes a shell flip', () => {
  it('LayoutLab "Legacy shell" marks the lab entry legacy=0 before pushing legacy=1, so Back is the lab', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const push = vi.spyOn(window.history, 'pushState');
    render(<LayoutLab />);
    replace.mockClear();
    push.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Legacy shell' }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
    expect(new URL(String(replace.mock.calls[0][2]), 'http://localhost').searchParams.get('legacy')).toBe('0');
    // The lab entry now carries its own address (c/e/s/v, labRoute.ts); the shell flag is what is pinned here.
    expect(new URLSearchParams(window.location.search).get('legacy')).toBe('1');
    expect(readShellPref()).toBe('legacy');

    await traverse('back');
    expect(new URLSearchParams(window.location.search).get('legacy')).toBe('0');
    expect(readShellPref()).toBe('ecw');
  }, 30_000);

  it('the legacy header Blueprint switch mirrors it: Back returns to the legacy module', async () => {
    window.history.replaceState({}, '', '/?legacy=1&module=audio');
    render(<NewShellButton />);
    fireEvent.click(screen.getByRole('button', { name: /Blueprint/ }));
    expect(readShellPref()).toBe('ecw');

    await traverse('back');
    expect(readShellPref()).toBe('legacy');
    expect(moduleParam(window.location.href)).toBe('audio');
  });
});
