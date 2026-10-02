/**
 * The Test Harness is mounted on /harness as a "UE tests" tab (acceptance case 7 of
 * ue5-bridge-monitoring/B).
 *
 * Opening the tab lands on "Waiting tests" and loads the deferred L3 queue; nothing
 * touches the UE bridge (/api/pof-bridge/*) until the operator clicks a row's Run —
 * then the lease is checked, the one test runs, and its gates are settled.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import HarnessPage from '@/app/harness/page';

const originalFetch = global.fetch;

interface Call { url: string; method: string }
let calls: Call[] = [];

const JOBS = [
  { catalogId: 'spellbook', entityId: 'fireball', step: 'Effect', tier: 'L3', testName: 'PoF.GenFireball.EffectConfig' },
  { catalogId: 'items', entityId: 'staff', step: 'Effect', tier: 'L3', testName: 'PoF.GenFireball.EffectConfig' },
  { catalogId: 'codex', entityId: 'page', step: 'Unlock', tier: 'L3', testName: 'VSCodexUnlockTest' },
];

function reply(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

beforeEach(() => {
  calls = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url === '/api/pipeline-artifacts/drain?tier=L3') return reply(JOBS);
    if (url === '/api/pipeline-artifacts/drain/status') return reply({ held: false, scope: null, since: null, scopes: [] });
    if (url === '/api/pof-bridge/test') return reply({ status: 'passed', testId: 'FVSCodexUnlockTest' });
    if (url === '/api/pipeline-artifacts/drain/settle-test') {
      return reply({ matched: 1, settled: 1, passed: 1, failed: 0, deferred: 0, gates: [], note: '1 gate settled.' });
    }
    return new Response(JSON.stringify({ success: false, error: 'not stubbed' }), { status: 500 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

describe('/harness "UE tests" tab', () => {
  it('opens on Waiting tests, loads the L3 queue, and touches the bridge only on Run', async () => {
    render(<HarnessPage />);
    fireEvent.click(screen.getByRole('tab', { name: /UE tests/ }));

    const waiting = await screen.findByRole('tab', { name: /Waiting tests/ });
    expect(waiting.getAttribute('aria-selected')).toBe('true');

    await waitFor(() => {
      expect(calls.some((c) => c.url === '/api/pipeline-artifacts/drain?tier=L3' && c.method === 'GET')).toBe(true);
    });
    await screen.findByText('PoF.GenFireball.EffectConfig');
    expect(calls.filter((c) => c.url.includes('/api/pof-bridge/'))).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Run VSCodexUnlockTest/ }));
    await screen.findByText(/1 gate settled/);
    const RUN_PATH = [
      '/api/pipeline-artifacts/drain/status',
      '/api/pof-bridge/test',
      '/api/pipeline-artifacts/drain/settle-test',
    ];
    expect(calls.map((c) => c.url).filter((u) => RUN_PATH.includes(u))).toEqual(RUN_PATH);
    expect(calls.filter((c) => c.url.includes('/api/pof-bridge/'))).toHaveLength(1);
  });
});
