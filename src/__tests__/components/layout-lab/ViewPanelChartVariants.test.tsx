import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
// framer-motion's animated elements still render their DOM synchronously in jsdom, but
// stub useReducedMotion so the entrance transition never blocks the initial paint.
vi.mock('framer-motion', async (orig) => {
  const actual = await orig<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
import { ViewPanel } from '@/components/layout-lab/steps/ArchetypeStep';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { ViewDescriptor } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];
const view = (v: ViewDescriptor) => v;

/**
 * Direction 1 — every ChartPanel variant (bars/histogram/scatter/waveform) is reachable
 * through the generic ViewPanel `chart` branch (not just the two the fleet used before).
 */
describe('ViewPanel — chart variants render through the generic path', () => {
  afterEach(cleanup);

  it('bars renders a figure from a keyed numeric field', () => {
    render(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'bars', field: 'perf', rows: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], highlightKey: 'a' })} data={{ perf: { a: 180, b: 200 } }} />);
    expect(screen.getByRole('figure', { name: 'perf budget' })).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('histogram renders an img from a keys list', () => {
    render(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'histogram', field: 'dist', keys: ['x', 'y', 'z'] })} data={{ dist: { x: 6, y: 30, z: 25 } }} />);
    expect(screen.getByRole('img', { name: 'dist histogram' })).toBeTruthy();
  });

  it('scatter renders an img from reference + points arrays', () => {
    render(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'scatter', field: 'curve', referenceKey: 'ref', pointsKey: 'pts', xDomain: [0, 10], yDomain: [0, 10], xLabel: 'power', yLabel: 'value' })} data={{ curve: { ref: [{ x: 0, y: 0 }, { x: 10, y: 10 }], pts: [{ x: 5, y: 6, label: 'item' }] } }} />);
    expect(screen.getByRole('img', { name: 'curve scatter' })).toBeTruthy();
    // point label surfaces as an SVG <title>
    expect(screen.getByText('item')).toBeTruthy();
  });

  it('waveform renders an img from a samples array', () => {
    render(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'waveform', field: 'sig', samplesKey: 'samples', activeKey: 'active' })} data={{ sig: { samples: [0.1, 0.6, 0.3, 0.9], active: true } }} />);
    expect(screen.getByRole('img', { name: 'sig waveform' })).toBeTruthy();
  });

  it('each variant shows an honest empty state when its numeric data is absent', () => {
    const { rerender } = render(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'bars', field: 'perf', rows: [{ key: 'a' }] })} data={{ perf: {} }} />);
    expect(screen.getByText(/No numeric data yet/)).toBeTruthy();
    rerender(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'scatter', field: 'curve', referenceKey: 'ref', xDomain: [0, 1], yDomain: [0, 1] })} data={{ curve: {} }} />);
    expect(screen.getByText(/No numeric data yet/)).toBeTruthy();
    rerender(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'waveform', field: 'sig', samplesKey: 'samples' })} data={{ sig: {} }} />);
    expect(screen.getByText(/No numeric data yet/)).toBeTruthy();
  });

  it('a completely missing field reads as "run Produce", not a broken chart', () => {
    render(<ViewPanel t={t} view={view({ kind: 'chart', variant: 'bars', field: 'perf', rows: [{ key: 'a' }] })} data={{}} />);
    expect(screen.getByText(/run Produce/)).toBeTruthy();
  });
});
