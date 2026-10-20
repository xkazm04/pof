import type { ActivityEvent } from '@/stores/activityFeedStore';
import type { SubModuleId } from '@/types/modules';
import type { TimePeriod, EventGroup, TimePeriodSection } from './types';

/** Hard cap on retained events. */
export const FEED_CAP = 50;
/** A repeat of the same event inside this window folds into the earlier one. */
export const COALESCE_WINDOW_MS = 60_000;

// ── Unread: the single rule ──

export function countUnread(events: readonly ActivityEvent[]): number {
  let n = 0;
  for (const e of events) if (!e.dismissed) n++;
  return n;
}

// ── Retention ──

/** Eviction rank: lower is evicted first. Dismissed always goes before anything unread. */
function keepRank(e: ActivityEvent): number {
  if (e.dismissed) return 0;
  if (e.type === 'cli-error' || e.type === 'shell-eviction') return 3;
  if (e.type === 'checklist-progress') return 1;
  return 2;
}

/** Trim a newest-first list to `cap`, evicting dismissed, then low-priority, then oldest first. */
export function retain(events: ActivityEvent[], cap: number = FEED_CAP): ActivityEvent[] {
  if (events.length <= cap) return events;
  const drop = new Set<number>();
  // Candidate indices ordered by (rank asc, age desc = higher index first).
  const order = events
    .map((e, i) => ({ i, r: keepRank(e) }))
    .sort((a, b) => a.r - b.r || b.i - a.i);
  for (let k = 0; k < events.length - cap; k++) drop.add(order[k].i);
  return events.filter((_, i) => !drop.has(i));
}

// ── Coalescing ──

type Incoming = Omit<ActivityEvent, 'id' | 'timestamp' | 'dismissed'>;

/**
 * Fold `next` into an undismissed event with the same type+moduleId+title+description
 * seen within the window; the merged event moves to the front with a refreshed timestamp
 * and `meta.count`. Otherwise `next` is prepended as a new event.
 */
export function coalesce(
  events: ActivityEvent[],
  next: Incoming,
  now: number,
  makeId: () => string = () => `evt-${now}-c`,
): ActivityEvent[] {
  const idx = events.findIndex(
    (e) =>
      !e.dismissed &&
      e.type === next.type &&
      e.moduleId === next.moduleId &&
      e.title === next.title &&
      e.description === next.description &&
      now - e.timestamp <= COALESCE_WINDOW_MS,
  );
  if (idx === -1) {
    return [{ ...next, id: makeId(), timestamp: now, dismissed: false }, ...events];
  }
  const prev = events[idx];
  const merged: ActivityEvent = {
    ...prev,
    timestamp: now,
    meta: { ...prev.meta, count: (prev.meta?.count ?? 1) + 1 },
  };
  return [merged, ...events.slice(0, idx), ...events.slice(idx + 1)];
}

// ── Time buckets ──

/** Calendar-day arithmetic (DST-safe). "Earlier this week" is the 5 days before yesterday. */
export function getTimePeriod(ts: number, now: number = Date.now()): TimePeriod {
  const d = new Date(now);
  const day = (offset: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
  if (ts >= day(0)) return 'Today';
  if (ts >= day(1)) return 'Yesterday';
  if (ts >= day(6)) return 'Earlier this week';
  return 'Older';
}

/** Group consecutive events of the same type+module, carrying each group's unread count. */
export function groupConsecutive(events: ActivityEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.type === event.type && last.moduleId === event.moduleId) {
      last.events.push(event);
      if (!event.dismissed) last.unread++;
    } else {
      groups.push({
        type: event.type,
        moduleId: event.moduleId as SubModuleId | undefined,
        events: [event],
        unread: event.dismissed ? 0 : 1,
      });
    }
  }
  return groups;
}

export function buildSections(events: ActivityEvent[], now: number = Date.now()): TimePeriodSection[] {
  const periodOrder: TimePeriod[] = ['Today', 'Yesterday', 'Earlier this week', 'Older'];
  const buckets = new Map<TimePeriod, ActivityEvent[]>();
  for (const p of periodOrder) buckets.set(p, []);
  for (const e of events) buckets.get(getTimePeriod(e.timestamp, now))!.push(e);

  const sections: TimePeriodSection[] = [];
  for (const period of periodOrder) {
    const periodEvents = buckets.get(period)!;
    if (periodEvents.length === 0) continue;
    sections.push({ period, groups: groupConsecutive(periodEvents) });
  }
  return sections;
}
