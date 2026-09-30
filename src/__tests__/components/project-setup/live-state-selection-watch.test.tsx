/**
 * Watch a selected actor in one click.
 *
 * Every `SelectedActor` the live channel streams already carries its object
 * `path`, yet the property-watch form started empty and asked the user to type
 * '/Game/…' by hand (find the actor in UE, copy its reference, paste, fix the
 * format). Each actor row now offers "Watch…", which opens the Property
 * Watches section with the path prefilled and focus on Property, and shows how
 * many watches the actor already has.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { PropertyWatchUpdate, SelectedActor, UE5EditorSnapshot } from '@/types/ue5-bridge';
import { LiveStateSyncPanel } from '@/components/modules/project-setup/LiveStateSyncPanel';
import {
  watchDraftFromActor,
  watchCountsByObjectPath,
} from '@/components/modules/project-setup/LiveStateSyncPanel/selectionWatch';
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
  fireOpen() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(); }
  push(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}

const ENEMY: SelectedActor = {
  path: '/Game/Maps/VS.VS:PersistentLevel.BP_VSEnemy_C_1',
  label: 'BP_VSEnemy',
  className: 'BP_VSEnemy_C',
};

function snapshotWith(actors: SelectedActor[]): UE5EditorSnapshot {
  return {
    timestamp: 1_700_000_000_000,
    editorState: 'Editing',
    viewport: {
      cameraLocation: { x: 0, y: 0, z: 0 },
      cameraRotation: { pitch: 0, yaw: 0, roll: 0 },
      fov: 90,
      viewMode: 'Lit',
    },
    selectedActors: actors,
    pieState: null,
    openLevel: '/Game/Maps/VS',
    dirtyPackages: [],
  };
}

function watch(watchId: string, objectPath: string): [string, PropertyWatchUpdate] {
  return [watchId, { watchId, objectPath, propertyName: 'Health', value: 1, timestamp: 1 }];
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
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

describe('selection → watch helpers', () => {
  it('watchDraftFromActor carries the actor path, and offers nothing without one', () => {
    expect(watchDraftFromActor(ENEMY)).toEqual({ objectPath: ENEMY.path });
    expect(watchDraftFromActor({ path: '', label: 'x', className: 'y' })).toBeNull();
    expect(watchDraftFromActor({ path: '   ', label: 'x', className: 'y' })).toBeNull();
  });

  it('watchCountsByObjectPath tallies watches per object', () => {
    expect(watchCountsByObjectPath([watch('w1', 'A'), watch('w2', 'A'), watch('w3', 'B')]))
      .toEqual({ A: 2, B: 1 });
    expect(watchCountsByObjectPath([])).toEqual({});
  });
});

describe('ActorRow offers the watch entry point', () => {
  it('"Watch…" opens Property Watches with the path prefilled and focus on Property', () => {
    useUE5BridgeStore.setState({ wsStatus: 'connected', liveSnapshot: snapshotWith([ENEMY]) });
    render(<LiveStateSyncPanel />);

    expect(screen.queryByRole('region', { name: 'Property Watches' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Watch a property on BP_VSEnemy' }));

    expect(screen.getByRole('region', { name: 'Property Watches' })).toBeTruthy();
    const objectPath = screen.getByLabelText('Object Path') as HTMLInputElement;
    const property = screen.getByLabelText('Property') as HTMLInputElement;
    expect(objectPath.value).toBe(ENEMY.path);
    expect(document.activeElement).toBe(property);
  });

  it('no watch action for an actor without a path', () => {
    useUE5BridgeStore.setState({
      wsStatus: 'connected',
      liveSnapshot: snapshotWith([{ path: '', label: 'Pathless', className: 'Actor' }]),
    });
    render(<LiveStateSyncPanel />);
    expect(screen.getByText('Pathless')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Watch a property on/ })).toBeNull();
  });

  it('shows how many watches the actor already has', () => {
    const other: SelectedActor = { path: 'B', label: 'Other', className: 'Actor' };
    useUE5BridgeStore.setState({
      wsStatus: 'connected',
      liveSnapshot: snapshotWith([{ ...ENEMY, path: 'A' }, other]),
      propertyWatches: Object.fromEntries([watch('w1', 'A'), watch('w2', 'A'), watch('w3', 'B')]),
    });
    render(<LiveStateSyncPanel />);

    const region = screen.getByRole('region', { name: 'Selected Actors' });
    const rows = Array.from(region.querySelectorAll('[data-actor-path]'));
    const rowA = rows.find((r) => r.getAttribute('data-actor-path') === 'A')!;
    const rowB = rows.find((r) => r.getAttribute('data-actor-path') === 'B')!;
    expect(rowA.textContent).toContain('2 watched');
    expect(rowB.textContent).toContain('1 watched');
  });
});

describe('end to end over the live channel', () => {
  it('Connect (explicit) → selection frame → Watch… → Health → one subscribe.property frame', () => {
    render(<LiveStateSyncPanel />);
    expect(FakeWebSocket.instances).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(FakeWebSocket.instances).toHaveLength(1);
    const ws = FakeWebSocket.instances[0];
    act(() => { ws.fireOpen(); });
    act(() => { ws.push({ type: 'state.snapshot', payload: snapshotWith([ENEMY]) }); });
    ws.sent = [];

    fireEvent.click(screen.getByRole('button', { name: 'Watch a property on BP_VSEnemy' }));
    const property = screen.getByLabelText('Property') as HTMLInputElement;
    fireEvent.change(property, { target: { value: 'Health' } });
    fireEvent.submit(property.closest('form')!);

    const subscribes = ws.sent
      .map((s) => JSON.parse(s) as { type: string; payload?: Record<string, unknown> })
      .filter((m) => m.type === 'subscribe.property');
    expect(subscribes).toHaveLength(1);
    expect(subscribes[0].payload).toMatchObject({
      objectPath: ENEMY.path,
      propertyName: 'Health',
      intervalMs: 500,
    });
  });
});
