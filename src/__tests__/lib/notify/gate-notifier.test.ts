import { describe, it, expect, vi } from 'vitest';

// The dispatcher module imports the server-only store (→ better-sqlite3) at the
// top level; mock it so the unit test never touches a real DB.
vi.mock('@/lib/notify/gate-notify-store', () => ({
  getGateNotifyConfig: vi.fn(),
  getGateNotifyState: vi.fn(() => ({ lastSentAt: null, lastStatus: null, lastDetail: null, sentCount: 0 })),
  setGateNotifyState: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { dispatchGateNotification } from '@/lib/notify/gate-notifier';
import type { GateNotifyConfig } from '@/lib/notify/gate-notify-store';
import type { GateVerdictChangedPayload } from '@/lib/notify/webhook-payload';

const REGRESSION: GateVerdictChangedPayload = {
  catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3',
  from: 'pass', to: 'fail', regression: true, detail: 'failed',
};
const RECOVERY: GateVerdictChangedPayload = { ...REGRESSION, from: 'deferred', to: 'pass', regression: false };

const cfg = (over: Partial<GateNotifyConfig> = {}): GateNotifyConfig => ({
  enabled: true, webhookUrl: 'https://hook.example/x', target: 'slack', mode: 'failures', ...over,
});

function okFetch() {
  return vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
}

describe('dispatchGateNotification', () => {
  it('skips when disabled (no fetch)', async () => {
    const f = okFetch();
    const out = await dispatchGateNotification(REGRESSION, cfg({ enabled: false }), f);
    expect(out.status).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });

  it('skips when no webhook URL', async () => {
    const f = okFetch();
    const out = await dispatchGateNotification(REGRESSION, cfg({ webhookUrl: '' }), f);
    expect(out.status).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });

  it('skips a recovery when mode is failures', async () => {
    const f = okFetch();
    const out = await dispatchGateNotification(RECOVERY, cfg({ mode: 'failures' }), f);
    expect(out.status).toBe('skipped');
    expect(out.detail).toContain('failures');
    expect(f).not.toHaveBeenCalled();
  });

  it('POSTs the Slack body and reports sent on 2xx', async () => {
    const f = okFetch();
    const out = await dispatchGateNotification(REGRESSION, cfg(), f);
    expect(out.status).toBe('sent');
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://hook.example/x');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init!.body as string);
    expect(body.text).toContain('pass → fail');
  });

  it('reports error on a non-2xx response', async () => {
    const f = vi.fn(async () => new Response('no', { status: 500 }));
    const out = await dispatchGateNotification(REGRESSION, cfg(), f);
    expect(out.status).toBe('error');
    expect(out.detail).toContain('500');
  });

  it('reports error when fetch throws', async () => {
    const f = vi.fn(async () => { throw new Error('network down'); });
    const out = await dispatchGateNotification(REGRESSION, cfg(), f);
    expect(out.status).toBe('error');
    expect(out.detail).toContain('network down');
  });

  it('sends a recovery when mode is all', async () => {
    const f = okFetch();
    const out = await dispatchGateNotification(RECOVERY, cfg({ mode: 'all' }), f);
    expect(out.status).toBe('sent');
  });
});
