/**
 * The pre-scan hint is the only explanation for the disabled Scan button: it must be
 * full-strength STATUS_ERROR (no opacity hack) and described-by the button.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { STATUS_ERROR, SURFACE_DAG_NODE } from '@/lib/chart-colors';
import { contrastRatio } from '@/lib/contrast';

let projectPath: string | null = null;

vi.mock('@/components/modules/content/models/AssetInventory/useAssetInventory', () => ({
  useAssetInventory: () => ({
    projectPath,
    bridgeConnected: false,
    bridgeSummary: null,
    scanResult: null,
    displayAssets: [],
    isScanning: false,
    error: null,
    handleScan: () => {},
  }),
}));

import { AssetInventory } from '@/components/modules/content/models/AssetInventory';

afterEach(() => { cleanup(); projectPath = null; });

describe('AssetInventory path hint', () => {
  it('is full-opacity STATUS_ERROR and describes the disabled Scan button', () => {
    const { container } = render(<AssetInventory />);
    const hint = Array.from(container.querySelectorAll('p')).find((p) => (p.textContent ?? '').includes('Set your project path'))!;
    expect(hint.className).not.toMatch(/\/\d+/);
    expect(hint.className).not.toContain('opacity');
    expect(hint.getAttribute('style') ?? '').not.toContain('opacity');
    expect(contrastRatio(STATUS_ERROR, SURFACE_DAG_NODE)).toBeGreaterThanOrEqual(4.5);
    const btn = container.querySelector('button[disabled]')!;
    expect(btn.getAttribute('aria-describedby')).toBe(hint.id);
    expect(hint.id).not.toBe('');
  });

  it('[guard] with a project path there is no hint and the button is enabled', () => {
    projectPath = 'C:/proj';
    const { container } = render(<AssetInventory />);
    expect(container.textContent).not.toContain('Set your project path');
    expect(container.querySelector('button[disabled]')).toBeNull();
    expect(container.querySelector('button')!.getAttribute('aria-describedby')).toBeNull();
  });
});
