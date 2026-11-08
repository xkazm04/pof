/**
 * Bidirectional State Sync panel hardening: each block pins one defect found by
 * the 2026-11-08 sweep. The client runs against a fake socket; no editor is contacted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { BidirectionalStateSyncPanel } from '@/components/modules/project-setup/BidirectionalStateSyncPanel';
import { useBidirectionalStateSyncPanel } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/useBidirectionalStateSyncPanel';
import { PropertyEditorRow } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/PropertyEditorRow';
import { outcomeFor } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/conflictResolution';
import { diffSyncState, type SyncView } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/syncEvents';
import { ConflictSection } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/ConflictSection';
import { OfflineState } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/OfflineState';
import { LiveStateSyncPanel } from '@/components/modules/project-setup/LiveStateSyncPanel';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { writeKey } from '@/lib/ue5-bridge/sync-ledger';

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

const lastSocket = () => FakeWebSocket.instances.at(-1)!;

function renderLivePanel() {
  ue5LiveState.connect('127.0.0.1', 30041);
  const ws = lastSocket();
  act(() => { ws.fireOpen(); });
  const view = render(<BidirectionalStateSyncPanel />);
  return { ws, ...view };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
});

afterEach(() => {
  cleanup();
  ue5LiveState.disconnect('test-teardown');
});

describe('connect control during the handshake', () => {
  it('offers no Connect while a handshake is in flight, so it cannot be torn down', () => {
    ue5LiveState.connect('127.0.0.1', 30041); // still CONNECTING
    render(<BidirectionalStateSyncPanel />);

    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    const busy = screen.getByRole('button', { name: /Connecting/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    fireEvent.click(busy);
    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it('control: offers Connect when disconnected', () => {
    render(<BidirectionalStateSyncPanel />);
    expect(screen.getByRole('button', { name: 'Connect' })).not.toBeNull();
  });
});

describe('sync log auto-scroll', () => {
  afterEach(() => { delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView; });

  it('follows new entries inside the log box and never scrolls the page', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { ws } = renderLivePanel();
    const box = screen.getByText('No sync events yet').parentElement!;
    Object.defineProperty(box, 'scrollHeight', { value: 500, configurable: true });

    act(() => {
      ws.push({ type: 'property.update', payload: { watchId: 'w1', objectPath: '/Game/A', propertyName: 'Health', value: 1 } });
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(box.scrollTop).toBe(500);
  });
});

describe('sync log SNAP events', () => {
  const view = (timestamp: number, editorState = 'Editing', openLevel = '/Game/L'): SyncView => ({
    snapshot: { timestamp, editorState, openLevel },
    propertyWatches: new Map(),
    writes: new Map(),
  });

  it('a delta that only moves the timestamp (camera, selection) logs nothing', () => {
    expect(diffSyncState(view(1), view(2))).toEqual([]);
  });

  it('control: a real editor-state or level change still logs one SNAP', () => {
    expect(diffSyncState(view(1), view(2, 'PIE'))).toHaveLength(1);
    expect(diffSyncState(view(1), view(2, 'Editing', '/Game/M'))).toHaveLength(1);
  });
});

describe('watched property editor keeps the value type', () => {
  function push(currentValue: unknown, typed: string) {
    const onPush = vi.fn();
    render(<PropertyEditorRow objectPath="/Game/A" propertyName="P" currentValue={currentValue} onPush={onPush} />);
    fireEvent.click(screen.getByTitle('Edit & push to UE5'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: typed } });
    fireEvent.click(screen.getByTitle('Push to UE5'));
    return onPush;
  }

  it('a string property stays a string even when the text looks like JSON', () => {
    expect(push('100', '200')).toHaveBeenCalledWith('/Game/A', 'P', '200');
    cleanup();
    expect(push('off', 'true')).toHaveBeenCalledWith('/Game/A', 'P', 'true');
  });

  it('control: a number property is still parsed', () => {
    expect(push(5, '7')).toHaveBeenCalledWith('/Game/A', 'P', 7);
  });
});

describe('Take UE5 clears the row chip as well as the conflict list', () => {
  const KEY = writeKey('/Game/A', 'Health');
  const health = (ws: FakeWebSocket, value: number) =>
    ws.push({ type: 'property.update', payload: { watchId: 'w1', objectPath: '/Game/A', propertyName: 'Health', value } });

  it('shows conflict until dismissed, then no chip', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    const ws = lastSocket();
    ws.fireOpen();
    const { result } = renderHook(() => useBidirectionalStateSyncPanel());

    act(() => { health(ws, 50); });
    act(() => { result.current.handleWatchedPush('/Game/A', 'Health', 100); });
    act(() => { health(ws, 80); });
    expect(outcomeFor(result.current.rowWrites, '/Game/A', 'Health')).toBe('conflict');

    act(() => { result.current.resolveConflict(KEY, 'accept-ue5'); });
    expect(result.current.conflicts).toEqual([]);
    expect(outcomeFor(result.current.rowWrites, '/Game/A', 'Health')).toBeNull();
  });
});

describe('viewport teleport refuses incomplete targets', () => {
  const setFrames = (ws: FakeWebSocket) => ws.sent.filter((f) => f.includes('set.property'));

  function openTeleport() {
    const live = renderLivePanel();
    fireEvent.click(screen.getByRole('button', { name: /Viewport Teleport/ }));
    return { ...live, inputs: live.container.querySelectorAll<HTMLInputElement>('input[type="number"]') };
  }

  it('a cleared axis disables Teleport and sends no frame', () => {
    const { ws, inputs } = openTeleport();
    fireEvent.change(inputs[0], { target: { value: '' } });
    const go = screen.getByRole('button', { name: /Teleport Camera/ }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(go);
    expect(setFrames(ws)).toEqual([]);
  });

  it('a FOV of 0 is refused rather than replaced', () => {
    const { inputs } = openTeleport();
    fireEvent.change(inputs[6], { target: { value: '0' } });
    expect((screen.getByRole('button', { name: /Teleport Camera/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('control: the default target sends its three frames', () => {
    const { ws } = openTeleport();
    fireEvent.click(screen.getByRole('button', { name: /Teleport Camera/ }));
    expect(setFrames(ws)).toHaveLength(3);
  });
});

describe('blank values are not writes', () => {
  function fillDirect(value: string) {
    fireEvent.change(screen.getByLabelText('Object Path'), { target: { value: '/Game/A' } });
    fireEvent.change(screen.getByLabelText('Property'), { target: { value: 'Health' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value } });
    return screen.getByTitle('Push to UE5') as HTMLButtonElement;
  }

  it('the direct form stays disabled with an empty value', () => {
    renderLivePanel();
    expect(fillDirect('').disabled).toBe(true);
  });

  it('control: an explicit empty string can still be sent', () => {
    renderLivePanel();
    expect(fillDirect('""').disabled).toBe(false);
  });

  it('a cleared number row does not push an empty string', () => {
    const onPush = vi.fn();
    render(<PropertyEditorRow objectPath="/Game/A" propertyName="P" currentValue={5} onPush={onPush} />);
    fireEvent.click(screen.getByTitle('Edit & push to UE5'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } });
    fireEvent.click(screen.getByTitle('Push to UE5'));
    expect(onPush).not.toHaveBeenCalled();
  });
});

describe('sync log header markup', () => {
  it('nests no button inside the section toggle', () => {
    const { ws, container } = renderLivePanel();
    act(() => {
      ws.push({ type: 'property.update', payload: { watchId: 'w1', objectPath: '/Game/A', propertyName: 'Health', value: 1 } });
    });
    expect(screen.getByRole('button', { name: 'Clear sync log' })).not.toBeNull();
    expect(container.querySelector('button button')).toBeNull();
  });
});

describe('section toggles point at real panels', () => {
  const dangling = (root: HTMLElement) => [...root.querySelectorAll('[aria-controls]')]
    .map((el) => el.getAttribute('aria-controls')!)
    .filter((id) => document.getElementById(id) === null);

  it('every aria-controls in the live panel resolves once sections are open', () => {
    const { container } = renderLivePanel();
    fireEvent.click(screen.getByRole('button', { name: /Viewport Teleport/ }));
    expect(container.querySelectorAll('[aria-controls]').length).toBe(4);
    expect(dangling(container)).toEqual([]);
  });

  it('the conflict section resolves too', () => {
    const { container } = render(<ConflictSection showConflicts setShowConflicts={() => {}} conflicts={[]} />);
    expect(dangling(container)).toEqual([]);
  });
});

describe('teleport and row inputs are named', () => {
  it('each teleport field is reachable by its label', () => {
    renderLivePanel();
    fireEvent.click(screen.getByRole('button', { name: /Viewport Teleport/ }));
    for (const name of ['x', 'y', 'z', 'pitch', 'yaw', 'roll', 'FOV']) {
      expect(screen.getByLabelText(name).tagName).toBe('INPUT');
    }
  });

  it('the row editor names the property it edits', () => {
    render(<PropertyEditorRow objectPath="/Game/A" propertyName="Health" currentValue={5} onPush={() => {}} />);
    fireEvent.click(screen.getByTitle('Edit & push to UE5'));
    expect(screen.getByRole('textbox', { name: 'New value for Health' })).not.toBeNull();
  });
});

describe('sync log filter state', () => {
  it('exposes the active filter to assistive tech', () => {
    renderLivePanel();
    const sent = screen.getByRole('button', { name: 'Sent' });
    expect(sent.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(sent);
    expect(screen.getByRole('button', { name: 'Sent' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('adding a watch that already exists', () => {
  function liveWithWatch() {
    ue5LiveState.connect('127.0.0.1', 30041);
    const ws = lastSocket();
    act(() => { ws.fireOpen(); });
    render(<LiveStateSyncPanel />);
    act(() => {
      ws.push({
        type: 'state.snapshot',
        payload: {
          timestamp: 1, editorState: 'Editing', openLevel: '/L', selectedActors: [], dirtyPackages: [],
          viewport: { cameraLocation: { x: 0, y: 0, z: 0 }, cameraRotation: { pitch: 0, yaw: 0, roll: 0 }, fov: 90, viewMode: 'Lit' },
        },
      });
      ws.push({ type: 'property.update', payload: { watchId: 'w1', objectPath: '/Game/A', propertyName: 'Health', value: 1 } });
    });
    fireEvent.click(screen.getByRole('button', { name: /Property Watches/ }));
    ws.sent.length = 0;
    return ws;
  }

  function add(objectPath: string, propertyName: string) {
    fireEvent.change(screen.getByLabelText('Object Path'), { target: { value: objectPath } });
    fireEvent.change(screen.getByLabelText('Property'), { target: { value: propertyName } });
    fireEvent.click(screen.getByRole('button', { name: 'Add property watch' }));
  }

  const subscribes = (ws: FakeWebSocket) => ws.sent.filter((f) => f.includes('subscribe.property'));

  it('does not open a second subscription for the same property', () => {
    const ws = liveWithWatch();
    add('/Game/A', 'Health');
    expect(subscribes(ws)).toEqual([]);
  });

  it('control: a different property subscribes', () => {
    const ws = liveWithWatch();
    add('/Game/A', 'Mana');
    expect(subscribes(ws)).toHaveLength(1);
  });
});

describe('direct write form after a dropped frame', () => {
  function pushDirect(open: boolean) {
    const { ws } = renderLivePanel();
    if (!open) ws.readyState = FakeWebSocket.CLOSING;
    fireEvent.change(screen.getByLabelText('Object Path'), { target: { value: '/Game/A' } });
    fireEvent.change(screen.getByLabelText('Property'), { target: { value: 'Health' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '7' } });
    fireEvent.click(screen.getByTitle('Push to UE5'));
    return (screen.getByLabelText('Value') as HTMLInputElement).value;
  }

  it('keeps what the user typed when the frame never left', () => {
    expect(pushDirect(false)).toBe('7');
  });

  it('control: clears after a delivered write', () => {
    expect(pushDirect(true)).toBe('');
  });
});
