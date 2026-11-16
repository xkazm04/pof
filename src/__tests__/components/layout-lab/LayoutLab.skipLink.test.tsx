/**
 * The lab header's "Skip to canvas" link pointed at `#lab-canvas`, an id only Baseline's
 * <main> carries. On the Matrix, Canon and Game views that element is unmounted, so the
 * skip link — the keyboard user's way past a header of ~14 controls — jumped nowhere.
 * The target must exist on every view (app-shell: "a skip link exists" on every page).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const skipTarget = () => {
  const link = screen.getByText('Skip to canvas').closest('a') as HTMLAnchorElement;
  const id = (link.getAttribute('href') ?? '').replace(/^#/, '');
  return id ? document.getElementById(id) : null;
};

describe('LayoutLab skip link reaches a target on every view', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ success: false, error: 'offline in test' }),
    } as unknown as Response)));
  });

  it.each([['Catalogs'], ['Matrix'], ['Canon'], ['Game']])('%s view', async (view) => {
    render(<LayoutLab />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: view })); });
    // Let AnimatePresence finish the outgoing view's exit, so the old view's DOM is gone.
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    if (view !== 'Catalogs') expect(document.querySelector('main#lab-canvas')).toBeNull();
    const target = skipTarget();
    expect(target).not.toBeNull();
    // Focusable by script, so following the link moves keyboard focus into the content.
    expect(target?.getAttribute('tabindex')).toBe('-1');
  });
});
