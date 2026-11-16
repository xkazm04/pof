import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/**
 * scan-sweep night 2026-11-08 game-ui-hud: every Screen Flow row is a
 * disclosure, so its button must say whether it is open (aria-expanded) and
 * must keep a keyboard focus ring instead of suppressing the outline.
 */

vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: () => ({ generate: () => {}, isRunning: false }),
}));

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({
    featureMap: new Map(),
    stats: { total: 0, implemented: 0, partial: 0, missing: 0 },
    defs: [],
    isLoading: false,
  }),
}));

import { ScreenFlowMap } from '@/components/modules/core-engine/sub_ui';
import { useCatalogStore } from '@/stores/catalogStore';
import { seedScreenEntries } from '@/lib/catalog/seed-screen-flow';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-ui' as SubModuleId;

/** The 8 disclosure rows: the HUD root plus 7 screen-node rows. */
const ROWS = [
  /Main HUD Layout/, /GAS attribute binding/, /Ability cooldown UI/, /Inventory screen/,
  /Character stats screen/, /Pause\/settings menus/, /Enemy health bars/, /Floating damage numbers/,
];

beforeEach(() => {
  useCatalogStore.getState().setEntities('screen-flow', seedScreenEntries());
});
afterEach(cleanup);

describe('Screen Flow rows are real disclosures', () => {
  it.each(ROWS.map((r) => [r]))('%s toggles aria-expanded and keeps a focus ring', (name) => {
    render(<ScreenFlowMap moduleId={MODULE} />);
    const btn = screen.getByRole('button', { name });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name }).getAttribute('aria-expanded')).toBe('true');
    expect(btn.className).toContain('focus-ring');
    expect(btn.className).not.toMatch(/(^|\s)focus:outline-none(\s|$)/);
  });
});
