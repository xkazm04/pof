/**
 * Live State Sync, on its real host.
 *
 * `LiveStateSyncPanel` (viewport, selection, PIE and property watches streamed
 * over ws://…/pof/live) was built, split and a11y-swept with ZERO mounts in
 * src — the app's only real-time editor channel had no surface. Project Setup
 * is the UE5 connection home, so the panel mounts there once a project exists.
 *
 * Pinned here:
 *   1. the panel is on screen in Project Setup with a project loaded;
 *   2. [guard] showing it opens NO socket and sends NO frame — connecting stays
 *      an explicit user click (useLiveStateSync's mount only subscribes);
 *   3. while the handshake is in flight the header offers a disabled
 *      "Connecting…", never a Connect whose second click would re-enter
 *      connect() → cleanup() and tear the handshake down;
 *   4. a snapshot retained through an unexpected close is labelled stale
 *      instead of rendering frozen values as live.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ChecklistItem, ScanState } from '@/components/modules/project-setup/useProjectScan';
import type { UE5EditorSnapshot } from '@/types/ue5-bridge';
import { mockFetchRoutes } from '@/__tests__/setup';

// ── Mocks (the project-nba-card.test.tsx host pattern) ──────────────────────

const { scanResult } = vi.hoisted(() => ({
  scanResult: {
    current: {
      engines: [{ version: '5.8.0', path: 'C:/UE_5.8' }] as Array<{ version: string; path: string }>,
      checklist: [{ id: 'uproject', label: 'UE Project', ok: true, detail: 'PoF.uproject' }] as ChecklistItem[],
      projectFiles: [] as string[],
      scanning: false,
      scanState: 'settled' as ScanState,
      scan: vi.fn(),
      hasProject: true,
      okCount: 1,
      missingToolCount: 0,
    },
  },
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({
    sendPrompt: vi.fn(),
    execute: () => Promise.resolve(),
    isRunning: false,
  }),
}));

vi.mock('@/components/modules/project-setup/useProjectScan', () => ({
  useProjectScan: () => scanResult.current,
}));

import { ProjectSetupModule } from '@/components/modules/project-setup/ProjectSetupModule';
import { LiveStateSyncPanel } from '@/components/modules/project-setup/LiveStateSyncPanel';
import { useProjectStore } from '@/stores/projectStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';

// ── Fake WebSocket (jsdom's is a real network client) ───────────────────────

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState: number = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = FakeWebSocket.CLOSED; }
}

const SNAPSHOT: UE5EditorSnapshot = {
  timestamp: 1_700_000_000_000,
  editorState: 'Editing',
  viewport: {
    cameraLocation: { x: 0, y: 0, z: 0 },
    cameraRotation: { pitch: 0, yaw: 0, roll: 0 },
    fov: 90,
    viewMode: 'Lit',
  },
  selectedActors: [
    { path: '/Game/Maps/VS.VS:PersistentLevel.BP_VSEnemy_C_1', label: 'BP_VSEnemy', className: 'BP_VSEnemy_C' },
  ],
  pieState: null,
  openLevel: '/Game/Maps/VS',
  dirtyPackages: [],
};

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
  mockFetchRoutes([{ match: '/api/', response: { body: { success: true, data: {} } } }]);
  useProjectStore.setState({ projectPath: 'C:/proj/PoF', projectName: 'PoF', ueVersion: '5.8.0' });
  useUE5BridgeStore.setState({
    wsStatus: 'disconnected',
    liveSnapshot: null,
    propertyWatches: {},
    wsFrameRate: 0,
    host: '127.0.0.1',
    wsPort: 30041,
  });
});

afterEach(() => {
  cleanup();
  ue5LiveState.disconnect('test-teardown');
});

describe('Project Setup mounts Live State Sync', () => {
  it('shows the live-state panel once a project is loaded', () => {
    render(<ProjectSetupModule />);
    expect(screen.getByTestId('live-state-sync-panel')).toBeTruthy();
  });

  it('[guard] showing the panel never opens the socket or sends a frame', () => {
    render(<ProjectSetupModule />);
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(useUE5BridgeStore.getState().wsStatus).toBe('disconnected');
  });
});

describe('the header never offers an action that would undo the handshake', () => {
  it('while connecting: a disabled "Connecting…" and no enabled Connect', () => {
    useUE5BridgeStore.setState({ wsStatus: 'connecting' });
    render(<LiveStateSyncPanel />);

    const busy = screen.getByRole('button', { name: 'Connecting…' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    const connect = screen.queryByRole('button', { name: 'Connect' });
    expect(connect === null || (connect as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('a retained snapshot is not presented as live', () => {
  it('reconnecting with the last frame kept: sections render beside a stale note', () => {
    useUE5BridgeStore.setState({ wsStatus: 'reconnecting', liveSnapshot: SNAPSHOT });
    render(<LiveStateSyncPanel />);

    // The last frame is still worth showing…
    expect(screen.getByRole('region', { name: 'Selected Actors' }).textContent).toContain('BP_VSEnemy');
    // …but it is named for what it is.
    const stale = screen.getByTestId('live-state-stale');
    expect(stale.textContent).toMatch(/last frame/i);
    expect(stale.textContent).toMatch(/not live/i);
  });

  it('connected: no stale note', () => {
    useUE5BridgeStore.setState({ wsStatus: 'connected', liveSnapshot: SNAPSHOT });
    render(<LiveStateSyncPanel />);
    expect(screen.queryByTestId('live-state-stale')).toBeNull();
  });
});
