import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { ItemFocusView } from '@/components/status/ItemFocusView';
import { useCatalogStore } from '@/stores/catalogStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';
import { invalidateJudgeVerdicts } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { toStepSummary } from '@/components/layout-lab/stepSummary';
import type { CatalogEntityBase } from '@/lib/catalog/types';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Per-catalog artifacts: the sword produced Economy but NOT 3D-Mesh; the loot table
// produced its one step.
const BY_CATALOG: Record<string, PipelineArtifact[]> = {
  items: [{ catalogId: 'items', entityId: 'sword', step: 'Economy', data: {}, ueAssets: [], status: 'pass', tier: 'L0' }],
  'loot-tables': [{ catalogId: 'loot-tables', entityId: 'lt1', step: 'Drop-Rates', data: {}, ueAssets: [], status: 'pass', tier: 'L0' }],
  'icon-sets': [],
};

/** The server, at the wire. `failing` names catalogs whose artifact read answers a 500. */
let urls: string[] = [];
let failing = new Set<string>();
let verdictsOk = true;
function answer(url: string): unknown {
  if (url.startsWith('/api/judge-verdicts')) {
    return verdictsOk ? { success: true, data: [] } : { success: false, error: 'HTTP 500' };
  }
  const catalogId = new URLSearchParams(url.split('?')[1] ?? '').get('catalogId') ?? '';
  if (failing.has(catalogId)) return { success: false, error: 'HTTP 500' };
  const rows = BY_CATALOG[catalogId] ?? [];
  if (url.startsWith('/api/pipeline-artifacts/summary')) return { success: true, data: rows.map(toStepSummary) };
  return { success: true, data: rows };
}

// Fixed tiny pipelines so cells are deterministic (keep registerCatalogPipeline intact).
vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  const accept = () => ({ label: 'a', status: 'pass' as const, tier: 'L0' as const, detail: '' });
  const steps: Record<string, { label: string; engine: string }[]> = {
    items: [{ label: 'Economy', engine: 'Claude' }, { label: '3D-Mesh', engine: 'Tripo' }],
    'loot-tables': [{ label: 'Drop-Rates', engine: 'Claude' }],
    'icon-sets': [{ label: 'Icon', engine: 'Leonardo' }],
  };
  return {
    ...actual,
    getCatalogPipeline: (id: string) =>
      steps[id] ? { catalogId: id, steps: steps[id].map((s) => ({ archetype: 'brief', label: s.label, engine: s.engine, view, produce, accept })) } : null,
  };
});

function ent(catalogId: string, id: string, name: string, links: CatalogEntityBase['links'] = []): CatalogEntityBase {
  return { id, catalogId, name, categoryPath: [], tags: [], lifecycle: 'planned', links };
}

beforeEach(() => {
  urls = [];
  failing = new Set();
  verdictsOk = true;
  _resetArtifactCache();
  invalidateJudgeVerdicts();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(String(url));
    return { ok: true, status: 200, json: async () => answer(String(url)) };
  }));
  useCatalogStore.setState({
    entitiesByCatalog: {
      items: { sword: ent('items', 'sword', 'Vael Blade', [{ catalogId: 'icon-sets', entityId: 'icon1', role: 'icon' }]) },
      'icon-sets': { icon1: ent('icon-sets', 'icon1', 'Sword Icon') },
      'loot-tables': { lt1: ent('loot-tables', 'lt1', 'Brute Loot', [{ catalogId: 'items', entityId: 'sword', role: 'loot' }]) },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ItemFocusView', () => {
  it('renders the focus entity, its reverse dependent, and its forward binding', async () => {
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={vi.fn()} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Vael Blade');
      expect(container.textContent).toContain('Brute Loot'); // reverse dependent
      expect(container.textContent).toContain('Sword Icon');  // forward binding
    });
  });

  it('grades the focus entity by its OWN realization (3D-Mesh never produced → unwired)', async () => {
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={vi.fn()} />);
    await waitFor(() => {
      const cells = Array.from(container.querySelectorAll('[role="img"]'));
      const mesh = cells.find((c) => (c.getAttribute('aria-label') ?? '').startsWith('3D-Mesh'));
      expect(mesh).toBeTruthy();
      expect(mesh!.getAttribute('aria-label')).toContain('unwired');
    });
  });

  it('clicking a connected node refocuses onto it', async () => {
    const onFocus = vi.fn();
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={onFocus} />);
    await waitFor(() => expect(container.textContent).toContain('Brute Loot'));
    const lootBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.getAttribute('title') ?? '').includes('loot-tables · lt1'),
    );
    expect(lootBtn).toBeTruthy();
    fireEvent.click(lootBtn!);
    expect(onFocus).toHaveBeenCalledWith('loot-tables', 'lt1');
  });

  it('renders a linked catalog whose read failed as UNKNOWN, never 0% / unwired', async () => {
    failing = new Set(['icon-sets']);
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={vi.fn()} />);
    const row = await waitFor(() => {
      const r = container.querySelector('[data-testid="unknown-node-icon-sets-icon1"]');
      expect(r).toBeTruthy();
      return r!;
    });
    expect(row.textContent).toContain('UNKNOWN');
    expect(row.textContent).toContain('HTTP 500');
    expect(row.textContent).not.toMatch(/\d+%/);
    // The focus still grades from its own rows.
    const cells = Array.from(container.querySelectorAll('[role="img"]'));
    expect(cells.some((c) => (c.getAttribute('aria-label') ?? '').startsWith('Economy'))).toBe(true);
    // Only blob-free reads were paid for.
    expect(urls.filter((u) => u.startsWith('/api/pipeline-artifacts?'))).toEqual([]);
  });

  it('says PARTIAL when judge verdicts did not load', async () => {
    verdictsOk = false;
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={vi.fn()} />);
    await waitFor(() => {
      const n = [...container.querySelectorAll('[role="status"]')].find((el) => (el.textContent ?? '').includes('PARTIAL'));
      expect(n?.textContent).toContain('judge verdicts did not load');
    });
  });

  it('shows the empty prompt when no entity is focused', () => {
    const { container } = render(<ItemFocusView focus={null} onFocus={vi.fn()} />);
    expect(container.textContent).toContain('Search an entity');
  });
});
