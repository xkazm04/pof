import { describe, it, expect } from 'vitest';
import { diffConfig, implicatedChannels, editorSideChannels } from '@/components/bridge-doctor/BridgeDoctor/restorePlan';
import type { DiagnosticsReport, ProbeResult, ChannelId } from '@/lib/bridge-doctor/probes';

const live = { host: '127.0.0.1', pofPort: 8080, rcPort: 30010, wsPort: 30020, authToken: 'abc' };
const good = { ...live, rcPort: 30011, authToken: 'xyz' };

const ok = (channel: ChannelId): ProbeResult => ({ ok: true, channel, latencyMs: 1 }) as ProbeResult;
const bad = (channel: ChannelId): ProbeResult =>
  ({ ok: false, channel, kind: 'unreachable', latencyMs: 1, rawError: 'x' }) as unknown as ProbeResult;
const report = (failed: ChannelId[]): DiagnosticsReport => {
  const ids: ChannelId[] = ['pof-bridge', 'remote-control', 'ws-live-state'];
  return {
    startedAt: '', finishedAt: '', config: live, allGreen: failed.length === 0,
    channels: Object.fromEntries(ids.map((i) => [i, failed.includes(i) ? bad(i) : ok(i)])) as Record<ChannelId, ProbeResult>,
  };
};

describe('diffConfig', () => {
  it('reports changed fields and masks the token', () => {
    const d = diffConfig(live, good);
    expect(d).toEqual([{ field: 'rcPort', from: 30010, to: 30011 }, { field: 'authToken', changed: true }]);
    expect(JSON.stringify(d)).not.toMatch(/abc|xyz/);
  });
  it('is empty for identical configs', () => {
    expect(diffConfig(live, { ...live })).toEqual([]);
    expect(diffConfig({ ...live, authToken: undefined }, { ...live, authToken: '' })).toEqual([]);
  });
});

describe('implicatedChannels', () => {
  const d = diffConfig(live, { ...live, rcPort: 30011 });
  it('implicates the failed channel whose port differs', () => {
    expect(implicatedChannels(report(['remote-control']), d)).toEqual(['remote-control']);
  });
  it('treats a failed channel whose port matches as editor-side', () => {
    const r = report(['remote-control', 'ws-live-state']);
    expect(implicatedChannels(r, d)).toEqual(['remote-control']);
    expect(editorSideChannels(r, d)).toEqual(['ws-live-state']);
  });
  it('does not implicate passing channels or a null report', () => {
    expect(implicatedChannels(report([]), d)).toEqual([]);
    expect(implicatedChannels(null, d)).toEqual([]);
  });
});
