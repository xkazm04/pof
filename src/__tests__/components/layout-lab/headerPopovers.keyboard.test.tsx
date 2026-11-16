/**
 * The header popovers declare role=dialog, so they must behave like one from the keyboard:
 * focus enters the panel on open, Escape closes it and returns focus to the trigger, and
 * Escape pressed outside the popover (another dialog's key) leaves it alone.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/components/bridge-doctor/BridgeDoctor', () => ({ BridgeDoctor: () => null }));
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchDrainLease: vi.fn().mockResolvedValue({ held: false, scope: null, since: null, scopes: [] }),
}));

import { ActivityChip } from '@/components/layout-lab/ActivityChip';
import { LabBridgeStrip } from '@/components/layout-lab/LabBridgeStrip';
import { LIGHT } from '@/components/layout-lab/theme';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  usePofBridgeStore.setState({ connectionStatus: 'connected', pluginInfo: null });
});

const CASES = [
  { name: 'ActivityChip', mount: () => render(<ActivityChip t={LIGHT} />), trigger: () => screen.getByTestId('lab-activity-chip'), dialog: 'What is running right now' },
  { name: 'LabBridgeStrip', mount: () => render(<LabBridgeStrip t={LIGHT} />), trigger: () => screen.getByRole('button'), dialog: 'Bridge Doctor' },
];

describe.each(CASES)('$name popover keyboard behaviour', ({ mount, trigger, dialog }) => {
  it('moves focus into the dialog on open', () => {
    mount();
    fireEvent.click(trigger());
    const panel = screen.getByRole('dialog', { name: dialog });
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it('Escape closes and restores focus to the trigger', () => {
    mount();
    fireEvent.click(trigger());
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: dialog })).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('Escape outside the popover does not close it', () => {
    mount();
    fireEvent.click(trigger());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: dialog })).not.toBeNull();
  });
});
