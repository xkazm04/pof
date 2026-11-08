import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EventCard } from '@/components/layout/ActivityFeedPanel/EventCard';
import { CollapsedGroup } from '@/components/layout/ActivityFeedPanel/CollapsedGroup';
import type { ActivityEvent } from '@/stores/activityFeedStore';

afterEach(cleanup);

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
