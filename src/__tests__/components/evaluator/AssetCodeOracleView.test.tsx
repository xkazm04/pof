/**
 * scan-sweep --challenge (code-quality-evaluation/B): the Asset-Code Oracle view says
 * what changed since the last scan (stable violation keys recorded per scan), tags new
 * rows, filters to them, and turns a remediable violation type into one CLI run on the
 * CLITask rail whose completion re-runs the analysis to prove the fix.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { analyzeConsistency } from '@/lib/asset-code-oracle';
import type { ScannedAsset, AssetDependencyEdge, AssetType } from '@/app/api/filesystem/scan-assets/route';
import { useProjectStore } from '@/stores/projectStore';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import type { CLITask } from '@/lib/cli-task';

afterEach(cleanup);

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  sendPrompt: vi.fn(),
  onComplete: null as null | ((success: boolean) => void),
  sessionKeys: [] as string[],
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: (success: boolean) => void }) => {
    h.onComplete = opts.onComplete ?? null;
    h.sessionKeys.push(opts.sessionKey);
    return { execute: h.execute, sendPrompt: h.sendPrompt, isRunning: false };
  },
}));

import { AssetCodeOracleView } from '@/components/modules/evaluator/AssetCodeOracleView';

const PROJECT = 'C:/UE/Did';

function asset(relativePath: string, type: AssetType): ScannedAsset {
  const name = relativePath.split('/').pop()!.replace(/\.uasset$/, '');
  return { name, relativePath, fullPath: `${PROJECT}/Content/${relativePath}`, extension: '.uasset', type, sizeBytes: 1, modifiedAt: '' };
}

const BEFORE_FIX = {
  assets: [asset('Env/X_Foo.uasset', 'mesh'), asset('Env/Q_Bar.uasset', 'texture'), asset('Chars/BP_Old.uasset', 'blueprint')],
  dependencies: [{ from: 'Env/X_Foo.uasset', to: 'Env/Q_Bar.uasset', relation: 'uses-texture' }] as AssetDependencyEdge[],
};
const AFTER_FIX = {
  assets: [asset('Env/SM_Foo.uasset', 'mesh'), asset('Env/T_Bar.uasset', 'texture'), asset('Chars/BP_Old.uasset', 'blueprint')],
  dependencies: [{ from: 'Env/SM_Foo.uasset', to: 'Env/T_Bar.uasset', relation: 'uses-texture' }] as AssetDependencyEdge[],
};

let content = BEFORE_FIX;
const calls: string[] = [];

function envelope(data: unknown) {
  return { json: async () => ({ success: true, data }) } as Response;
}

beforeEach(() => {
  content = BEFORE_FIX;
  calls.length = 0;
  h.execute.mockReset();
  h.execute.mockResolvedValue(undefined);
  h.sendPrompt.mockReset();
  h.onComplete = null;
  h.sessionKeys.length = 0;
  useProjectStore.setState({ projectPath: PROJECT, projectName: 'Did' });
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  useMarketplaceStore.setState({
    consistencyScans: {
      [PROJECT]: [{ score: 80, timestamp: yesterday, violationKeys: ['orphaned-asset:Chars/BP_Old.uasset', 'missing-asset:AGone'] }],
    },
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url === '/api/filesystem/scan-project') return envelope({ classes: [] });
    if (url === '/api/filesystem/scan-assets') return envelope(content);
    if (url === '/api/asset-code-oracle') {
      const body = JSON.parse(String(init?.body));
      return envelope(analyzeConsistency(body.classes, body.assets, body.dependencies));
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function row(id: string): HTMLElement | null {
  return document.querySelector(`[data-violation-id="${id}"]`);
}

async function runOnce() {
  fireEvent.click(screen.getByRole('button', { name: /run analysis/i }));
  await screen.findByText(/Naming Mismatch: X_Foo/);
}

describe('AssetCodeOracleView - since-last-scan diff and remedies', () => {
  it('case 6: banner counts new/resolved since the last scan, NEW tags, New-only filter, keys recorded', async () => {
    render(<AssetCodeOracleView />);
    await runOnce();

    expect(screen.getByText('2 new · 1 resolved since yesterday')).toBeTruthy();
    expect(row('naming-mismatch:Env/X_Foo.uasset')!.textContent).toContain('NEW');
    expect(row('naming-mismatch:Env/Q_Bar.uasset')!.textContent).toContain('NEW');
    expect(row('orphaned-asset:Chars/BP_Old.uasset')!.textContent).not.toContain('NEW');

    fireEvent.click(screen.getByRole('button', { name: /new only/i }));
    expect(row('orphaned-asset:Chars/BP_Old.uasset')).toBeNull();
    expect(row('naming-mismatch:Env/X_Foo.uasset')).not.toBeNull();

    const history = useMarketplaceStore.getState().consistencyScans[PROJECT];
    expect(history).toHaveLength(2);
    expect([...(history[1].violationKeys ?? [])].sort()).toEqual([
      'naming-mismatch:Env/Q_Bar.uasset',
      'naming-mismatch:Env/X_Foo.uasset',
      'orphaned-asset:Chars/BP_Old.uasset',
    ]);
  });

  it('case 7: "Fix 2 naming mismatches" executes one rail task; onComplete(true) rescans and both keys resolve', async () => {
    render(<AssetCodeOracleView />);
    await runOnce();
    expect(h.execute).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Fix 2 naming mismatches' }));
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.sendPrompt).not.toHaveBeenCalled();
    const task = h.execute.mock.calls[0][0] as CLITask;
    expect(task.type).toBe('ask-claude');
    expect(task.prompt).toContain('X_Foo -> SM_Foo');
    expect(task.prompt).toContain('Q_Bar -> T_Bar');
    expect(h.sessionKeys).toContain('asset-oracle-remedy');

    content = AFTER_FIX;
    calls.length = 0;
    await act(async () => { h.onComplete?.(true); });
    await waitFor(() => expect(screen.getByText('0 new · 2 resolved since earlier today')).toBeTruthy());
    expect(calls).toEqual(['/api/filesystem/scan-project', '/api/filesystem/scan-assets', '/api/asset-code-oracle']);
    expect(screen.getByText('naming-mismatch:Env/X_Foo.uasset')).toBeTruthy();
    expect(screen.getByText('naming-mismatch:Env/Q_Bar.uasset')).toBeTruthy();
    expect(row('naming-mismatch:Env/X_Foo.uasset')).toBeNull();
  });

  it('[guard] case 8: Run Analysis keeps the three-call order scan-project -> scan-assets -> oracle', async () => {
    render(<AssetCodeOracleView />);
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }));
    await screen.findByText(/Naming Mismatch: X_Foo/);
    expect(calls).toEqual(['/api/filesystem/scan-project', '/api/filesystem/scan-assets', '/api/asset-code-oracle']);
  });
});
