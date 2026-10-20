import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBridgeDoctorStore } from '@/stores/bridgeDoctorStore';
import type { DiagnosticsReport, ProbeConfig } from '@/lib/bridge-doctor/probes';

const live = { host: '127.0.0.1', pofPort: 8080, rcPort: 30010, wsPort: 30020, authToken: 'abc' };
const good = { ...live, rcPort: 30011, authToken: 'xyz', capturedAt: '2026-01-01T00:00:00.000Z' };

const rep = (allGreen: boolean, cfg: ProbeConfig): DiagnosticsReport => ({
  startedAt: '', finishedAt: '', config: cfg, allGreen,
  channels: {
    'pof-bridge': { ok: true, channel: 'pof-bridge', latencyMs: 1 },
    'remote-control': allGreen
      ? { ok: true, channel: 'remote-control', latencyMs: 1 }
      : { ok: false, channel: 'remote-control', kind: 'unreachable', latencyMs: 1, rawError: 'x' },
    'ws-live-state': { ok: true, channel: 'ws-live-state', latencyMs: 1 },
  },
} as unknown as DiagnosticsReport);

const setters = () => ({
  setHost: vi.fn(), setPofPort: vi.fn(), setRcPort: vi.fn(), setWsPort: vi.fn(), setPofAuthToken: vi.fn(),
});
const s = () => useBridgeDoctorStore.getState();

beforeEach(() => {
  useBridgeDoctorStore.setState({
    latest: null, running: false, lastKnownGood: good,
    restorePhase: 'idle', restorePreview: null, undoSnapshot: null,
  });
});

describe('bridge doctor restore state machine', () => {
  it('previews by probing the GOOD config and never calls a setter', async () => {
    const probe = vi.fn(async (c: ProbeConfig) => rep(true, c));
    const r = await s().previewRestore(good, probe);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe.mock.calls[0][0]).toMatchObject({ rcPort: 30011, authToken: 'xyz' });
    expect(r).toMatchObject({ verdict: 'would-fix' });
    expect(s().restorePhase).toBe('previewed');
  });

  it('reports still-failing with the failed channels, leaving latest/lastKnownGood/running alone', async () => {
    const before = rep(false, live);
    useBridgeDoctorStore.setState({ latest: before });
    const r = await s().previewRestore(good, async (c) => rep(false, c));
    expect(r).toMatchObject({ verdict: 'still-failing', channels: ['remote-control'] });
    expect(s().latest).toBe(before);
    expect(s().lastKnownGood).toBe(good);
    expect(s().running).toBe(false);
  });

  it('ignores previews while running or while one is in flight', async () => {
    const probe = vi.fn(async (c: ProbeConfig) => rep(true, c));
    useBridgeDoctorStore.setState({ running: true });
    expect(await s().previewRestore(good, probe)).toBeNull();
    useBridgeDoctorStore.setState({ running: false });
    const first = s().previewRestore(good, probe);
    expect(s().restorePhase).toBe('previewing');
    expect(await s().previewRestore(good, probe)).toBeNull();
    await first;
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('applies a would-fix preview once, snapshotting the live config', async () => {
    await s().previewRestore(good, async (c) => rep(true, c));
    const st = setters();
    expect(s().applyRestore(live, st)).toBe(true);
    for (const f of Object.values(st)) expect(f).toHaveBeenCalledTimes(1);
    expect(st.setRcPort).toHaveBeenCalledWith(30011);
    expect(st.setPofAuthToken).toHaveBeenCalledWith('xyz');
    expect(s().undoSnapshot).toEqual(live);
    expect(s().restorePhase).toBe('applied');
    expect(s().applyRestore(live, st)).toBe(false);
  });

  it('gates a still-failing preview behind force', async () => {
    await s().previewRestore(good, async (c) => rep(false, c));
    const st = setters();
    expect(s().applyRestore(live, st)).toBe(false);
    expect(st.setRcPort).not.toHaveBeenCalled();
    expect(s().applyRestore(live, st, true)).toBe(true);
    expect(st.setRcPort).toHaveBeenCalledWith(30011);
  });

  it('does nothing without a preview', () => {
    const st = setters();
    expect(s().applyRestore(live, st)).toBe(false);
    expect(st.setHost).not.toHaveBeenCalled();
  });

  it('undo restores the snapshot once', async () => {
    await s().previewRestore(good, async (c) => rep(true, c));
    s().applyRestore(live, setters());
    const st = setters();
    expect(s().undoRestore(st)).toBe(true);
    expect(st.setRcPort).toHaveBeenCalledWith(30010);
    expect(st.setPofAuthToken).toHaveBeenCalledWith('abc');
    expect(s().undoSnapshot).toBeNull();
    expect(s().undoRestore(st)).toBe(false);
    expect(st.setRcPort).toHaveBeenCalledTimes(1);
  });
});
