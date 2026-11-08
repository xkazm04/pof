/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the constellation svg was
 * role=img (flattening every node's status) and its prerequisite-chain highlight was
 * hover-only. Mirrors NexusGraph.keyboard.test.tsx: ONE tab stop, roving arrows,
 * focus drives the same lit chain as hover.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { FeatureConstellation } from '@/components/modules/evaluator/FeatureConstellation';

afterEach(cleanup);

const STATUSES = [
  { moduleId: 'arpg-character', featureName: 'AARPGCharacterBase', status: 'implemented' },
  { moduleId: 'arpg-character', featureName: 'AARPGPlayerCharacter', status: 'partial' },
];

const nodes = (c: HTMLElement) => Array.from(c.querySelectorAll('g[data-constellation-node]')) as SVGGElement[];

async function renderMap() {
  mockFetch({ body: { success: true, data: { statuses: STATUSES } } });
  const utils = render(<FeatureConstellation />);
  await screen.findByRole('group', { name: /feature constellation/i });
  return utils;
}

describe('FeatureConstellation — keyboard-operable nodes', () => {
  it('is a named group with exactly ONE tab stop and labelled nodes', async () => {
    const { container } = await renderMap();
    const svg = screen.getByRole('group', { name: /feature constellation/i });
    expect(svg.getAttribute('aria-label') ?? '').toMatch(/\d+ features, \d+ blocked/);
    const all = nodes(container);
    expect(all.length).toBeGreaterThan(1);
    expect(all.filter((n) => n.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(all.every((n) => (n.getAttribute('aria-label') ?? '').length > 0)).toBe(true);
  });

  it('arrow keys move the roving cursor; End/Home jump to the ends', async () => {
    const { container } = await renderMap();
    const count = nodes(container).length;
    fireEvent.keyDown(nodes(container)[0], { key: 'ArrowRight' });
    expect(nodes(container)[1].getAttribute('tabindex')).toBe('0');
    expect(nodes(container)[0].getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(nodes(container)[1], { key: 'End' });
    expect(nodes(container)[count - 1].getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(nodes(container)[count - 1], { key: 'Home' });
    expect(nodes(container)[0].getAttribute('tabindex')).toBe('0');
  });

  it('focus lights the prerequisite chain (dims unrelated edges); blur restores', async () => {
    const { container } = await renderMap();
    const edgeOpacities = () => Array.from(container.querySelectorAll('path[marker-end]')).map((p) => p.getAttribute('opacity'));
    expect(edgeOpacities().length).toBeGreaterThan(0);
    expect(edgeOpacities().some((o) => o === '0.08')).toBe(false);
    fireEvent.focus(nodes(container)[0]);
    await waitFor(() => expect(edgeOpacities().some((o) => o === '0.08' || o === '0.95')).toBe(true));
    fireEvent.blur(nodes(container)[0]);
    await waitFor(() => expect(edgeOpacities().some((o) => o === '0.08' || o === '0.95')).toBe(false));
  });
});
