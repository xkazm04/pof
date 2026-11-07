import { describe, it, expect } from 'vitest';
import { useActivityFeedStore, type ActivityEvent } from '@/stores/activityFeedStore';
import { retain } from '@/components/layout/ActivityFeedPanel/feedModel';

/**
 * The persisted copy of the feed must follow the same eviction rule as the live
 * one (`retain`: dismissed first, then low-priority, then oldest). It used to be a
 * plain `slice(0, 30)`, so an unread error older than the 30th event survived in
 * memory and vanished on reload.
 */

function ev(i: number, over: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: `e${i}`, type: 'checklist-progress', timestamp: 1000 - i, title: `t${i}`,
    description: '', dismissed: true, ...over,
  };
}

describe('activity feed persistence', () => {
  const partialize = useActivityFeedStore.persist.getOptions().partialize!;

  it('keeps an unread error that sits past the 30th event', () => {
    const events = Array.from({ length: 40 }, (_, i) => ev(i));
    events[39] = ev(39, { type: 'cli-error', dismissed: false, title: 'build failed' });
    const persisted = partialize({ ...useActivityFeedStore.getState(), events }) as { events: ActivityEvent[] };
    expect(persisted.events).toHaveLength(30);
    expect(persisted.events.some((e) => e.id === 'e39')).toBe(true);
  });

  it('persists exactly what retain(events, 30) keeps, in order', () => {
    const events = Array.from({ length: 45 }, (_, i) =>
      ev(i, { dismissed: i % 3 === 0, type: i % 5 === 0 ? 'cli-error' : 'cli-complete' }));
    const persisted = partialize({ ...useActivityFeedStore.getState(), events }) as { events: ActivityEvent[] };
    expect(persisted.events.map((e) => e.id)).toEqual(retain(events, 30).map((e) => e.id));
  });
});
