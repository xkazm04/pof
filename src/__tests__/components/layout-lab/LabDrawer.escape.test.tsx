/**
 * LabDrawer's doc says "Backdrop click or Escape closes it", and it declares aria-modal —
 * the shared Modal it stands in for closes on Escape. The drawer only ever handled Tab, so a
 * keyboard user inside the narrow-shell Catalogs / Pipeline drawer had no way out but the
 * close button: Escape did nothing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LabDrawer } from '@/components/layout-lab/LabDrawer';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

function renderDrawer(onClose: () => void) {
  render(
    <LabDrawer t={LIGHT} open onClose={onClose} id="lab-tree-drawer" title="Catalogs" width={300}>
      <button data-testid="inner">Items</button>
    </LabDrawer>,
  );
}

describe('LabDrawer — Escape closes it', () => {
  it('Escape pressed on a control inside the drawer closes it', () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    fireEvent.keyDown(screen.getByTestId('inner'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape pressed on the panel itself closes it', () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Catalogs' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('other keys do not close it', () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    fireEvent.keyDown(screen.getByTestId('inner'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('inner'), { key: 'Tab' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
