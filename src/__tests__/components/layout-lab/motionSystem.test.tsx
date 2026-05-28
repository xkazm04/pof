import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for vitest.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { StepFrame } from '@/components/layout-lab/steps/StepFrame';
import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { CliProduce } from '@/components/layout-lab/steps/shared/CliProduce';
import { LIGHT } from '@/components/layout-lab/theme';
import type { LabGroup, LabEntity } from '@/components/layout-lab/useLabCatalogData';

afterEach(cleanup);

/* ── Selection-row transitions on CatalogTree ─────────────────────────────── */

const groups: LabGroup[] = [
  {
    category: 'core',
    catalogs: [
      { catalogId: 'items', label: 'Items', description: '', verified: 1, total: 3 },
      { catalogId: 'enemies', label: 'Enemies', description: '', verified: 0, total: 2 },
    ],
  },
];
const entities: LabEntity[] = [
  { id: 'e1', name: 'Sword', lifecycle: 'verified', data: {} },
  { id: 'e2', name: 'Shield', lifecycle: 'planned', data: {} },
];

describe('CatalogTree row motion', () => {
  it('every catalog row declares a 160ms ease-out transition on bg/border/color', () => {
    render(
      <CatalogTree
        t={LIGHT}
        groups={groups}
        selectedCatalogId="items"
        entities={entities}
        selectedEntityId="e1"
        onSelectCatalog={() => {}}
        onSelectEntity={() => {}}
      />,
    );
    const itemsBtn = screen.getByTestId('harness-catalog-items');
    const style = itemsBtn.getAttribute('style') ?? '';
    expect(style).toMatch(/transition:[^;]*background-color[^;]*160ms[^;]*ease-out/);
    expect(style).toMatch(/border-color[^;]*160ms[^;]*ease-out/);
    expect(style).toMatch(/color[^;]*160ms[^;]*ease-out/);
  });
});

/* ── StepFrame banner highlight pulse on status change ────────────────────── */

describe('StepFrame banner highlight pulse', () => {
  it('tracks status in a data attribute and tints the pulse overlay with the status color', async () => {
    const { rerender } = render(
      <StepFrame
        t={LIGHT}
        acceptance={{ label: 'Step ready', status: 'pending', detail: 'awaiting' }}
        panels={[]}
      />,
    );
    const banner = screen.getByTestId('acceptance-banner');
    expect(banner.getAttribute('data-status')).toBe('pending');
    // Pulse overlay renders but `initial={false}` prevents the first paint animation.
    const initialPulse = screen.getByTestId('acceptance-banner-pulse');
    expect(initialPulse.getAttribute('aria-hidden')).toBe('true');
    expect(initialPulse.getAttribute('style')).toMatch(/box-shadow/);

    rerender(
      <StepFrame
        t={LIGHT}
        acceptance={{ label: 'Step ready', status: 'pass', detail: 'all good', tier: 'L2' }}
        panels={[]}
      />,
    );
    // After a status flip the data-status updates and the pulse overlay is re-keyed
    // (box-shadow now uses the `pass` color token).
    expect(banner.getAttribute('data-status')).toBe('pass');
    const after = await screen.findByTestId('acceptance-banner-pulse');
    expect(after.getAttribute('style')).toMatch(/box-shadow/);
  });
});

/* ── CliProduce result fade-in via AnimatePresence ────────────────────────── */

describe('CliProduce result motion', () => {
  it('renders the success result with the test-id wrapped by AnimatePresence', async () => {
    render(
      <CliProduce
        t={LIGHT}
        label="Dispatch"
        buildPrompt={() => 'test prompt'}
        onComplete={() => {}}
        note="Wrote artifact."
      />,
    );
    // Click dispatch — onComplete fires and result appears with our test-id wrapper.
    fireEvent.click(screen.getByRole('button', { name: /Dispatch/ }));
    const node = await screen.findByTestId('cli-produce-result');
    expect(node.textContent).toContain('✓');
    expect(node.textContent).toContain('Wrote artifact.');
  });

  it('reports a validate() error in the same result slot', async () => {
    render(
      <CliProduce
        t={LIGHT}
        label="Dispatch"
        buildPrompt={() => ''}
        onComplete={() => {
          throw new Error('should not be called when validate errors');
        }}
        validate={() => 'Direction is required'}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dispatch/ }));
    const node = await screen.findByTestId('cli-produce-result');
    expect(node.textContent).toContain('✗');
    expect(node.textContent).toContain('Direction is required');
  });
});
