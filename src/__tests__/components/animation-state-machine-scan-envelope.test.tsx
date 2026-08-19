import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent, renderHook, waitFor } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// useReducedMotion reads matchMedia (absent in jsdom) — stub via the framer mock.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// The bridge is a THIRD provenance source; keep it switchable so the three
// provenance strings can be asserted mutually exclusive.
const bridge = vi.hoisted(() => ({
  manifest: null as unknown,
  isConnected: false,
}));
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: bridge.manifest, isConnected: bridge.isConnected }),
}));

import { AnimationStateMachine } from '@/components/modules/content/animations/AnimationStateMachine';
import { useAnimBpScan } from '@/components/modules/content/animations/AnimationStateMachine/useAnimBpScan';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';

// ── Fixtures ──

function scanPayload(stateNames: string[], transitions: { from: string; to: string; rule: string | null }[] = []) {
  return {
    scannedAt: '2026-08-19T00:00:00.000Z',
    animInstanceClass: 'UPoFAnimInstance',
    headerPath: 'PoF/Public/PoFAnimInstance.h',
    states: stateNames.map((name) => ({ name, hasMontage: false, montageRef: null })),
    transitions,
    montageRefs: [],
    animVariables: ['Speed'],
    scanDurationMs: 12,
  };
}

/** The REAL wire shape of POST /api/filesystem/scan-animbp (apiSuccess → envelope). */
function envelopeResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

function mockFetchSequence(...responses: Response[]) {
  let i = 0;
  const fn = vi.fn(async () => responses[Math.min(i++, responses.length - 1)]);
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderGraph() {
  return render(
    <AnimationStateMachine onSelectState={() => {}} isRunning={false} activeStateId={null} />,
  );
}

async function clickScan(container: HTMLElement) {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    /scan project|rescan/i.test(b.textContent ?? ''),
  );
  expect(btn, 'Scan Project button should be rendered when a project is set').toBeTruthy();
  await act(async () => {
    fireEvent.click(btn!);
  });
}

beforeEach(() => {
  bridge.manifest = null;
  bridge.isConnected = false;
  useModuleStore.setState({ checklistProgress: {} });
  useProjectStore.setState({ projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF', projectName: 'PoF' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Direction 1 headline: a SUCCESSFUL scan must not throw ──

describe('AnimBP scan unwraps the {success,data} envelope', () => {
  it('renders the scanned states after a successful scan (today: TypeError on states.length of undefined)', async () => {
    mockFetchSequence(envelopeResponse({ success: true, data: scanPayload(['Idle', 'Attack', 'HitReact']) }));
    const { container } = renderGraph();
    await clickScan(container);

    const text = container.textContent ?? '';
    expect(text).toContain('Attack');
    expect(text).toContain('HitReact');
    // The scan metadata block proves the payload (not the envelope) was stored.
    expect(text).toContain('UPoFAnimInstance');
    // And no error banner.
    expect(text).not.toMatch(/failed to scan/i);
  });

  it('stores the unwrapped payload in the hook, not the envelope', async () => {
    mockFetchSequence(envelopeResponse({ success: true, data: scanPayload(['Idle', 'Walk']) }));
    const { result } = renderHook(() => useAnimBpScan('C:/proj', 'PoF'));
    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.scanError).toBeNull();
    expect(result.current.scanResult?.states.map((s) => s.name)).toEqual(['Idle', 'Walk']);
    expect(result.current.scanResult).not.toHaveProperty('success');
    expect(result.current.scanResult).not.toHaveProperty('data');
  });
});

// ── Failure paths surface text, never a throw ──

describe('AnimBP scan failure paths report a reason', () => {
  it('surfaces the {success:false,error} envelope message on a non-2xx response', async () => {
    mockFetchSequence(envelopeResponse({ success: false, error: 'Project path does not exist' }, false, 404));
    const { result } = renderHook(() => useAnimBpScan('C:/proj', 'PoF'));
    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.scanError).toBe('Project path does not exist');
    expect(result.current.scanResult).toBeNull();
  });

  it('surfaces a reason for a 200 error envelope', async () => {
    mockFetchSequence(envelopeResponse({ success: false, error: 'moduleName is required' }));
    const { result } = renderHook(() => useAnimBpScan('C:/proj', 'PoF'));
    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.scanError).toBe('moduleName is required');
  });

  it('reports a malformed body instead of storing an unusable result', async () => {
    // An envelope whose data is missing the load-bearing arrays.
    mockFetchSequence(envelopeResponse({ success: true, data: { scannedAt: 'x' } }));
    const { result } = renderHook(() => useAnimBpScan('C:/proj', 'PoF'));
    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.scanResult).toBeNull();
    expect(result.current.scanError).toBeTruthy();
    expect(result.current.scanError).not.toBe('undefined');
  });

  it('reports a non-JSON body instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
    } as unknown as Response)));
    const { result } = renderHook(() => useAnimBpScan('C:/proj', 'PoF'));
    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.scanResult).toBeNull();
    expect(result.current.scanError).toBeTruthy();
  });

  it('reports a failed error envelope that carries no message', async () => {
    mockFetchSequence(envelopeResponse({ success: false }, false, 500));
    const { result } = renderHook(() => useAnimBpScan('C:/proj', 'PoF'));
    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.scanError).toBeTruthy();
    expect(String(result.current.scanError)).not.toMatch(/undefined/);
  });
});

// ── The "what changed since last scan" diff still fires ──

describe('AnimBP rescan still computes the diff', () => {
  it('flags newly appeared states and transitions on a second scan', async () => {
    mockFetchSequence(
      envelopeResponse({ success: true, data: scanPayload(['Idle', 'Walk'], [{ from: 'Idle', to: 'Walk', rule: 'Speed > 0' }]) }),
      envelopeResponse({
        success: true,
        data: scanPayload(['Idle', 'Walk', 'Attack'], [
          { from: 'Idle', to: 'Walk', rule: 'Speed > 0' },
          { from: 'Walk', to: 'Attack', rule: 'AttackPressed' },
        ]),
      }),
    );
    const { result } = renderHook(() => useAnimBpScan('C:/proj', 'PoF'));
    await act(async () => { await result.current.handleScan(); });
    expect(result.current.newStateIds.size).toBe(0);

    await act(async () => { await result.current.handleScan(); });
    await waitFor(() => expect(result.current.newStateIds.has('scanned-Attack')).toBe(true));
    expect(result.current.newStateIds.size).toBe(1);
    expect(result.current.modifiedTransitions.has('scanned-Walk->scanned-Attack')).toBe(true);
    expect(result.current.modifiedTransitions.size).toBe(1);
  });
});

// ── Provenance: the fallback graph is not badged RUNTIME ──

function provenanceOf(container: HTMLElement) {
  const els = container.querySelectorAll('[data-testid="graph-provenance"]');
  expect(els.length, 'exactly one provenance badge').toBe(1);
  const el = els[0] as HTMLElement;
  return { kind: el.getAttribute('data-provenance'), text: (el.textContent ?? '').trim() };
}

const PROVENANCE_BADGES = ['BRIDGE', 'PROJECT SCAN', 'TEMPLATE'];

describe('the graph states its provenance and the three are mutually exclusive', () => {
  it('labels an unscanned, unbridged graph a TEMPLATE — never RUNTIME', () => {
    const { container } = renderGraph();
    const { kind, text } = provenanceOf(container);
    expect(kind).toBe('template');
    expect(text).toBe('TEMPLATE');
    expect(container.textContent ?? '').not.toContain('RUNTIME');
    // The other two badge tokens are absent from the badge.
    expect(PROVENANCE_BADGES.filter((b) => text.includes(b))).toEqual(['TEMPLATE']);
  });

  it('labels a scanned graph PROJECT SCAN', async () => {
    mockFetchSequence(envelopeResponse({ success: true, data: scanPayload(['Idle', 'Attack']) }));
    const { container } = renderGraph();
    await clickScan(container);
    const { kind, text } = provenanceOf(container);
    expect(kind).toBe('scanned');
    expect(text).toBe('PROJECT SCAN');
    expect(PROVENANCE_BADGES.filter((b) => text.includes(b))).toEqual(['PROJECT SCAN']);
  });

  it('labels a bridged graph BRIDGE and the bridge outranks a scan', async () => {
    bridge.isConnected = true;
    bridge.manifest = {
      animAssets: [{
        assetType: 'AnimBlueprint',
        stateMachines: [{ states: ['BridgeIdle', 'BridgeRun'], transitions: [{ from: 'BridgeIdle', to: 'BridgeRun', condition: 'Speed > 0' }] }],
      }],
    };
    mockFetchSequence(envelopeResponse({ success: true, data: scanPayload(['Idle', 'Attack']) }));
    const { container } = renderGraph();
    await clickScan(container);
    const { kind, text } = provenanceOf(container);
    expect(kind).toBe('bridge');
    expect(text).toContain('BRIDGE');
    expect(PROVENANCE_BADGES.filter((b) => text.includes(b))).toEqual(['BRIDGE']);
    expect(container.textContent ?? '').toContain('BridgeIdle');
  });
});
