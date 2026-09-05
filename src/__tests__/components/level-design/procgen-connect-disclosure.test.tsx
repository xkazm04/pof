/**
 * The preview may not show a repaired connectivity as a natural one.
 *
 * Registry standard: `game-production/procedural-level-planning` — "the plan is
 * a graph, and a graph can be linted": a lint that changes the plan reports what
 * it changed, so 100% connected never reads the same whether it was generated or
 * repaired.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProcgenPreviewCanvas } from '@/components/modules/content/level-design/ProcgenPreviewCanvas';
import { generatePreview, type PreviewConfig } from '@/lib/level-design/procgen-preview';

afterEach(cleanup);

/** The fragmented cellular fixture — 3 regions at 32x32 with seed 149. */
function previewFor(overrides: Partial<PreviewConfig> = {}) {
  return generatePreview({
    algorithm: 'cellular',
    gridWidth: 32,
    gridHeight: 32,
    roomCountMin: 8,
    roomCountMax: 15,
    corridorWidth: 3,
    seed: '149',
    ...overrides,
  });
}

describe('connectivity-pass disclosure', () => {
  it('says nothing when the pass was never requested', () => {
    const { queryByTestId, getByTestId } = render(<ProcgenPreviewCanvas result={previewFor()} />);
    expect(queryByTestId('procgen-connect-pass')).toBeNull();
    // …and the untouched grid still reports itself broken.
    expect(getByTestId('procgen-preview-verdict').textContent).toContain('disconnected regions');
  });

  it('states what the pass did beside the repaired 100%', () => {
    const result = previewFor({ ensureConnected: true });
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} />);
    expect(getByTestId('procgen-preview-verdict').textContent).toContain('Fully connected');
    const line = getByTestId('procgen-connect-pass');
    expect(line.getAttribute('data-applied')).toBe('true');
    expect(line.textContent).toContain('3 regions → 1');
    expect(line.textContent).toContain('culled 1 pocket');
    expect(line.textContent).toContain('carved 1 tunnel');
  });

  it('states the SKIP reason when the algorithm does not implement the pass', () => {
    const result = previewFor({ algorithm: 'bsp', ensureConnected: true });
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} />);
    const line = getByTestId('procgen-connect-pass');
    expect(line.getAttribute('data-applied')).toBe('false');
    expect(line.textContent).toContain('cellular caves only');
  });
});
