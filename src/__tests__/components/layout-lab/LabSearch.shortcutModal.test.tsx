/**
 * Ctrl/Cmd+K and "/" must not open lab search over another aria-modal dialog (the narrow-shell
 * drawer, a ConfirmDialog): two focus traps would compete. With no modal open they still open it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { useLabSearchShortcut } from '@/components/layout-lab/LabSearch';

const press = (init: KeyboardEventInit) => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
});

afterEach(() => { cleanup(); document.body.innerHTML = ''; });

describe('useLabSearchShortcut with another modal open', () => {
  it.each([
    ['Ctrl+K', { key: 'k', ctrlKey: true }],
    ['/', { key: '/' }],
  ])('%s does not open search over an aria-modal dialog', (_n, init) => {
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    const { result } = renderHook(() => useLabSearchShortcut());
    press(init);
    expect(result.current[0]).toBe(false);
  });

  it.each([
    ['Ctrl+K', { key: 'k', ctrlKey: true }],
    ['/', { key: '/' }],
  ])('%s still opens search when no modal is open', (_n, init) => {
    const { result } = renderHook(() => useLabSearchShortcut());
    press(init);
    expect(result.current[0]).toBe(true);
  });
});
