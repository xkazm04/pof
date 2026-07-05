/**
 * Ship-loop Milestone 2 (a11y item 6): the dependency-graph module nodes were
 * mouse-only (`<g onClick>` with no role/tabIndex/keyboard/aria — WCAG 2.1.1 fail).
 * These tests lock in keyboard + screen-reader operability so it can't regress.
 * (The component fetches status on mount + shows a spinner first, so waitFor the graph.)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));
vi.mock('@/lib/api-utils', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-utils')>();
  // Non-empty statuses so the graph renders (statusMap.size === 0 short-circuits to an EmptyState).
  return {
    ...actual,
    tryApiFetch: vi.fn().mockResolvedValue({
      ok: true,
      data: { statuses: [{ moduleId: 'arpg-character', featureName: 'core', status: 'implemented' }] },
    }),
  };
});

import { DependencyGraph } from '@/components/modules/evaluator/DependencyGraph';

afterEach(cleanup);

async function renderGraph() {
  const utils = render(<DependencyGraph />);
  // The graph fetches status first (spinner), then renders once statusMap is non-empty.
  await waitFor(
    () => expect(utils.container.querySelectorAll('g[role="button"]').length).toBeGreaterThan(0),
    { timeout: 3000 },
  );
  return utils;
}

describe('DependencyGraph a11y — graph nodes keyboard + screen-reader operable', () => {
  it('renders each module node as a labelled, focusable button', async () => {
    const { container } = await renderGraph();
    const first = container.querySelector('g[role="button"]') as SVGGElement;
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('aria-label') ?? '').toMatch(/features implemented/i);
    expect(first.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles selection via Enter (not just click)', async () => {
    const { container } = await renderGraph();
    const node = container.querySelector('g[role="button"]') as SVGGElement;
    expect(node.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(node, { key: 'Enter' });
    await waitFor(() =>
      expect(
        (container.querySelectorAll('g[role="button"]')[0] as SVGGElement).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
  });

  it('toggles selection via Space as well', async () => {
    const { container } = await renderGraph();
    const node = container.querySelector('g[role="button"]') as SVGGElement;
    fireEvent.keyDown(node, { key: ' ' });
    await waitFor(() =>
      expect(
        (container.querySelectorAll('g[role="button"]')[0] as SVGGElement).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
  });
});
