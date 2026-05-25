'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle2, AlertOctagon, Hammer, ListChecks, Star, MessageSquare } from 'lucide-react';
import { useActivityFeedStore, type ActivityEvent } from '@/stores/activityFeedStore';

const MAX_ROWS = 8;

const ICON_BY_TYPE: Record<ActivityEvent['type'], typeof Activity> = {
  'cli-complete': CheckCircle2,
  'cli-error': AlertOctagon,
  'quality-change': Star,
  'build-result': Hammer,
  'evaluator-recommendation': MessageSquare,
  'checklist-progress': ListChecks,
};

function shortRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'now';
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}

/**
 * Mission Control activity feed card. Shows the most recent N events from
 * `activityFeedStore` (capped at 8). Reuses the existing event types
 * (cli-complete, cli-error, quality-change, build-result, etc.) so events
 * emitted by the legacy shell still surface here.
 */
export function ActivityFeedCard() {
  const events = useActivityFeedStore((s) => s.events);

  const rows = useMemo(
    () => [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ROWS),
    [events],
  );

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Activity</h2>
        <span className="ml-auto text-xs text-text-muted">
          {events.length} total
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="text-xs text-text-muted/70 italic">No activity yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((e) => {
            const Icon = ICON_BY_TYPE[e.type] ?? Activity;
            return (
              <li
                key={e.id}
                data-testid="activity-feed-row"
                className="flex items-center gap-2 text-xs"
              >
                <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="flex-1 truncate text-text">{e.title}</span>
                <span className="text-xs text-text-muted/70 shrink-0">
                  {shortRelative(e.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
