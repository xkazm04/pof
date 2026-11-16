/**
 * The narrow-shell drawers declare `role="dialog"` + `aria-modal="true"` — a promise that
 * focus is inside and stays inside. LabDrawer kept none of it: opening left focus on the
 * header toggle behind the scrim, Tab walked out into the page an AT user was told is inert,
 * and closing dropped focus on <body>. (The shared Modal owns these guarantees, but it is a
 * centred dialog; the drawer is a left slide-over, so it carries them itself.)
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

const Harness = ({ open }: { open: boolean }) => (
  <>
    <button data-testid="trigger">Catalogs</button>
    <LabDrawer t={LIGHT} open={open} onClose={() => {}} id="lab-tree-drawer" title="Catalogs" width={300}>
      <button data-testid="first-item">Items</button>
      <button data-testid="last-item">Spellbook</button>
    </LabDrawer>
  </>
);

describe('LabDrawer — an aria-modal dialog owns focus', () => {
  it('moves focus in on open, traps Tab both ways, and restores the trigger on close', () => {
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();

    rerender(<Harness open />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    screen.getByTestId('last-item').focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close drawer' }));

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last-item'));

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(trigger);
  });
});
