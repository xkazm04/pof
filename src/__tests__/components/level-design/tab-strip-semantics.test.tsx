/**
 * The level-design document tab strip must expose tab semantics: a tablist, 11
 * tabs, exactly one aria-selected, a roving tab stop and arrow-key navigation.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import type { LevelDesignDocument } from '@/types/level-design';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const DOC: LevelDesignDocument = {
  id: 7, name: 'Sunken Crypt', description: '', designNarrative: '', rooms: [], connections: [],
  difficultyArc: [], pacingNotes: '', syncStatus: 'unlinked', syncReport: [],
  lastGeneratedAt: null, lastCodeHash: null, createdAt: '', updatedAt: '',
};

async function openDoc() {
  const envelope = (data: unknown) => ({
    ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve(''),
  });
  globalThis.fetch = vi.fn(async (url: string | URL) => (
    String(url).startsWith('/api/level-design') ? envelope({ docs: [DOC] }) : envelope({})
  )) as unknown as typeof fetch;
  render(<LevelDesignView />);
  await waitFor(() => screen.getByText('Sunken Crypt'));
  fireEvent.click(screen.getByText('Sunken Crypt'));
  await waitFor(() => screen.getByText(/Flow Editor/));
}

describe('level design tab strip', () => {
  it('exposes 11 tabs in a tablist with exactly one aria-selected', async () => {
    await openDoc();
    const list = screen.getByRole('tablist');
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(11);
    expect(list.contains(tabs[0])).toBe(true);
    const selected = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain('Flow Editor');
    // Roving tab stop: only the selected tab is in the tab order.
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('ArrowRight / ArrowLeft / End / Home move focus and selection', async () => {
    await openDoc();
    const tab = (name: RegExp) => screen.getByRole('tab', { name });
    fireEvent.keyDown(tab(/Flow Editor/), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab(/Procgen/));
    expect(tab(/Procgen/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/Procgen/), { key: 'ArrowLeft' });
    expect(tab(/Flow Editor/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/Flow Editor/), { key: 'End' });
    expect(tab(/Pacing/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/Pacing/), { key: 'Home' });
    expect(tab(/Overview/).getAttribute('aria-selected')).toBe('true');
  });
});
