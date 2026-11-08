/**
 * `set.ack` is the plugin's verdict on one write: applied, refused with a
 * reason, or applied but altered by the editor. Acks correlate on the write's
 * own seq, so a late ack for a superseded write cannot settle a newer one.
 * The read-back is the editor's ExportText string ("100.000000"), so without
 * the ack a real write of 100 could only ever read as a false conflict.
 */

import { describe, it, expect } from 'vitest';
import { applyAck, deriveConflicts, observeUpdate, recordWrite, writeKey, type Ledger } from '@/lib/ue5-bridge/sync-ledger';
import { diffSyncState, type SyncView } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/syncEvents';
import { outcomeFor } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/conflictResolution';

const PATH = '/Game/A';
const PROP = 'Health';
const KEY = writeKey(PATH, PROP);
const ledger = (seq = 5, baseKnown = true) =>
  recordWrite(new Map(), { objectPath: PATH, propertyName: PROP, base: '50.000000', baseKnown, written: 100, sent: true, seq });
const ack = (requestId: number, rest: { ok: boolean; value?: unknown; adjusted?: boolean; error?: string }) =>
  ({ requestId, objectPath: PATH, propertyName: PROP, ...rest });
const view = (writes: Ledger): SyncView => ({ snapshot: null, propertyWatches: new Map(), writes });

describe('applyAck', () => {
  it('ok settles the write as confirmed with the value the editor now holds', () => {
    const w = applyAck(ledger(), ack(5, { ok: true, value: '100.000000' })).get(KEY)!;
    expect(w.outcome).toBe('confirmed');
    expect(w.inbound).toBe('100.000000');
  });

  it('a refusal settles as rejected and carries the reason, and is not a conflict', () => {
    const next = applyAck(ledger(), ack(5, { ok: false, error: 'Health is not editable' }));
    expect(next.get(KEY)).toMatchObject({ outcome: 'rejected', error: 'Health is not editable' });
    expect(deriveConflicts(next)).toEqual([]);
  });

  it('applied but altered by the editor is a real conflict', () => {
    const next = applyAck(ledger(), ack(5, { ok: true, adjusted: true, value: '75.000000' }));
    expect(deriveConflicts(next)).toMatchObject([{ key: KEY, written: 100, inbound: '75.000000' }]);
  });

  it('ignores an ack for a superseded write and returns the same map', () => {
    const l = ledger(9);
    expect(applyAck(l, ack(5, { ok: false, error: 'late' }))).toBe(l);
  });

  it('ignores an ack on a key with no write', () => {
    const l: Ledger = new Map();
    expect(applyAck(l, ack(1, { ok: true }))).toBe(l);
  });

  it('overrides a false divergence from an ExportText read-back that beat the ack', () => {
    const before = observeUpdate(ledger(5, false), { objectPath: PATH, propertyName: PROP, value: '100.000000' }, 6);
    expect(before.get(KEY)?.outcome).toBe('diverged');
    expect(applyAck(before, ack(5, { ok: true, value: '100.000000' })).get(KEY)?.outcome).toBe('confirmed');
  });

  it('keeps a confirmed write settled against the later ExportText read-back', () => {
    const acked = applyAck(ledger(), ack(5, { ok: true, value: '100.000000' }));
    expect(observeUpdate(acked, { objectPath: PATH, propertyName: PROP, value: '100.000000' }, 6)).toBe(acked);
  });
});

describe('panel surfaces of an ack', () => {
  it('logs the refusal reason as a warning', () => {
    const prev = ledger();
    const next = applyAck(prev, ack(5, { ok: false, error: 'No object at /Game/A' }));
    const [event] = diffSyncState(view(prev), view(next));
    expect(event).toMatchObject({ level: 'warn', direction: 'inbound', category: 'ACK' });
    expect(event.message).toContain('No object at /Game/A');
  });

  it('logs a confirmed ack', () => {
    const prev = ledger();
    const [event] = diffSyncState(view(prev), view(applyAck(prev, ack(5, { ok: true, value: '100.000000' }))));
    expect(event.message).toContain('confirmed');
  });

  it('labels a refused write on its row', () => {
    const next = applyAck(ledger(), ack(5, { ok: false, error: 'x' }));
    expect(outcomeFor(next, PATH, PROP)).toBe('refused');
  });
});
