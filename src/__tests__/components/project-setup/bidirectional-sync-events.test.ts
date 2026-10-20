/**
 * syncEvents: the panel's inbound/outcome events and traffic totals are pure
 * derivations of client state, so the log cap and Clear never touch the counters.
 */

import { describe, it, expect } from 'vitest';
import {
  diffSyncState,
  tallyEvents,
  EMPTY_TOTALS,
  type SyncView,
} from '@/components/modules/project-setup/BidirectionalStateSyncPanel/syncEvents';
import { recordWrite, observeUpdate, type Ledger } from '@/lib/ue5-bridge/sync-ledger';
import type { SyncLogEntry } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/types';

const watch = (watchId: string, propertyName: string, value: unknown, objectPath = '/Game/A') =>
  ({ watchId, objectPath, propertyName, value });

function view(over: Partial<SyncView> = {}): SyncView {
  return { snapshot: null, propertyWatches: new Map(), writes: new Map(), ...over };
}

const snap = (timestamp: number, editorState = 'Editing', openLevel = '/Game/L') => ({ timestamp, editorState, openLevel });

function entry(direction: 'outbound' | 'inbound', dropped = false): SyncLogEntry {
  return { id: 1, ts: 1, direction, level: 'info', category: 'X', message: 'm', ...(dropped ? { dropped: true } : {}) };
}

describe('diffSyncState', () => {
  it('a changed snapshot timestamp is exactly one inbound SNAP event; the first frame is none', () => {
    const events = diffSyncState(view({ snapshot: snap(1) }), view({ snapshot: snap(2, 'PIE') }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ direction: 'inbound', category: 'SNAP', message: 'Editor: PIE' });
    expect(diffSyncState(view(), view({ snapshot: snap(2) }))).toEqual([]);
    expect(diffSyncState(view({ snapshot: snap(2) }), view({ snapshot: snap(2) }))).toEqual([]);
  });

  it('replacing a watch (same map size) emits a PROP event for the new one', () => {
    const prev = view({ propertyWatches: new Map([['w1', watch('w1', 'A', 1)]]) });
    const next = view({ propertyWatches: new Map([['w2', watch('w2', 'B', 2)]]) });
    const events = diffSyncState(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ direction: 'inbound', category: 'PROP', message: 'B = 2', detail: '/Game/A' });
  });

  it('two watches added in one change give two PROP events in watchId order', () => {
    const next = view({ propertyWatches: new Map([['w3', watch('w3', 'C', 3)], ['w2', watch('w2', 'B', 2)]]) });
    const events = diffSyncState(view(), next);
    expect(events.map((e) => e.message)).toEqual(['B = 2', 'C = 3']);
  });

  it('a value update on an existing watch is not a new watch', () => {
    const prev = view({ propertyWatches: new Map([['w1', watch('w1', 'A', 1)]]) });
    const next = view({ propertyWatches: new Map([['w1', watch('w1', 'A', 9)]]) });
    expect(diffSyncState(prev, next)).toEqual([]);
  });

  describe('ledger transitions', () => {
    const base = (): Ledger => recordWrite(new Map(), {
      objectPath: '/Game/A', propertyName: 'Health', base: 50, baseKnown: true, written: 100, sent: true, seq: 1,
    });
    const upd = (value: unknown) => ({ objectPath: '/Game/A', propertyName: 'Health', value });

    it('unobserved -> confirmed is an inbound info ACK', () => {
      const prev = base();
      const events = diffSyncState(view({ writes: prev }), view({ writes: observeUpdate(prev, upd(100), 2) }));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ direction: 'inbound', level: 'info', category: 'ACK' });
    });

    it('unobserved -> diverged is an inbound conflict naming base, written and inbound', () => {
      const prev = base();
      const events = diffSyncState(view({ writes: prev }), view({ writes: observeUpdate(prev, upd(80), 2) }));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ direction: 'inbound', level: 'conflict' });
      const text = `${events[0].message} ${events[0].detail ?? ''}`;
      expect(text).toContain('50');
      expect(text).toContain('100');
      expect(text).toContain('80');
    });

    it('no transition, a brand new write, or a pending read-back emits nothing', () => {
      const prev = base();
      expect(diffSyncState(view({ writes: prev }), view({ writes: new Map(prev) }))).toEqual([]);
      expect(diffSyncState(view(), view({ writes: prev }))).toEqual([]);
      expect(diffSyncState(view({ writes: prev }), view({ writes: observeUpdate(prev, upd(50), 2) }))).toEqual([]);
    });
  });
});

describe('tallyEvents', () => {
  it('250 outbound events total 250 (no log cap) and a log clear cannot change totals', () => {
    const events = Array.from({ length: 250 }, () => entry('outbound'));
    const totals = tallyEvents(EMPTY_TOTALS, events);
    expect(totals.outboundTotal).toBe(250);
    expect(tallyEvents(totals, [])).toEqual(totals);
  });

  it('a dropped outbound counts as dropped, not outbound; inbound counts separately', () => {
    const totals = tallyEvents(EMPTY_TOTALS, [entry('outbound', true), entry('outbound'), entry('inbound')]);
    expect(totals).toEqual({ outboundTotal: 1, inboundTotal: 1, droppedTotal: 1 });
  });
});
