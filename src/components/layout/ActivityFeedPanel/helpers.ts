import type { ActivityEvent } from '@/stores/activityFeedStore';
import type { SubModuleId } from '@/types/modules';
import { STATUS_ERROR, STATUS_WARNING, STATUS_BLOCKER } from '@/lib/chart-colors';
import type { TimePeriod, EventGroup, TimePeriodSection } from './types';

export function getTimePeriod(ts: number): TimePeriod {
  const now = new Date();
  const date = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - (now.getDay() * 86_400_000);

  if (ts >= todayStart) return 'Today';
  if (ts >= yesterdayStart) return 'Yesterday';
  if (ts >= weekStart) return 'Earlier this week';
  return 'Older';
}

/** Group consecutive events of the same type+module within a time period */
export function groupConsecutive(events: ActivityEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.type === event.type && last.moduleId === event.moduleId) {
      last.events.push(event);
    } else {
      groups.push({ type: event.type, moduleId: event.moduleId as SubModuleId | undefined, events: [event] });
    }
  }
  return groups;
}

export function buildSections(events: ActivityEvent[]): TimePeriodSection[] {
  const periodOrder: TimePeriod[] = ['Today', 'Yesterday', 'Earlier this week', 'Older'];
  const buckets = new Map<TimePeriod, ActivityEvent[]>();
  for (const p of periodOrder) buckets.set(p, []);
  for (const e of events) {
    buckets.get(getTimePeriod(e.timestamp))!.push(e);
  }

  const sections: TimePeriodSection[] = [];
  for (const period of periodOrder) {
    const periodEvents = buckets.get(period)!;
    if (periodEvents.length === 0) continue;
    sections.push({ period, groups: groupConsecutive(periodEvents) });
  }
  return sections;
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return STATUS_ERROR;
    case 'high': return STATUS_BLOCKER;
    case 'medium': return STATUS_WARNING;
    default: return 'var(--text-muted)';
  }
}
