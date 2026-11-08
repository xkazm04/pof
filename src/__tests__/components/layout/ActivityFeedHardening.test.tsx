import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { EventCard } from '@/components/layout/ActivityFeedPanel/EventCard';
import { CollapsedGroup } from '@/components/layout/ActivityFeedPanel/CollapsedGroup';
import { ActivityFeedPanel } from '@/components/layout/ActivityFeedPanel';
import { useActivityFeedStore, type ActivityEvent } from '@/stores/activityFeedStore';

afterEach(cleanup);

vi.mock('@/hooks/useViewportWidth', () => ({ useViewportWidth: () => 1440, useViewportAtLeast: () => true, WIDE_FALLBACK_WIDTH: 1440 }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

// jsdom has no ResizeObserver; TruncateWithTooltip uses one.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const event = (over: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id: 'e1', type: 'cli-error', timestamp: Date.now(), title: 'Build broke', description: 'd', dismissed: false, ...over,
});
const noop = vi.fn();

describe('EventCard repeat count', () => {
  it('shows how many repeats were folded into the event', () => {
    render(<EventCard event={event({ meta: { count: 3 } })} onDismiss={noop} onAct={noop} />);
    expect(screen.getByLabelText('Repeated 3 times').textContent).toBe('×3');
  });

  it('shows nothing for a single occurrence', () => {
    render(<EventCard event={event()} onDismiss={noop} onAct={noop} />);
    expect(screen.queryByLabelText(/Repeated/)).toBeNull();
  });
});

describe('CollapsedGroup', () => {
  const group = (unread: number) => ({
    type: 'cli-error' as const,
    moduleId: undefined,
    events: [event({ id: 'a' }), event({ id: 'b', dismissed: unread < 2 })],
    unread,
  });

  it('names the unread events hidden inside the collapsed row', () => {
    render(<CollapsedGroup group={group(1)} onDismiss={noop} onAct={noop} />);
    expect(screen.getByText('1 unread')).toBeTruthy();
  });

  it('shows no unread chip when the whole group is read', () => {
    render(<CollapsedGroup group={group(0)} onDismiss={noop} onAct={noop} />);
    expect(screen.queryByText(/unread/)).toBeNull();
  });

  it('exposes its expanded state to assistive tech', () => {
    render(<CollapsedGroup group={group(1)} onDismiss={noop} onAct={noop} />);
    const toggle = screen.getByRole('button', { name: /task failed events/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('ActivityFeedPanel clock', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('re-buckets an open feed when the day rolls over', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 23, 59, 30));
    useActivityFeedStore.setState({ events: [event({ timestamp: Date.now() })], isOpen: true });
    render(<ActivityFeedPanel />);
    expect(screen.getByText('Today')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('runs no refresh timer while the feed is closed', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    useActivityFeedStore.setState({ events: [], isOpen: false });
    render(<ActivityFeedPanel />);
    expect(spy.mock.calls.filter(([, ms]) => ms === 60_000)).toHaveLength(0);
  });
});
