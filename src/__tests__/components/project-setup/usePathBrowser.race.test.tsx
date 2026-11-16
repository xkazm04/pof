/**
 * usePathBrowser — the directory listing has two write paths (`browse` and
 * `navigateDrives`) into one slot, and the latest-wins token used to guard only
 * `browse`. A folder listing still in flight when the operator clicked "Drives"
 * landed afterwards and replaced the drive list with that folder.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

type Deferred = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const pending: { action: string; path?: string; d: Deferred }[] = [];

vi.mock('@/lib/api-utils', () => ({
  apiFetch: (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { action: string; path?: string };
    return new Promise((resolve, reject) => {
      pending.push({ action: body.action, path: body.path, d: { resolve, reject } });
    });
  },
}));

import { usePathBrowser } from '@/components/modules/project-setup/PathBrowser/usePathBrowser';

function listing(path: string) {
  return { path, parent: 'C:\\', directories: [{ name: 'Sub', path: `${path}\\Sub`, hasUProject: false }], uprojectFiles: [], isUEProject: false };
}

beforeEach(() => { pending.length = 0; });
afterEach(cleanup);

async function settle(action: string, value: unknown, path?: string) {
  const i = pending.findIndex((p) => p.action === action && (path === undefined || p.path === path));
  expect(i).toBeGreaterThanOrEqual(0);
  const [p] = pending.splice(i, 1);
  await act(async () => { p.d.resolve(value); });
}

describe('usePathBrowser — drives vs in-flight browse', () => {
  it('a folder listing that resolves after Drives does not overwrite the drive list', async () => {
    const { result } = renderHook(() =>
      usePathBrowser({ value: 'C:\\Start', startFresh: false, onSelect: () => {} }),
    );
    // Mount: detect-projects, then browse('C:\\Start').
    await settle('detect-projects', { projects: [] });
    await waitFor(() => expect(pending.some((p) => p.action === 'list')).toBe(true));

    // Operator clicks Drives while the folder listing is still in flight.
    act(() => { void result.current.navigateDrives(); });
    await settle('drives', { drives: [{ letter: 'C', path: 'C:\\' }, { letter: 'D', path: 'D:\\' }] });
    expect(result.current.directories.map((d) => d.name)).toEqual(['C:\\', 'D:\\']);

    // The stale folder listing lands last.
    await settle('list', listing('C:\\Start'), 'C:\\Start');
    expect(result.current.directories.map((d) => d.name)).toEqual(['C:\\', 'D:\\']);
    expect(result.current.currentPath).toBe('');
    expect(result.current.loading).toBe(false);
  });

  it('a drives answer that resolves after a newer browse does not overwrite it', async () => {
    const { result } = renderHook(() =>
      usePathBrowser({ value: 'C:\\Start', startFresh: false, onSelect: () => {} }),
    );
    await settle('detect-projects', { projects: [] });
    await settle('list', listing('C:\\Start'), 'C:\\Start');

    act(() => { void result.current.navigateDrives(); });
    act(() => { result.current.navigateUp(); });
    await settle('list', listing('C:\\'), 'C:\\');
    await settle('drives', { drives: [{ letter: 'Z', path: 'Z:\\' }] });

    expect(result.current.currentPath).toBe('C:\\');
    expect(result.current.directories.map((d) => d.name)).toEqual(['Sub']);
  });
});
