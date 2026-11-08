import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { RefreshFromServer } from '@/components/layout-lab/RefreshFromServer';
import { RefreshCatalogFromServer } from '@/components/layout-lab/RefreshCatalogFromServer';
import { LIGHT } from '@/components/layout-lab/theme';
import type { RefreshOutcome } from '@/components/layout-lab/labPipelineStore';
import type { CatalogRefreshOutcome } from '@/components/layout-lab/labCatalogRefresh';

afterEach(cleanup);

const outcome = (over: Partial<RefreshOutcome> = {}): RefreshOutcome => ({
  adopted: [], removed: [], kept: [], unchanged: 0, ...over,
});

const entityProps = { t: LIGHT, onRefresh: () => {}, refreshing: false, error: null, onDismiss: () => {} };

describe('<RefreshFromServer /> — a refresh always reports what it did', () => {
  it('says the server holds nothing when every count is zero', () => {
    const { getByTestId } = render(<RefreshFromServer {...entityProps} outcome={outcome()} />);
    expect(getByTestId('refresh-outcome').textContent).toBe('The server holds no artifacts for this entity.');
  });

  it('reads "Up to date" only when nothing moved', () => {
    const many = render(<RefreshFromServer {...entityProps} outcome={outcome({ unchanged: 3 })} />);
    expect(many.getByTestId('refresh-outcome').textContent).toBe('Up to date — 3 steps match the server.');
  });

  it('names every kept (local-only) and removed step — nothing reconciled silently', () => {
    const { getByTestId } = render(
      <RefreshFromServer {...entityProps} outcome={outcome({ adopted: ['Art'], removed: ['Gate'], kept: ['Economy', 'Lore'], unchanged: 2 })} />,
    );
    const text = getByTestId('refresh-outcome').textContent ?? '';
    expect(text).toContain('1 adopted · 1 removed · 2 kept · 2 unchanged');
    expect(text).toContain('Kept (local only, not on the server): Economy, Lore');
    expect(text).toContain('Removed (the server no longer has): Gate');
    expect(text).not.toContain('Up to date');
  });

  it('shows the failure with a retry and no outcome when the GET failed', () => {
    const onRefresh = vi.fn();
    const { container, queryByTestId } = render(
      <RefreshFromServer {...entityProps} onRefresh={onRefresh} error="HTTP 503" outcome={outcome({ unchanged: 4 })} />,
    );
    expect(queryByTestId('refresh-outcome')).toBeNull();
    expect(container.textContent).toContain('Refresh failed — nothing was changed: HTTP 503');
  });

  it('disables the button and says so while refreshing', () => {
    const { getByTestId } = render(<RefreshFromServer {...entityProps} refreshing outcome={null} />);
    const btn = getByTestId('refresh-from-server') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Refreshing…');
    fireEvent.click(btn);
  });
});

const catOutcome = (n: number): CatalogRefreshOutcome => ({
  entities: Array.from({ length: n }, (_, i) => ({
    entityId: `e${i}`, entityName: `Entity ${i}`,
    outcome: outcome({ adopted: i === 0 ? ['Art'] : [], kept: i === 0 ? ['Lore'] : ['Economy'], removed: i === 0 ? ['Gate'] : [] }),
  })),
  rows: 10, reconciled: n, adopted: 1, removed: 1, kept: n, unchanged: 0,
});

describe('<RefreshCatalogFromServer /> — catalog-wide report', () => {
  const props = { t: LIGHT, onRefresh: () => {}, refreshing: false, error: null, onDismiss: () => {} };

  it('names which steps moved per entity, with the local-only ones called out', () => {
    const { getByTestId } = render(<RefreshCatalogFromServer {...props} outcome={catOutcome(1)} />);
    expect(getByTestId('catalog-refresh-detail').textContent)
      .toBe('Entity 0: adopted Art · removed Gate (gone from the server) · kept Lore (local only)');
  });

  it('names at most 4 entities and counts the rest instead of dropping them', () => {
    const { getByTestId } = render(<RefreshCatalogFromServer {...props} outcome={catOutcome(6)} />);
    const detail = getByTestId('catalog-refresh-detail');
    expect(detail.children).toHaveLength(5);
    expect(detail.textContent).toContain('Entity 3: kept Economy (local only)');
    expect(detail.textContent).not.toContain('Entity 4:');
    expect(detail.textContent).toContain('+2 more entities changed');
  });

  it('lists no detail block when nothing moved', () => {
    const { queryByTestId, getByTestId } = render(<RefreshCatalogFromServer {...props} outcome={catOutcome(0)} />);
    expect(getByTestId('catalog-refresh-outcome')).not.toBeNull();
    expect(queryByTestId('catalog-refresh-detail')).toBeNull();
  });
});
