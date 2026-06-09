import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProcgenPreviewCanvas } from '@/components/modules/content/level-design/ProcgenPreviewCanvas';
import { generatePreview, type PreviewConfig } from '@/lib/level-design/procgen-preview';

afterEach(cleanup);

function previewFor(overrides: Partial<PreviewConfig> = {}) {
  return generatePreview({
    algorithm: 'bsp',
    gridWidth: 64,
    gridHeight: 64,
    roomCountMin: 8,
    roomCountMax: 15,
    corridorWidth: 3,
    seed: '1337',
    ...overrides,
  });
}

describe('ProcgenPreviewCanvas', () => {
  it('renders a canvas sized to the preview grid', () => {
    const result = previewFor();
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} />);
    const canvas = getByTestId('procgen-preview-canvas');
    expect(canvas.getAttribute('data-width')).toBe(String(result.width));
    expect(canvas.getAttribute('data-height')).toBe(String(result.height));
  });

  it('surfaces room count, connectivity and size stats', () => {
    const result = previewFor();
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} />);
    const stats = getByTestId('procgen-preview-stats');
    expect(stats.textContent).toContain(String(result.stats.roomCount));
    expect(stats.textContent).toContain(`${Math.round(result.stats.connectivity * 100)}%`);
    expect(stats.textContent).toContain(`${result.width}×${result.height}`);
  });

  it('renders a legend of cell types', () => {
    const { getByTestId } = render(<ProcgenPreviewCanvas result={previewFor()} />);
    const legend = getByTestId('procgen-preview-legend');
    for (const label of ['Floor', 'Corridor', 'Door', 'Wall']) {
      expect(legend.textContent).toContain(label);
    }
  });

  it('reports a fully-connected verdict for a connected BSP layout', () => {
    const result = previewFor({ algorithm: 'bsp' });
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} />);
    const verdict = getByTestId('procgen-preview-verdict').textContent ?? '';
    if (result.stats.regions <= 1) {
      expect(verdict).toContain('Fully connected');
    } else {
      expect(verdict).toContain('disconnected');
    }
  });

  it('exposes an accessible image label describing the layout', () => {
    const result = previewFor();
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} />);
    const canvas = getByTestId('procgen-preview-canvas');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toContain('rooms');
  });

  it('shows the resolved default seed when the seed label is blank', () => {
    const result = previewFor({ seed: '' });
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} seedLabel="" />);
    expect(getByTestId('procgen-preview-legend').textContent).toContain(`${result.seedValue} (default)`);
  });

  it('flags a downscaled preview with a scale badge', () => {
    const result = previewFor({ gridWidth: 512, gridHeight: 512 });
    const { getByTestId } = render(<ProcgenPreviewCanvas result={result} />);
    expect(getByTestId('procgen-preview').textContent).toContain('% scale');
  });
});
