/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): a scan that found 0 classes and 0 assets
 * measured nothing. The oracle's score formula falls back to 100 for an empty input, so the
 * view used to show grade A, "Your project looks clean!", and record that 100 into the scan
 * history the next delta is computed from. Nothing measured must REFUSE a verdict
 * (quality-gates / unmeasurable-criteria), not certify one.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { analyzeConsistency } from '@/lib/asset-code-oracle';
import { useProjectStore } from '@/stores/projectStore';
import { useMarketplaceStore } from '@/stores/marketplaceStore';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false }),
}));

import { AssetCodeOracleView } from '@/components/modules/evaluator/AssetCodeOracleView';

const PROJECT = 'C:/UE/Empty';

function envelope(data: unknown) {
  return { json: async () => ({ success: true, data }) } as Response;
}

beforeEach(() => {
  useProjectStore.setState({ projectPath: PROJECT, projectName: 'Empty' });
  useMarketplaceStore.setState({ consistencyScans: {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/filesystem/scan-project') return envelope({ classes: [] });
    if (url === '/api/filesystem/scan-assets') return envelope({ assets: [], dependencies: [] });
    if (url === '/api/asset-code-oracle') {
      const body = JSON.parse(String(init?.body));
      return envelope(analyzeConsistency(body.classes, body.assets, body.dependencies));
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AssetCodeOracleView - an empty scan is not a clean project', () => {
  it('0 classes + 0 assets: says nothing was scanned, shows no grade, records no score', async () => {
    render(<AssetCodeOracleView />);
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }));
    await screen.findByTestId('oracle-nothing-scanned');

    expect(screen.queryByText(/looks clean/i)).toBeNull();
    expect(screen.queryByText('Consistency Score')).toBeNull();
    expect(useMarketplaceStore.getState().consistencyScans[PROJECT] ?? []).toHaveLength(0);
  });
});
