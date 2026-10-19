/**
 * Conflict resolution in place + per-write outcome on the editor row.
 * Pure rules (planResolution / outcomeFor), the hook's resolveConflict against a
 * FakeWebSocket, and the two components.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useBidirectionalStateSyncPanel } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/useBidirectionalStateSyncPanel';
import { ConflictSection } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/ConflictSection';
import { PropertyEditorRow } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/PropertyEditorRow';
import { planResolution, outcomeFor } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/conflictResolution';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import type { SyncConflict, SyncWrite } from '@/types/ue5-bridge';

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

function health(ws: FakeWebSocket, value: number) {
  ws.push({ type: 'property.update', payload: { watchId: 'w1', objectPath: '/Game/A', propertyName: 'Health', value } });
}
const sets = (ws: FakeWebSocket) => ws.sent.map((s) => JSON.parse(s)).filter((m) => m.type === 'set.property');

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
});
afterEach(() => {
  cleanup();
  ue5LiveState.disconnect('test-teardown');
});

const conflict: SyncConflict = { key: '/Game/A::Health', objectPath: '/Game/A', propertyName: 'Health', base: 100, written: 150, inbound: 120 };

describe('planResolution', () => {
  it('keep-mine re-writes the written value', () => {
    expect(planResolution(conflict, 'keep-mine')).toEqual({ kind: 'write', value: 150 });
  });
  it('revert writes base when known, is unavailable when not', () => {
    expect(planResolution(conflict, 'revert')).toEqual({ kind: 'write', value: 100 });
    expect(planResolution({ ...conflict, base: undefined }, 'revert')).toEqual({ kind: 'unavailable' });
  });
  it('accept-ue5 only dismisses', () => {
    expect(planResolution(conflict, 'accept-ue5')).toEqual({ kind: 'dismiss' });
  });
});

describe('outcomeFor', () => {
  const w = (outcome: SyncWrite['outcome']): SyncWrite => ({
    key: '/Game/A::Health', objectPath: '/Game/A', propertyName: 'Health',
    base: 1, baseKnown: true, written: 2, sent: outcome !== 'dropped', seq: 1, outcome,
  });
  it('maps every ledger outcome to a label; no entry is null', () => {
    const labels = (['unobserved', 'pending', 'confirmed', 'diverged', 'dropped'] as const)
      .map((o) => outcomeFor(new Map([['/Game/A::Health', w(o)]]), '/Game/A', 'Health'));
    expect(labels).toEqual(['sent', 'applying', 'applied', 'conflict', 'not sent']);
    expect(outcomeFor(new Map(), '/Game/A', 'Health')).toBeNull();
  });
});

describe('hook.resolveConflict', () => {
  function diverged() {
    ue5LiveState.connect('127.0.0.1', 30041);
    const ws = FakeWebSocket.instances.at(-1)!;
    ws.fireOpen();
    const hook = renderHook(() => useBidirectionalStateSyncPanel());
    act(() => { health(ws, 100); });
    act(() => { hook.result.current.handleWatchedPush('/Game/A', 'Health', 150); });
    act(() => { health(ws, 120); });
    return { ws, hook };
  }

  it('keep-mine sends one set.property with the written value and clears the conflict until a new divergence', () => {
    const { ws, hook } = diverged();
    expect(hook.result.current.conflicts).toHaveLength(1);
    const before = sets(ws).length;
    act(() => { hook.result.current.resolveConflict('/Game/A::Health', 'keep-mine'); });
    expect(sets(ws)).toHaveLength(before + 1);
    expect(sets(ws).at(-1).payload).toMatchObject({ objectPath: '/Game/A', propertyName: 'Health', value: 150 });
    expect(hook.result.current.conflicts).toEqual([]);
    act(() => { health(ws, 90); });
    expect(hook.result.current.conflicts).toHaveLength(1);
  });

  it('revert writes base; accept-ue5 sends nothing and hides the key, a later diverging write resurfaces it', () => {
    const { ws, hook } = diverged();
    act(() => { hook.result.current.resolveConflict('/Game/A::Health', 'revert'); });
    expect(sets(ws).at(-1).payload.value).toBe(100);

    act(() => { health(ws, 70); }); // diverges again
    expect(hook.result.current.conflicts).toHaveLength(1);
    const n = sets(ws).length;
    act(() => { hook.result.current.resolveConflict('/Game/A::Health', 'accept-ue5'); });
    expect(sets(ws)).toHaveLength(n);
    expect(hook.result.current.conflicts).toHaveLength(0);

    act(() => { hook.result.current.handleWatchedPush('/Game/A', 'Health', 200); });
    act(() => { health(ws, 60); });
    expect(hook.result.current.conflicts).toHaveLength(1);
  });
});

describe('ConflictSection actions', () => {
  it('renders three buttons; Revert is disabled without a base; clicks report key and choice', () => {
    const onResolve = vi.fn();
    render(
      <ConflictSection
        showConflicts
        setShowConflicts={() => {}}
        conflicts={[{ ...conflict, base: undefined }]}
        onResolve={onResolve}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(onResolve).toHaveBeenCalledWith('/Game/A::Health', 'keep-mine');
    fireEvent.click(screen.getByRole('button', { name: 'Take UE5' }));
    expect(onResolve).toHaveBeenLastCalledWith('/Game/A::Health', 'accept-ue5');
    expect((screen.getByRole('button', { name: 'Revert to base' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('PropertyEditorRow outcome', () => {
  it('a dropped write shows "not sent" and retry re-sends the same value once', () => {
    const onPush = vi.fn();
    render(
      <PropertyEditorRow
        objectPath="/Game/A" propertyName="Health" currentValue={50}
        onPush={onPush} outcome="not sent" lastWritten={120}
      />,
    );
    expect(screen.getByText('not sent')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith('/Game/A', 'Health', 120);
  });
  it('no outcome renders no chip', () => {
    render(<PropertyEditorRow objectPath="/Game/A" propertyName="Health" currentValue={50} onPush={() => {}} />);
    expect(screen.queryByTestId('write-outcome-chip')).toBeNull();
  });
});
