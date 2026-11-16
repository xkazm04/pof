/**
 * Switching Catalogs/Matrix/Canon/Game swaps the canvas in shell state (no route change), so
 * assistive tech must be told: a polite live region names the active view.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const announced = () => {
  const el = document.querySelector('[data-testid="lab-view-announcer"]');
  return { text: el?.textContent ?? null, live: el?.getAttribute('aria-live') ?? null, role: el?.getAttribute('role') ?? null };
};

describe('LayoutLab announces the active view', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ success: false, error: 'offline in test' }),
    } as unknown as Response)));
  });

  it.each([['Catalogs'], ['Matrix'], ['Canon'], ['Game']])('%s', async (view) => {
    render(<LayoutLab />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: view })); });
    expect(announced()).toEqual({ text: `${view} view`, live: 'polite', role: 'status' });
  });
});
