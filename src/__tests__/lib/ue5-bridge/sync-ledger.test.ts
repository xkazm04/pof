/**
 * The live write channel's conflict rule is a three-way compare on the exact
 * key: base = the watched value when we wrote, local = what we wrote, remote =
 * the first watch read-back after the write. Converged (remote == written) is
 * NOT a conflict; remote == base means UE has not applied it yet.
 *
 * Before this ledger the rule prefix-scanned display strings in the panel's
 * log (`e.message.startsWith(update.propertyName)`) and raised a conflict
 * whenever `previousValue !== value` - i.e. on every confirmed write, on any
 * actor with the same property name, and on 'Max' vs 'MaxHealth'.
 */

import { describe, it, expect } from 'vitest';
import {
  appendLog,
  classifyWrite,
  deriveConflicts,
  observeUpdate,
  recordWrite,
  writeKey,
  MAX_LEDGER_ENTRIES,
  type Ledger,
} from '@/lib/ue5-bridge/sync-ledger';

const EMPTY: Ledger = new Map();

/** Ledger holding one write of `written` over `base` at seq 1. */
function ledgerWith(objectPath: string, propertyName: string, base: unknown, written: unknown) {
  return recordWrite(EMPTY, { objectPath, propertyName, base, baseKnown: true, written, sent: true, seq: 1 });
}

describe('classifyWrite - the closed outcome vocabulary', () => {
  const write = { base: 50, written: 100, sent: true, seq: 1 };

  it('case 3: read-back equals the written value -> confirmed, and no conflict', () => {
    expect(classifyWrite(write, { value: 100, seq: 2 })).toBe('confirmed');
    const ledger = observeUpdate(ledgerWith('/Game/A', 'Health', 50, 100), { objectPath: '/Game/A', propertyName: 'Health', value: 100 }, 2);
    expect(ledger.get('/Game/A::Health')?.outcome).toBe('confirmed');
    expect(deriveConflicts(ledger)).toEqual([]);
  });

  it('case 4: read-back still equals the base -> pending, and no conflict', () => {
    expect(classifyWrite(write, { value: 50, seq: 2 })).toBe('pending');
    const ledger = observeUpdate(ledgerWith('/Game/A', 'Health', 50, 100), { objectPath: '/Game/A', propertyName: 'Health', value: 50 }, 2);
    expect(deriveConflicts(ledger)).toEqual([]);
  });

  it('case 5: read-back is neither base nor written -> diverged, with typed values', () => {
    expect(classifyWrite(write, { value: 80, seq: 2 })).toBe('diverged');
    const ledger = observeUpdate(ledgerWith('/Game/A', 'Health', 50, 100), { objectPath: '/Game/A', propertyName: 'Health', value: 80 }, 2);
    expect(deriveConflicts(ledger)).toEqual([
      { key: '/Game/A::Health', objectPath: '/Game/A', propertyName: 'Health', base: 50, written: 100, inbound: 80 },
    ]);
  });

  it('a write that never left the socket is dropped, whatever comes back', () => {
    expect(classifyWrite({ ...write, sent: false }, { value: 80, seq: 2 })).toBe('dropped');
  });

  it('no read-back yet, or one that arrived before the write -> unobserved', () => {
    expect(classifyWrite(write)).toBe('unobserved');
    expect(classifyWrite({ ...write, seq: 5 }, { value: 80, seq: 4 })).toBe('unobserved');
  });

  it('compares structured values by content, not reference', () => {
    const vec = { base: { x: 0, y: 0 }, written: { x: 1, y: 2 }, sent: true, seq: 1 };
    expect(classifyWrite(vec, { value: { y: 2, x: 1 }, seq: 2 })).toBe('confirmed');
    expect(classifyWrite(vec, { value: { x: 0, y: 0 }, seq: 2 })).toBe('pending');
  });
});

describe('observeUpdate - the exact key, never a name match', () => {
  it('case 6: a watch on another actor with the same property name raises nothing', () => {
    let ledger: Ledger = recordWrite(EMPTY, { objectPath: '/Game/A', propertyName: 'Health', base: undefined, baseKnown: false, written: 100, sent: true, seq: 1 });
    ledger = observeUpdate(ledger, { objectPath: '/Game/B', propertyName: 'Health', value: 50 }, 2);
    ledger = observeUpdate(ledger, { objectPath: '/Game/B', propertyName: 'Health', value: 80 }, 3);
    expect(deriveConflicts(ledger)).toEqual([]);
    expect(ledger.get('/Game/A::Health')?.outcome).toBe('unobserved');
  });

  it("case 7: 'Max' does not prefix-collide with 'MaxHealth'", () => {
    let ledger: Ledger = recordWrite(EMPTY, { objectPath: '/Game/A', propertyName: 'MaxHealth', base: undefined, baseKnown: false, written: 5, sent: true, seq: 1 });
    ledger = observeUpdate(ledger, { objectPath: '/Game/A', propertyName: 'Max', value: 1 }, 2);
    ledger = observeUpdate(ledger, { objectPath: '/Game/A', propertyName: 'Max', value: 2 }, 3);
    expect(deriveConflicts(ledger)).toEqual([]);
  });

  it('pending resolves on the next read-back; a settled outcome is not re-opened by later history', () => {
    let ledger: Ledger = ledgerWith('/Game/A', 'Health', 50, 100);
    ledger = observeUpdate(ledger, { objectPath: '/Game/A', propertyName: 'Health', value: 50 }, 2);
    expect(ledger.get('/Game/A::Health')?.outcome).toBe('pending');
    ledger = observeUpdate(ledger, { objectPath: '/Game/A', propertyName: 'Health', value: 100 }, 3);
    expect(ledger.get('/Game/A::Health')?.outcome).toBe('confirmed');
    // A later edit made in UE is subsequent history, not a conflict with our landed write.
    ledger = observeUpdate(ledger, { objectPath: '/Game/A', propertyName: 'Health', value: 80 }, 4);
    expect(ledger.get('/Game/A::Health')?.outcome).toBe('confirmed');
    expect(deriveConflicts(ledger)).toEqual([]);
  });

  it('with no watched base, a first read-back other than the written value is diverged', () => {
    let ledger: Ledger = recordWrite(EMPTY, { objectPath: '/Game/A', propertyName: 'Health', base: undefined, baseKnown: false, written: 100, sent: true, seq: 1 });
    ledger = observeUpdate(ledger, { objectPath: '/Game/A', propertyName: 'Health', value: 80 }, 2);
    expect(ledger.get('/Game/A::Health')?.outcome).toBe('diverged');
  });

  it('returns the same map when nothing in it changed (subscribers can compare by reference)', () => {
    const ledger = ledgerWith('/Game/A', 'Health', 50, 100);
    expect(observeUpdate(ledger, { objectPath: '/Game/B', propertyName: 'Health', value: 1 }, 2)).toBe(ledger);
  });

  it('keys are objectPath::propertyName and the ledger is bounded', () => {
    expect(writeKey('/Game/A', 'Health')).toBe('/Game/A::Health');
    let ledger: Ledger = EMPTY;
    for (let i = 0; i < MAX_LEDGER_ENTRIES + 5; i++) {
      ledger = recordWrite(ledger, { objectPath: `/Game/${i}`, propertyName: 'P', base: 0, baseKnown: true, written: 1, sent: true, seq: i + 1 });
    }
    expect(ledger.size).toBe(MAX_LEDGER_ENTRIES);
    expect(ledger.has('/Game/0::P')).toBe(false);
    expect(ledger.has(`/Game/${MAX_LEDGER_ENTRIES + 4}::P`)).toBe(true);
  });
});

describe('appendLog - the one trim', () => {
  it('appends and keeps only the newest `max` entries', () => {
    expect(appendLog([1, 2], 3, 5)).toEqual([1, 2, 3]);
    expect(appendLog([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });
});
