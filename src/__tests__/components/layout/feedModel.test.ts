import { describe, it, expect, beforeEach } from 'vitest';
import {
  countUnread,
  retain,
  coalesce,
  getTimePeriod,
  buildSections,
  FEED_CAP,
} from '@/components/layout/ActivityFeedPanel/feedModel';
import { useActivityFeedStore, type ActivityEvent, type ActivityEventType } from '@/stores/activityFeedStore';

let n = 0;
function ev(over: Partial<ActivityEvent> & { type?: ActivityEventType } = {}): ActivityEvent {
  n++;
  return {
    id: `e${n}`,
    type: 'checklist-progress',
    timestamp: 1_000_000 - n,
    title: `t${n}`,
    description: 'd',
    dismissed: false,
    ...over,
  };
}

describe('retain', () => {
  it('never drops an undismissed cli-error/shell-eviction before dismissed or checklist events', () => {
    const critical = [ev({ type: 'cli-error' }), ev({ type: 'shell-eviction' })];
    // newest first: 60 undismissed checklist events pushed after, critical ones are the OLDEST
    const noise = Array.from({ length: 60 }, () => ev({ type: 'checklist-progress' }));
    const out = retain([...noise, ...critical], FEED_CAP);
    expect(out).toHaveLength(50);
    for (const c of critical) expect(out).toContain(c);
  });

  it('evicts dismissed events before undismissed ones of any type', () => {
    const dismissed = ev({ type: 'cli-error', dismissed: true });
    const unread = Array.from({ length: 50 }, () => ev({ type: 'cli-complete' }));
    const out = retain([...unread, dismissed], FEED_CAP);
    expect(out).not.toContain(dismissed);
    expect(out).toHaveLength(50);
  });

  it('50 dismissed + 1 new evicts the oldest dismissed and keeps the newest first', () => {
    const old = Array.from({ length: 50 }, () => ev({ dismissed: true }));
    const fresh = ev({ type: 'cli-error' });
    const out = retain([fresh, ...old], FEED_CAP);
    expect(out).toHaveLength(50);
    expect(out[0]).toBe(fresh);
    expect(out).not.toContain(old[49]);
    expect(out).toContain(old[48]);
  });

  it('returns the input untouched under the cap', () => {
    const list = [ev(), ev()];
    expect(retain(list, FEED_CAP)).toBe(list);
  });
});

describe('coalesce', () => {
  const base = { type: 'cli-error' as const, moduleId: 'm1', title: 'CLI Task', description: 'boom' };
  const now = 5_000_000;

  it('merges a repeat within 60s into one event with count 2 and refreshed timestamp', () => {
    const prev = ev({ ...base, timestamp: now - 30_000 });
    const out = coalesce([prev], { ...base }, now);
    expect(out).toHaveLength(1);
    expect(out[0].meta?.count).toBe(2);
    expect(out[0].timestamp).toBe(now);
    expect(countUnread(out)).toBe(1);
  });

  it('does not merge across a different moduleId', () => {
    const prev = ev({ ...base, timestamp: now - 1000 });
    expect(coalesce([prev], { ...base, moduleId: 'm2' }, now)).toHaveLength(2);
  });

  it('does not merge distinct failures sharing a title (description is in the key)', () => {
    const prev = ev({ ...base, timestamp: now - 1000 });
    expect(coalesce([prev], { ...base, description: 'other' }, now)).toHaveLength(2);
  });

  it('does not merge outside the window or into a dismissed event', () => {
    const old = ev({ ...base, timestamp: now - 61_000 });
    expect(coalesce([old], { ...base }, now)).toHaveLength(2);
    const gone = ev({ ...base, timestamp: now - 1000, dismissed: true });
    expect(coalesce([gone], { ...base }, now)).toHaveLength(2);
  });

  it('moves the merged event to the front', () => {
    const other = ev({ type: 'build-result', timestamp: now - 500 });
    const prev = ev({ ...base, timestamp: now - 1000 });
    const out = coalesce([other, prev], { ...base }, now);
    expect(out[0].type).toBe('cli-error');
    expect(out).toHaveLength(2);
  });
});

describe('store addEvent', () => {
  beforeEach(() => useActivityFeedStore.setState({ events: [], isOpen: false }));

  it('coalesces repeats and keeps unread failures through a checklist burst', () => {
    const { addEvent } = useActivityFeedStore.getState();
    addEvent({ type: 'cli-error', title: 'CLI Task', description: 'x', moduleId: 'm' });
    addEvent({ type: 'cli-error', title: 'CLI Task', description: 'x', moduleId: 'm' });
    expect(useActivityFeedStore.getState().events).toHaveLength(1);
    for (let i = 0; i < 70; i++) addEvent({ type: 'checklist-progress', title: `c${i}`, description: '' });
    const events = useActivityFeedStore.getState().events;
    expect(events).toHaveLength(50);
    expect(events.some((e) => e.type === 'cli-error' && e.meta?.count === 2)).toBe(true);
  });
});

describe('countUnread', () => {
  it('counts undismissed events', () => {
    const list = [ev(), ev(), ev({ dismissed: true }), ev()];
    expect(countUnread(list)).toBe(3);
  });
});

describe('getTimePeriod (injected clock)', () => {
  // Monday 19 Oct 2026, 10:00 local
  const monday = new Date(2026, 9, 19, 10, 0).getTime();
  it('Sunday 23:00 is Yesterday on a Monday', () => {
    expect(getTimePeriod(new Date(2026, 9, 18, 23, 0).getTime(), monday)).toBe('Yesterday');
  });
  it('Saturday 12:00 the same week is Earlier this week', () => {
    expect(getTimePeriod(new Date(2026, 9, 17, 12, 0).getTime(), monday)).toBe('Earlier this week');
  });
  it('the previous Monday is Older', () => {
    expect(getTimePeriod(new Date(2026, 9, 12, 12, 0).getTime(), monday)).toBe('Older');
  });
  it('today is Today', () => {
    expect(getTimePeriod(new Date(2026, 9, 19, 0, 0).getTime(), monday)).toBe('Today');
  });
});

describe('buildSections', () => {
  it('reports per-group unread count', () => {
    const now = new Date(2026, 9, 19, 10, 0).getTime();
    const mk = (dismissed: boolean) =>
      ev({ type: 'cli-error', moduleId: 'm', timestamp: now - 1000, dismissed });
    const sections = buildSections([mk(false), mk(true), mk(false)], now);
    expect(sections).toHaveLength(1);
    expect(sections[0].groups[0].events).toHaveLength(3);
    expect(sections[0].groups[0].unread).toBe(2);
  });
});
