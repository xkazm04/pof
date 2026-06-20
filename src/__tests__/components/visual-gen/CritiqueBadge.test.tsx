import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CritiqueBadge } from '@/components/modules/visual-gen/asset-forge/CritiqueBadge';
import type { MeshMetrics } from '@/lib/visual-gen/mesh-critique';

afterEach(cleanup);

const METRICS: MeshMetrics = {
  verts: 42000, faces: 84000, watertight: true, windingConsistent: true,
  components: 1, euler: 2, bbox: [1, 1, 1], volume: 0.5, area: 3, degenerateFaces: 0,
};

describe('CritiqueBadge', () => {
  it('renders a pass verdict with score + headline metrics', () => {
    render(<CritiqueBadge critique={{ verdict: 'pass', score: 100, reasons: [], metrics: METRICS }} />);
    const pill = screen.getByText(/quality: pass/);
    expect(pill.getAttribute('data-verdict')).toBe('pass');
    expect(pill.textContent).toContain('100');
    expect(screen.getByText(/84,000 tris/)).toBeTruthy();
    expect(screen.getByText(/watertight/)).toBeTruthy();
  });

  it('shows a CLIP fidelity chip when provided', () => {
    render(<CritiqueBadge critique={{ verdict: 'pass', score: 100, reasons: [], metrics: METRICS }} fidelity={0.97} />);
    expect(screen.getByText(/fidelity: 0.97/)).toBeTruthy();
  });

  it('lists reasons for a warn/fail verdict', () => {
    render(<CritiqueBadge critique={{ verdict: 'warn', score: 70, reasons: ['not watertight (open boundary / holes)'] }} />);
    expect(screen.getByText(/quality: warn/).getAttribute('data-verdict')).toBe('warn');
    expect(screen.getByText(/not watertight/)).toBeTruthy();
  });

  it('marks a fail verdict', () => {
    render(<CritiqueBadge critique={{ verdict: 'fail', score: 20, reasons: ['12 disconnected components'] }} />);
    expect(screen.getByText(/quality: fail/).getAttribute('data-verdict')).toBe('fail');
  });
});
