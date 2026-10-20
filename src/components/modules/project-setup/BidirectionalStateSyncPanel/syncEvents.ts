/**
 * Pure derivation of panel log events and traffic totals from client state.
 *
 * The WS client state changes; `diffSyncState(prev, next)` says what the user
 * should see happened (new snapshot, new watch, a write's read-back outcome).
 * `tallyEvents` keeps the traffic counters as their own totals, so the bounded,
 * clearable display log never decides what the header reports.
 */

import { truncate, nextLogId } from './helpers';
import type { Ledger } from '@/lib/ue5-bridge/sync-ledger';
import type { SyncLogEntry } from './types';

/** The slice of `LiveEditorState` the diff reads - plain data, no client import. */
export interface SyncView {
  snapshot: { timestamp: number; editorState: string; openLevel: string } | null;
  propertyWatches: ReadonlyMap<string, { objectPath: string; propertyName: string; value: unknown }>;
  writes: Ledger;
}

export interface SyncTotals {
  outboundTotal: number;
  inboundTotal: number;
  /** Outbound frames that never left (socket not OPEN). */
  droppedTotal: number;
}

export const EMPTY_TOTALS: SyncTotals = { outboundTotal: 0, inboundTotal: 0, droppedTotal: 0 };

function inbound(level: SyncLogEntry['level'], category: string, message: string, detail?: string): SyncLogEntry {
  return { id: nextLogId(), ts: Date.now(), direction: 'inbound', level, category, message, detail };
}

function show(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text;
}

/** Events that took the client from `prev` to `next` (none for the first frame). */
export function diffSyncState(prev: SyncView, next: SyncView): SyncLogEntry[] {
  const events: SyncLogEntry[] = [];

  if (prev.snapshot && next.snapshot && next.snapshot.timestamp !== prev.snapshot.timestamp) {
    events.push(inbound('info', 'SNAP', `Editor: ${next.snapshot.editorState}`, `Level: ${next.snapshot.openLevel}`));
  }

  const added = [...next.propertyWatches.keys()].filter((id) => !prev.propertyWatches.has(id)).sort();
  for (const id of added) {
    const w = next.propertyWatches.get(id)!;
    events.push(inbound('info', 'PROP', `${w.propertyName} = ${truncate(show(w.value), 30)}`, w.objectPath));
  }

  for (const [key, now] of next.writes) {
    const was = prev.writes.get(key);
    if (!was || was.seq !== now.seq || was.outcome === now.outcome) continue;
    if (was.outcome !== 'unobserved' && was.outcome !== 'pending') continue;
    if (now.outcome === 'confirmed') {
      events.push(inbound('info', 'ACK', `${now.propertyName} = ${truncate(show(now.written), 30)} confirmed`, now.objectPath));
    } else if (now.outcome === 'diverged') {
      events.push(inbound(
        'conflict', 'SYNC',
        `${now.propertyName} diverged: base ${truncate(now.baseKnown ? show(now.base) : 'unknown', 20)}, `
          + `written ${truncate(show(now.written), 20)}, inbound ${truncate(show(now.inbound), 20)}`,
        now.objectPath,
      ));
    }
  }

  return events;
}

/** Fold events into the totals. A dropped outbound is not a send. */
export function tallyEvents(totals: SyncTotals, events: readonly SyncLogEntry[]): SyncTotals {
  let { outboundTotal, inboundTotal, droppedTotal } = totals;
  for (const e of events) {
    if (e.direction === 'inbound') inboundTotal++;
    else if (e.dropped) droppedTotal++;
    else outboundTotal++;
  }
  return { outboundTotal, inboundTotal, droppedTotal };
}
