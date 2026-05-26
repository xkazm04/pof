import { describe, it, expect } from 'vitest';
import { interpretAutomationResult, makeBridgeExecutor } from '@/lib/test-gate-runner/bridgeExecutor';

function resp(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) } as Response);
}

describe('interpretAutomationResult', () => {
  it('maps PofTestResult-style status', () => {
    expect(interpretAutomationResult({ status: 'passed' })).toMatchObject({ terminal: true, status: 'pass' });
    expect(interpretAutomationResult({ status: 'failed', errors: ['boom'] })).toMatchObject({ terminal: true, status: 'fail', detail: 'boom' });
    expect(interpretAutomationResult({ status: 'running', testId: 't1' })).toMatchObject({ terminal: false, testId: 't1' });
  });
  it('maps summary counts', () => {
    expect(interpretAutomationResult({ passed: 3, failed: 0 })).toMatchObject({ terminal: true, status: 'pass' });
    expect(interpretAutomationResult({ summary: { passed: 2, failed: 1 } })).toMatchObject({ terminal: true, status: 'fail' });
  });
  it('maps a plain boolean', () => {
    expect(interpretAutomationResult({ success: true })).toMatchObject({ terminal: true, status: 'pass' });
    expect(interpretAutomationResult({ success: false })).toMatchObject({ terminal: true, status: 'fail' });
  });
  it('is non-terminal for unrecognised/empty', () => {
    expect(interpretAutomationResult(null)).toMatchObject({ terminal: false });
    expect(interpretAutomationResult({ foo: 1 })).toMatchObject({ terminal: false });
  });
});

describe('makeBridgeExecutor', () => {
  const job = { catalogId: 'items', entityId: 'item-1', step: 'Test Gate', tier: 'L3' as const, testName: 'VSItemsTest' };

  it('is tier L3', () => {
    expect(makeBridgeExecutor().tier).toBe('L3');
  });

  it('available() is true when /status responds ok', async () => {
    const ex = makeBridgeExecutor({ fetchImpl: ((url: string) => resp({}, /\/status$/.test(url))) as unknown as typeof fetch });
    expect(await ex.available()).toBe(true);
  });

  it('available() is false when the plugin is unreachable', async () => {
    const ex = makeBridgeExecutor({ fetchImpl: (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch });
    expect(await ex.available()).toBe(false);
  });

  it('run() returns a pass verdict on an immediate terminal result', async () => {
    const ex = makeBridgeExecutor({ fetchImpl: (() => resp({ status: 'passed' })) as unknown as typeof fetch });
    const v = await ex.run(job);
    expect(v.status).toBe('pass');
    expect(v.detail).toContain('VSItemsTest');
  });

  it('run() polls results while the plugin reports running, then resolves', async () => {
    let calls = 0;
    const fetchImpl = ((url: string) => {
      if (/run-automation$/.test(url)) return resp({ status: 'running', testId: 't9' });
      calls++;
      return resp({ status: calls >= 2 ? 'failed' : 'running', testId: 't9', errors: ['assert X'] });
    }) as unknown as typeof fetch;
    const ex = makeBridgeExecutor({ fetchImpl, pollMs: 1, maxPolls: 5 });
    const v = await ex.run(job);
    expect(v.status).toBe('fail');
  });

  it('run() throws on a non-ok HTTP response', async () => {
    const ex = makeBridgeExecutor({ fetchImpl: (() => resp({ error: 'no plugin' }, false, 500)) as unknown as typeof fetch });
    await expect(ex.run(job)).rejects.toThrow(/run-automation 500/);
  });
});
