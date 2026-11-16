/**
 * The WS live-state firehose lands in this persisted store on every message. Only the
 * connection settings are persisted, so a frame must not cost a synchronous localStorage write.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { LiveEditorState, UE5EditorSnapshot } from '@/types/ue5-bridge';

const frame = (snapshot: UE5EditorSnapshot | null, frameRate = 30): LiveEditorState =>
  ({ wsStatus: 'connected', snapshot, frameRate, propertyWatches: new Map() }) as unknown as LiveEditorState;
const snap = (n: number) => ({ tick: n }) as unknown as UE5EditorSnapshot;

let setItem: MockInstance;

beforeEach(() => {
  useUE5BridgeStore.getState().setHost('127.0.0.1');
  useUE5BridgeStore.getState().setLiveState(frame(null, 0));
  setItem = vi.spyOn(Storage.prototype, 'setItem');
});
afterEach(() => setItem.mockRestore());

describe('ue5BridgeStore persistence under the live-state firehose', () => {
  it('writes nothing for frames that change only runtime slices', () => {
    for (let i = 1; i <= 100; i++) useUE5BridgeStore.getState().setLiveState(frame(snap(i), i));
    expect(setItem).toHaveBeenCalledTimes(0);
  });

  it('notifies no subscriber for a frame that changed nothing', () => {
    const f = frame(snap(1));
    useUE5BridgeStore.getState().setLiveState(f);
    const listener = vi.fn();
    const unsub = useUE5BridgeStore.subscribe(listener);
    for (let i = 0; i < 10; i++) useUE5BridgeStore.getState().setLiveState(f);
    unsub();
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('still persists a real settings change', () => {
    useUE5BridgeStore.getState().setHost('10.0.0.9');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('pof-ue5-bridge')!).state.host).toBe('10.0.0.9');
  });
});
