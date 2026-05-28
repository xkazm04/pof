import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockFetch, mockFetchRoutes } from '../setup';
import {
  probePofBridge,
  probeRemoteControl,
  probeWsLiveState,
  runDiagnostics,
  type ProbeConfig,
} from '@/lib/bridge-doctor/probes';
import { remediationFor, CHANNEL_META } from '@/lib/bridge-doctor/remediation';
import { useBridgeDoctorStore } from '@/stores/bridgeDoctorStore';

const baseCfg: ProbeConfig = {
  host: '127.0.0.1',
  pofPort: 30040,
  rcPort: 30010,
  wsPort: 30041,
  timeoutMs: 200,
};

describe('Bridge Doctor — probes', () => {
  describe('probePofBridge', () => {
    it('reports ok when /pof/status returns a well-formed payload', async () => {
      mockFetch({
        body: { pluginVersion: '1.0.0', engineVersion: '5.6', projectName: 'PoF' },
      });
      const result = await probePofBridge(baseCfg);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.channel).toBe('pof-bridge');
        expect(result.details?.pluginVersion).toBe('1.0.0');
      }
    });

    it('classifies 200 with unrelated JSON as wrong-port', async () => {
      mockFetch({ body: { somethingElse: true } });
      const result = await probePofBridge(baseCfg);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe('wrong-port');
    });

    it('classifies HTTP 401 as auth-rejected', async () => {
      mockFetch({ body: { error: 'unauthorized' }, status: 401 });
      const result = await probePofBridge(baseCfg);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe('auth-rejected');
        expect(result.httpStatus).toBe(401);
      }
    });

    it('classifies HTTP 404 as plugin-disabled', async () => {
      mockFetch({ body: { error: 'not found' }, status: 404 });
      const result = await probePofBridge(baseCfg);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe('plugin-disabled');
    });

    it('classifies network refusal as editor-not-running', async () => {
      globalThis.fetch = (() =>
        Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:30040'))) as unknown as typeof fetch;
      const result = await probePofBridge(baseCfg);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe('editor-not-running');
    });

    it('classifies AbortError as timeout', async () => {
      globalThis.fetch = (() => {
        const err = new DOMException('Aborted', 'AbortError');
        return Promise.reject(err);
      }) as unknown as typeof fetch;
      const result = await probePofBridge(baseCfg);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe('timeout');
    });

    it('sends the auth token in the request headers', async () => {
      const fetchMock = mockFetch({
        body: { pluginVersion: '1.0.0', engineVersion: '5.6' },
      });
      await probePofBridge({ ...baseCfg, authToken: 'secret-123' });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/pof/status'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Pof-Auth-Token': 'secret-123' }),
        }),
      );
    });
  });

  describe('probeRemoteControl', () => {
    it('reports ok on /remote/info success', async () => {
      mockFetch({ body: { httpServerPort: 30010 } });
      const result = await probeRemoteControl(baseCfg);
      expect(result.ok).toBe(true);
    });

    it('does NOT send the PoF auth header (different protocol)', async () => {
      const fetchMock = mockFetch({ body: { httpServerPort: 30010 } });
      await probeRemoteControl({ ...baseCfg, authToken: 'secret-123' });
      const call = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      const headers = (call?.headers ?? {}) as Record<string, string>;
      expect(headers['X-Pof-Auth-Token']).toBeUndefined();
    });
  });

  describe('probeWsLiveState — node fallback', () => {
    it('falls back to an HTTP probe when WebSocket is unavailable', async () => {
      // jsdom: no global WebSocket; the probe should attempt HTTP and classify
      // refusal as editor-not-running.
      const prev = (globalThis as { WebSocket?: unknown }).WebSocket;
      (globalThis as { WebSocket?: unknown }).WebSocket = undefined;
      try {
        globalThis.fetch = (() =>
          Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:30041'))) as unknown as typeof fetch;
        const result = await probeWsLiveState(baseCfg);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.channel).toBe('ws-live-state');
          expect(result.kind).toBe('editor-not-running');
        }
      } finally {
        (globalThis as { WebSocket?: unknown }).WebSocket = prev;
      }
    });
  });

  describe('runDiagnostics', () => {
    it('aggregates all three channels into a single report', async () => {
      mockFetchRoutes([
        { match: '/pof/status', response: { body: { pluginVersion: '1.0.0', engineVersion: '5.6' } } },
        { match: '/remote/info', response: { body: { httpServerPort: 30010 } } },
        { match: '/pof/live', response: { body: 'upgrade required', status: 426 } },
      ]);

      const prev = (globalThis as { WebSocket?: unknown }).WebSocket;
      (globalThis as { WebSocket?: unknown }).WebSocket = undefined;
      try {
        const report = await runDiagnostics(baseCfg);
        expect(report.channels['pof-bridge'].ok).toBe(true);
        expect(report.channels['remote-control'].ok).toBe(true);
        expect(report.channels['ws-live-state'].ok).toBe(false);
        expect(report.allGreen).toBe(false);
      } finally {
        (globalThis as { WebSocket?: unknown }).WebSocket = prev;
      }
    });
  });
});

describe('Bridge Doctor — remediation', () => {
  it('returns null when the probe succeeded', () => {
    const remediation = remediationFor({
      channel: 'pof-bridge',
      ok: true,
      latencyMs: 12,
    });
    expect(remediation).toBeNull();
  });

  it('maps editor-not-running to a "open the editor" fix', () => {
    const remediation = remediationFor({
      channel: 'pof-bridge',
      ok: false,
      latencyMs: 3000,
      kind: 'editor-not-running',
      rawError: 'connect ECONNREFUSED',
    });
    expect(remediation).not.toBeNull();
    expect(remediation!.title).toMatch(/not reachable/i);
    expect(remediation!.steps[0]?.context).toBe('unreal-editor');
  });

  it('maps auth-rejected to a token-related fix mentioning the auth token', () => {
    const remediation = remediationFor({
      channel: 'pof-bridge',
      ok: false,
      latencyMs: 50,
      kind: 'auth-rejected',
      rawError: 'HTTP 401',
      httpStatus: 401,
    });
    expect(remediation!.explanation.toLowerCase()).toContain('auth');
    expect(remediation!.steps.some((s) => /token/i.test(s.label))).toBe(true);
  });

  it('maps timeout to a fix that includes a netstat copy-paste command', () => {
    const remediation = remediationFor({
      channel: 'remote-control',
      ok: false,
      latencyMs: 3000,
      kind: 'timeout',
      rawError: 'timeout',
    });
    const copyTexts = remediation!.steps.flatMap((s) => (s.copyText ? [s.copyText] : []));
    expect(copyTexts.some((c) => c.includes('netstat'))).toBe(true);
    expect(copyTexts.some((c) => c.includes('30010'))).toBe(true);
  });

  it('emits Remote-Control-specific guidance for the RC plugin-disabled case', () => {
    const remediation = remediationFor({
      channel: 'remote-control',
      ok: false,
      latencyMs: 30,
      kind: 'plugin-disabled',
      rawError: 'HTTP 404',
      httpStatus: 404,
    });
    expect(
      remediation!.steps.some((s) => /Remote Control API/i.test(s.label)),
    ).toBe(true);
  });

  it('covers every (channel, failure-kind) combination without throwing', () => {
    const channels = Object.keys(CHANNEL_META) as Array<keyof typeof CHANNEL_META>;
    const kinds: Array<NonNullable<ReturnType<typeof remediationFor>>['kind']> = [
      'editor-not-running',
      'timeout',
      'auth-rejected',
      'plugin-disabled',
      'wrong-port',
      'http-error',
      'unknown',
    ];
    for (const channel of channels) {
      for (const kind of kinds) {
        const remediation = remediationFor({
          channel,
          ok: false,
          latencyMs: 1,
          kind,
          rawError: 'x',
        });
        expect(remediation).not.toBeNull();
        expect(remediation!.steps.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Bridge Doctor — store: last-known-good', () => {
  beforeEach(() => {
    useBridgeDoctorStore.setState({ latest: null, running: false, lastKnownGood: null });
  });

  it('captures the config on the first all-green report', () => {
    const cfg: ProbeConfig = {
      host: 'localhost',
      pofPort: 30040,
      rcPort: 30010,
      wsPort: 30041,
      authToken: 'tok',
    };
    useBridgeDoctorStore.getState().beginRun();
    useBridgeDoctorStore.getState().endRun({
      startedAt: 't0',
      finishedAt: 't1',
      config: cfg,
      channels: {
        'pof-bridge': { channel: 'pof-bridge', ok: true, latencyMs: 1 },
        'remote-control': { channel: 'remote-control', ok: true, latencyMs: 1 },
        'ws-live-state': { channel: 'ws-live-state', ok: true, latencyMs: 1 },
      },
      allGreen: true,
    });

    const stored = useBridgeDoctorStore.getState().lastKnownGood;
    expect(stored).not.toBeNull();
    expect(stored!.pofPort).toBe(30040);
    expect(stored!.authToken).toBe('tok');
    expect(stored!.capturedAt).toBe('t1');
  });

  it('does NOT overwrite the last-known-good with a red report', () => {
    useBridgeDoctorStore.setState({
      lastKnownGood: {
        host: '127.0.0.1',
        pofPort: 30040,
        rcPort: 30010,
        wsPort: 30041,
        authToken: 'good',
        capturedAt: 'earlier',
      },
    });
    useBridgeDoctorStore.getState().endRun({
      startedAt: 't0',
      finishedAt: 't2',
      config: { host: '127.0.0.1', pofPort: 30040, rcPort: 30010, wsPort: 30041 },
      channels: {
        'pof-bridge': {
          channel: 'pof-bridge',
          ok: false,
          latencyMs: 50,
          kind: 'editor-not-running',
          rawError: 'refused',
        },
        'remote-control': {
          channel: 'remote-control',
          ok: false,
          latencyMs: 50,
          kind: 'editor-not-running',
          rawError: 'refused',
        },
        'ws-live-state': {
          channel: 'ws-live-state',
          ok: false,
          latencyMs: 50,
          kind: 'editor-not-running',
          rawError: 'refused',
        },
      },
      allGreen: false,
    });

    const stored = useBridgeDoctorStore.getState().lastKnownGood;
    expect(stored).not.toBeNull();
    expect(stored!.authToken).toBe('good');
    expect(stored!.capturedAt).toBe('earlier');
  });

  it('refreshes the last-known-good on a subsequent all-green run', () => {
    useBridgeDoctorStore.setState({
      lastKnownGood: {
        host: '127.0.0.1',
        pofPort: 30040,
        rcPort: 30010,
        wsPort: 30041,
        authToken: 'old',
        capturedAt: 'older',
      },
    });
    useBridgeDoctorStore.getState().endRun({
      startedAt: 't1',
      finishedAt: 'newer',
      config: { host: '127.0.0.1', pofPort: 31000, rcPort: 30010, wsPort: 30041, authToken: 'new' },
      channels: {
        'pof-bridge': { channel: 'pof-bridge', ok: true, latencyMs: 1 },
        'remote-control': { channel: 'remote-control', ok: true, latencyMs: 1 },
        'ws-live-state': { channel: 'ws-live-state', ok: true, latencyMs: 1 },
      },
      allGreen: true,
    });

    const stored = useBridgeDoctorStore.getState().lastKnownGood!;
    expect(stored.pofPort).toBe(31000);
    expect(stored.authToken).toBe('new');
    expect(stored.capturedAt).toBe('newer');
  });

  it('clearLastKnownGood wipes the snapshot', () => {
    useBridgeDoctorStore.setState({
      lastKnownGood: {
        host: 'h',
        pofPort: 1,
        rcPort: 2,
        wsPort: 3,
        authToken: 'a',
        capturedAt: 'c',
      },
    });
    useBridgeDoctorStore.getState().clearLastKnownGood();
    expect(useBridgeDoctorStore.getState().lastKnownGood).toBeNull();
  });
});

// Reset between sibling describes that share the global fetch.
beforeEach(() => {
  vi.restoreAllMocks();
});
