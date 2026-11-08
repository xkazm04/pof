/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): runAnalysis cleared the result before scanning,
 * so the rescan a remedy triggers blanked the violation list, the diff banner and the RemedyBar
 * outcome line for the whole scan.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { analyzeConsistency } from '@/lib/asset-code-oracle';
import type { ScannedAsset, AssetType } from '@/app/api/filesystem/scan-assets/route';
import { useProjectStore } from '@/stores/projectStore';
import { useMarketplaceStore } from '@/stores/marketplaceStore';

const h = vi.hoisted(() => ({
  onComplete: null as null | ((success: boolean) => void),
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { onComplete?: (success: boolean) => void }) => {
    h.onComplete = opts.onComplete ?? null;
    return { execute: vi.fn().mockResolvedValue(undefined), sendPrompt: vi.fn(), isRunning: false };
  },
}));

import { AssetCodeOracleView } from '@/components/modules/evaluator/AssetCodeOracleView';

const PROJECT = 'C:/UE/Did';

function asset(relativePath: string, type: AssetType): ScannedAsset {
  const name = relativePath.split('/').pop()!.replace(/\.uasset$/, '');
  return { name, relativePath, fullPath: `${PROJECT}/Content/${relativePath}`, extension: '.uasset', type, sizeBytes: 1, modifiedAt: '' };
}

const CONTENT = {
  assets: [asset('Env/X_Foo.uasset', 'mesh'), asset('Env/Q_Bar.uasset', 'texture')],
  dependencies: [],
};

let gate: Promise<void> = Promise.resolve();

function envelope(data: unknown) {
  return { json: async () => ({ success: true, data }) } as Response;
}

beforeEach(() => {
  gate = Promise.resolve();
  useProjectStore.setState({ projectPath: PROJECT, projectName: 'Did' });
  useMarketplaceStore.setState({ consistencyScans: {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/filesystem/scan-project') return envelope({ classes: [] });
    if (url === '/api/filesystem/scan-assets') { await gate; return envelope(CONTENT); }
    const body = JSON.parse(String(init?.body));
    return envelope(analyzeConsistency(body.classes, body.assets, body.dependencies));
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AssetCodeOracleView - a rescan keeps the previous result on screen', () => {
  it('keeps violation rows and marks the view as rescanning while the scan is pending', async () => {
    render(<AssetCodeOracleView />);
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }));
    await screen.findByText(/Naming Mismatch: X_Foo/);

    fireEvent.click(screen.getByRole('button', { name: /fix 2 naming mismatches/i }));
    let release!: () => void;
    gate = new Promise<void>((r) => { release = r; });
    await act(async () => { h.onComplete?.(true); });
    // pending rescan: the three filesystem calls have not returned
    expect(document.querySelectorAll('[data-violation-id]').length).toBeGreaterThan(0);
    expect(screen.getByText(/rescanning/i)).toBeTruthy();

    await act(async () => { release(); });
    await waitFor(() => expect(screen.queryByText(/rescanning/i)).toBeNull());
    expect(document.querySelectorAll('[data-violation-id]').length).toBeGreaterThan(0);
  });
});
