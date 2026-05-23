import type { BusEvent } from '@/types/event-bus';

/**
 * Dispatch-reliability metrics derived from the `cli.*` event stream.
 *
 * The SP-A→SP-B remediation fixed a dispatch race + chained-`isRunning`
 * collisions that silently hung 40-minute live runs. The failure was invisible
 * until wall-clock ran out. This panel makes the CLI subsystem's health
 * observable: a dispatch that started but never completed (`inFlight` growing
 * without bound, or `stuck`) is exactly that failure class surfacing early.
 */
export interface DispatchHealthEntry {
  tabId: string;
  sessionLabel: string;
  moduleId?: string;
  startedAt: number;
  completedAt?: number;
  success?: boolean;
}

export interface DispatchHealth {
  /** cli.task.started — dispatches sent. */
  sent: number;
  /** cli.task.completed — dispatches acknowledged (terminal reported a result). */
  acknowledged: number;
  succeeded: number;
  failed: number;
  /** Started without a matching completion yet. */
  inFlight: number;
  /** In-flight longer than the stuck threshold — the SP-B hang signature. */
  stuck: number;
  sessionsCreated: number;
  sessionsRemoved: number;
  activeSessions: number;
  /** Most-recent task entries, newest first (capped). */
  recent: DispatchHealthEntry[];
}

export interface DispatchHealthOptions {
  /** An in-flight dispatch older than this (ms) counts as `stuck`. */
  stuckThresholdMs?: number;
  /** "Now" for stuck computation (injectable for tests). */
  now?: number;
  /** Cap on the `recent` list length. */
  recentLimit?: number;
}

const DEFAULT_STUCK_MS = 15 * 60_000; // 15 min — well past a normal dispatch
const DEFAULT_RECENT_LIMIT = 25;

/**
 * Fold a list of bus events (any order; sorted internally by timestamp) into
 * dispatch-health metrics. Pure — no bus, no DOM — so it is fully unit-tested.
 */
export function computeDispatchHealth(
  events: BusEvent[],
  opts: DispatchHealthOptions = {},
): DispatchHealth {
  const stuckThresholdMs = opts.stuckThresholdMs ?? DEFAULT_STUCK_MS;
  const now = opts.now ?? Date.now();
  const recentLimit = opts.recentLimit ?? DEFAULT_RECENT_LIMIT;

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Track the latest open dispatch per tabId so a re-dispatch on the same tab
  // doesn't double-count as permanently in-flight.
  const byTab = new Map<string, DispatchHealthEntry>();
  const completed: DispatchHealthEntry[] = [];
  let sent = 0;
  let acknowledged = 0;
  let succeeded = 0;
  let failed = 0;
  let sessionsCreated = 0;
  let sessionsRemoved = 0;

  for (const ev of sorted) {
    switch (ev.channel) {
      case 'cli.task.started': {
        const p = ev.payload as BusEvent<'cli.task.started'>['payload'];
        sent += 1;
        byTab.set(p.tabId, {
          tabId: p.tabId,
          sessionLabel: p.sessionLabel,
          moduleId: p.moduleId,
          startedAt: ev.timestamp,
        });
        break;
      }
      case 'cli.task.completed': {
        const p = ev.payload as BusEvent<'cli.task.completed'>['payload'];
        acknowledged += 1;
        if (p.success) succeeded += 1; else failed += 1;
        const open = byTab.get(p.tabId);
        if (open) {
          open.completedAt = ev.timestamp;
          open.success = p.success;
          completed.push(open);
          byTab.delete(p.tabId);
        } else {
          completed.push({
            tabId: p.tabId,
            sessionLabel: p.sessionLabel,
            moduleId: p.moduleId,
            startedAt: ev.timestamp,
            completedAt: ev.timestamp,
            success: p.success,
          });
        }
        break;
      }
      case 'cli.session.created':
        sessionsCreated += 1;
        break;
      case 'cli.session.removed':
        sessionsRemoved += 1;
        break;
      default:
        break;
    }
  }

  const inFlightEntries = [...byTab.values()];
  const stuck = inFlightEntries.filter((e) => now - e.startedAt > stuckThresholdMs).length;

  const recent = [...completed, ...inFlightEntries]
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
    .slice(0, recentLimit);

  return {
    sent,
    acknowledged,
    succeeded,
    failed,
    inFlight: inFlightEntries.length,
    stuck,
    sessionsCreated,
    sessionsRemoved,
    activeSessions: Math.max(0, sessionsCreated - sessionsRemoved),
    recent,
  };
}
