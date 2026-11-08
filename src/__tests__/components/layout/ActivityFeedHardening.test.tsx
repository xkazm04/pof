import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EventCard } from '@/components/layout/ActivityFeedPanel/EventCard';
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
