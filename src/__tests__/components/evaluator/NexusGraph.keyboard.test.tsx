/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the Nexus map's module nodes
 * were mouse-only (`<g onClick>`, no role / tabIndex / key handler) while the twin
 * DependencyGraph canvas had been made keyboard-operable. Per canvas-graph /
 * canvas-accessibility the map is ONE tab stop (a named group), with a roving cursor
 * moved by arrow keys / Home / End and Enter / Space selecting the focused node.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false, isLoading: false, error: null, refresh: async () => {} }),
}));

import { NexusView } from '@/components/modules/evaluator/NexusView';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';

const ok = (data: unknown) => ({ body: { success: true, data } });

beforeEach(() => {
  invalidateFeatureStatuses();
  mockFetchRoutes([
    { match: '/api/feature-matrix/all-statuses', response: ok({ statuses: [{ moduleId: 'arpg-combat', featureName: 'core', status: 'implemented' }] }) },
    { match: '/api/pattern-library', response: ok({ patterns: [] }) },
    { match: '/api/evaluator/results', response: ok({ scans: [] }) },
    { match: '/api/session-analytics', response: ok({ totalSessions: 0, moduleStats: [] }) },
  ]);
});
afterEach(cleanup);

async function renderMap() {
  const utils = render(<NexusView />);
  await waitFor(() => expect(utils.container.querySelectorAll('g[role="button"]').length).toBeGreaterThan(1));
  return utils;
}

const nodes = (c: HTMLElement) => Array.from(c.querySelectorAll('g[role="button"]')) as SVGGElement[];

describe('NexusGraph — keyboard-operable module nodes', () => {
  it('the map is a named group with exactly ONE tab stop among its nodes', async () => {
    const { container } = await renderMap();
    const svg = container.querySelector('svg[width="100%"]')!;
    expect(svg.getAttribute('role')).toBe('group');
    expect(svg.getAttribute('aria-label') ?? '').toMatch(/\d+ modules, \d+ connections/);
    const all = nodes(container);
    expect(all.filter((n) => n.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(all.every((n) => /features implemented/.test(n.getAttribute('aria-label') ?? ''))).toBe(true);
  });

  it('arrow keys move the roving cursor; End/Home jump to the ends', async () => {
    const { container } = await renderMap();
    const all = nodes(container);
    fireEvent.keyDown(all[0], { key: 'ArrowRight' });
    expect(nodes(container)[1].getAttribute('tabindex')).toBe('0');
    expect(nodes(container)[0].getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(nodes(container)[1], { key: 'End' });
    expect(nodes(container)[all.length - 1].getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(nodes(container)[all.length - 1], { key: 'Home' });
    expect(nodes(container)[0].getAttribute('tabindex')).toBe('0');
  });

  it('Enter selects the focused node and opens its deep-dive; Space toggles it off', async () => {
    const { container } = await renderMap();
    const first = nodes(container)[0];
    expect(first.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(first, { key: 'Enter' });
    await waitFor(() => expect(nodes(container)[0].getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    fireEvent.keyDown(nodes(container)[0], { key: ' ' });
    await waitFor(() => expect(nodes(container)[0].getAttribute('aria-pressed')).toBe('false'));
  });
});
