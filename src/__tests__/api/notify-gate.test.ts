import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_GATE_NOTIFY_CONFIG } from '@/lib/notify/gate-notify-store';

vi.mock('@/lib/notify/gate-notify-store', async (orig) => {
  const actual = await orig<typeof import('@/lib/notify/gate-notify-store')>();
  return {
    ...actual,
    getGateNotifyConfig: vi.fn(),
    setGateNotifyConfig: vi.fn(),
    getGateNotifyState: vi.fn(),
  };
});
vi.mock('@/lib/notify/gate-notifier', () => ({
  dispatchGateNotification: vi.fn(async () => ({ status: 'sent', detail: 'notified slack' })),
  recordGateNotifyOutcome: vi.fn(),
}));

import { GET, POST } from '@/app/api/notify/gate/route';
import { getGateNotifyConfig, setGateNotifyConfig, getGateNotifyState } from '@/lib/notify/gate-notify-store';
import { dispatchGateNotification } from '@/lib/notify/gate-notifier';

const enabled = { ...DEFAULT_GATE_NOTIFY_CONFIG, enabled: true, webhookUrl: 'https://hook.example/x' };
const state = { lastSentAt: null, lastStatus: null, lastDetail: null, sentCount: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  (getGateNotifyConfig as ReturnType<typeof vi.fn>).mockReturnValue(enabled);
  (getGateNotifyState as ReturnType<typeof vi.fn>).mockReturnValue(state);
  (setGateNotifyConfig as ReturnType<typeof vi.fn>).mockImplementation((p: object) => ({ ...enabled, ...p }));
});

function req(body: unknown): Request {
  return new Request('http://localhost:3000/api/notify/gate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
async function json(res: Response) {
  return res.json() as Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
}

describe('GET /api/notify/gate', () => {
  it('returns the config + state', async () => {
    const body = await json(await GET());
    expect(body.success).toBe(true);
    expect(body.data?.config).toEqual(enabled);
    expect(body.data?.state).toEqual(state);
  });
});

describe('POST /api/notify/gate', () => {
  it('saves a sanitized config patch', async () => {
    const body = await json(await POST(req({ action: 'save', enabled: true, target: 'discord', mode: 'regressions', webhookUrl: '  https://x.example/h  ' })));
    expect(body.success).toBe(true);
    expect(setGateNotifyConfig).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true, target: 'discord', mode: 'regressions', webhookUrl: 'https://x.example/h',
    }));
  });

  it('rejects an invalid target', async () => {
    const body = await json(await POST(req({ action: 'save', target: 'telegram' })));
    expect(body.success).toBe(false);
    expect(setGateNotifyConfig).not.toHaveBeenCalled();
  });

  it('rejects an invalid mode', async () => {
    const body = await json(await POST(req({ action: 'save', mode: 'sometimes' })));
    expect(body.success).toBe(false);
  });

  it('rejects a non-boolean enabled', async () => {
    const body = await json(await POST(req({ action: 'save', enabled: 'yes' })));
    expect(body.success).toBe(false);
  });

  it('test action dispatches a sample notification', async () => {
    const body = await json(await POST(req({ action: 'test' })));
    expect(body.success).toBe(true);
    expect(dispatchGateNotification).toHaveBeenCalledTimes(1);
    const [payload, cfg] = (dispatchGateNotification as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload).toMatchObject({ to: 'fail', regression: true });
    expect(cfg.enabled).toBe(true); // force-enabled for the test send
    expect((body.data?.outcome as { status: string }).status).toBe('sent');
  });

  it('test action errors when no webhook URL is configured', async () => {
    (getGateNotifyConfig as ReturnType<typeof vi.fn>).mockReturnValue({ ...enabled, webhookUrl: '' });
    const body = await json(await POST(req({ action: 'test' })));
    expect(body.success).toBe(false);
    expect(dispatchGateNotification).not.toHaveBeenCalled();
  });

  it('rejects an unknown action', async () => {
    const body = await json(await POST(req({ action: 'nope' })));
    expect(body.success).toBe(false);
  });
});
