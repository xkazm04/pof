import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CritiqueBadge } from '@/components/modules/visual-gen/asset-forge/CritiqueBadge';
import type { ForgeMeshMetrics } from '@/components/modules/visual-gen/asset-forge/forgeJobStatus';

afterEach(cleanup);

const METRICS: ForgeMeshMetrics = {
  verts: 42000, faces: 84000, watertight: true, windingConsistent: true,
  components: 1, euler: 2, bbox: [1, 1, 1], volume: 0.5, area: 3, degenerateFaces: 0,
};

describe('CritiqueBadge', () => {
  it('renders a pass verdict with score + headline metrics', () => {
    render(<CritiqueBadge critique={{ ok: true, verdict: 'pass', score: 100, reasons: [], metrics: METRICS }} />);
    expect(screen.getByTestId('critique-verdict').getAttribute('data-verdict')).toBe('pass');
    expect(screen.getByText(/quality: pass/).textContent).toContain('100');
    expect(screen.getByText(/84,000 tris/)).toBeTruthy();
    expect(screen.getByText(/watertight/)).toBeTruthy();
  });

  it('shows a CLIP fidelity chip when provided', () => {
    render(<CritiqueBadge critique={{ ok: true, verdict: 'pass', score: 100, reasons: [], metrics: METRICS }} fidelity={0.97} />);
    expect(screen.getByText(/fidelity: 0.97/)).toBeTruthy();
  });

  it('lists reasons for a warn/fail verdict', () => {
    render(<CritiqueBadge critique={{ ok: true, verdict: 'warn', score: 70, reasons: ['not watertight (open boundary / holes)'] }} />);
    expect(screen.getByTestId('critique-verdict').getAttribute('data-verdict')).toBe('warn');
    expect(screen.getByText(/not watertight/)).toBeTruthy();
  });

  it('marks a fail verdict', () => {
    render(<CritiqueBadge critique={{ ok: true, verdict: 'fail', score: 20, reasons: ['12 disconnected components'] }} />);
    expect(screen.getByTestId('critique-verdict').getAttribute('data-verdict')).toBe('fail');
  });

  /**
   * FORCED FAILURE (red before this direction): the errored critique used to
   * arrive as `{}` and `VERDICT[undefined].cls` threw into the module error
   * boundary. It must now state that the gate did not run — and say why.
   */
  it('renders an errored critique as "did not run" with the reason, without throwing', () => {
    expect(() =>
      render(<CritiqueBadge critique={{ ok: false, error: 'POF_TRIPOSR_ROOT not set (the TripoSR venv has trimesh)' }} />),
    ).not.toThrow();

    const note = screen.getByTestId('critique-not-run');
    expect(note.textContent).toContain('critique did not run');
    expect(note.textContent).toContain('POF_TRIPOSR_ROOT not set');
    // …and it must not read as a scorecard.
    expect(screen.queryByTestId('critique-verdict')).toBeNull();
    expect(screen.queryByText(/quality:/)).toBeNull();
  });
});
