import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { PipelinesView } from '@/components/status/PipelinesView';
import type { Result } from '@/types/result';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// The view imports the generated registry for its side effect (self-registration). The
// pipelines it maps come from the mock below, so loading all ~342 real steps here would
// only slow the case down.
vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));

const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
const produce = () => ({ data: {}, ueAssets: [] });
const accept = () => ({ label: 'a', status: 'pass' as const, tier: 'L0' as const, detail: '' });
const step = (label: string) => ({ archetype: 'brief', label, engine: 'Claude', view, produce, accept });

vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  return {
    ...actual,
    allCatalogPipelines: () => [
      { catalogId: 'items', steps: [step('Concept Brief'), step('Economy')] },
      { catalogId: 'npcs', steps: [step('Concept Brief'), step('Economy')] },
    ],
  };
});

/** `items` answers with a produced artifact; `npcs` fails the read. */
const fetchArtifactsResult = vi.fn(
  async (catalogId: string): Promise<Result<PipelineArtifact[], string>> => {
    if (catalogId === 'npcs') return { ok: false, error: 'HTTP 500' };
    return {
      ok: true,
      data: [
        { catalogId: 'items', entityId: 'e1', step: 'Concept Brief', data: {}, ueAssets: [], status: 'pass', tier: 'L0' },
        { catalogId: 'items', entityId: 'e1', step: 'Economy', data: {}, ueAssets: [], status: 'pass', tier: 'L0' },
      ],
    };
  },
);

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: (catalogId: string) => fetchArtifactsResult(catalogId),
  fetchArtifacts: vi.fn(async () => []),
}));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, tryApiFetch: vi.fn().mockResolvedValue({ ok: true, data: [] }) };
});

/** The readiness chip for a rung, e.g. `R0 NOT WIRED (2)`. */
function chip(container: HTMLElement, prefix: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').startsWith(prefix),
  ) as HTMLButtonElement | undefined;
}

/** A rendered swimlane is the lane-label button; its title names the catalog. */
function lane(container: HTMLElement, catalogId: string): Element | null {
  return container.querySelector(`[title^="Focus an entity — ${catalogId} "]`);
}

beforeEach(() => {
  fetchArtifactsResult.mockClear();
});
afterEach(cleanup);

describe('PipelinesView — a failed read is not a grade', () => {
  it('renders a catalog whose fetch failed as UNKNOWN, never as R0 NOT WIRED', async () => {
    const { container } = render(<PipelinesView onFocusCatalog={vi.fn()} />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="unknown-lane-npcs"]')).toBeTruthy();
    });

    // The failed catalog gets NO swimlane — a lane built from the failure's `[]` would
    // paint both its steps R0 NOT WIRED, which is a grade the data does not support.
    expect(lane(container, 'npcs')).toBeNull();
    const r0 = chip(container, 'R0 NOT WIRED');
    expect(r0).toBeTruthy();
    expect(r0!.textContent).toContain('(0)');
    // …and the ladder chip is disabled precisely because nothing reached R0.
    expect(r0!.hasAttribute('disabled')).toBe(true);

    // The unknown row shows no percentage — an em dash where the readiness number goes.
    const row = container.querySelector('[data-testid="unknown-lane-npcs"]')!;
    expect(row.textContent).toContain('UNKNOWN');
    expect(row.textContent).toContain('HTTP 500');
    expect(row.textContent).not.toMatch(/\d+%/);
  });

  it('keeps partial failure partial — the catalogs that answered still render', async () => {
    const { container } = render(<PipelinesView onFocusCatalog={vi.fn()} />);

    await waitFor(() => {
      expect(lane(container, 'items')).toBeTruthy();
    });
    // Exactly the two cells `items` actually reported — `npcs` contributes none, rather
    // than two fabricated R0 ones.
    const cells = container.querySelectorAll('[title="Show the stored output this evaluation was based on"]');
    expect(cells.length).toBe(2);
    // Both landed on a real rung (R3 TRUSTED: an L0 pass from an LLM-class engine).
    expect(chip(container, 'R3')!.textContent).toContain('(2)');
    // The whole map did not collapse into the all-or-nothing LOAD FAILED alert.
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('names the unknown lanes in a degraded banner with a retry, and never auto-retries', async () => {
    const { container } = render(<PipelinesView onFocusCatalog={vi.fn()} />);

    const banner = await waitFor(() => {
      const b = container.querySelector('[data-testid="unknown-lanes-banner"]');
      expect(b).toBeTruthy();
      return b!;
    });
    expect(banner.textContent).toContain('npcs');
    expect(banner.textContent).toContain('PARTIAL');
    expect(banner.textContent).toContain('not R0 NOT WIRED');

    // Exactly one read per catalog: a failed lane must never re-issue on its own, or a
    // 500 would spin a fetch loop.
    expect(fetchArtifactsResult).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchArtifactsResult).toHaveBeenCalledTimes(2);

    // The operator-driven retry does re-issue.
    const reload = [...banner.querySelectorAll('button')].find((b) => b.textContent === 'Reload map');
    expect(reload).toBeTruthy();
    fireEvent.click(reload!);
    await waitFor(() => {
      expect(fetchArtifactsResult).toHaveBeenCalledTimes(4);
    });
  });
});
