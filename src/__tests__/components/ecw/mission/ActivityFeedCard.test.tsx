import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ActivityFeedCard } from '@/components/ecw/mission/ActivityFeedCard';
import { useActivityFeedStore, type ActivityEvent } from '@/stores/activityFeedStore';

function mkEvent(id: string, title: string, type: ActivityEvent['type'], offsetMs = 0): ActivityEvent {
  return { id, title, type, description: '', timestamp: Date.now() - offsetMs, dismissed: false };
}

describe('ActivityFeedCard', () => {
  beforeEach(() => {
    useActivityFeedStore.setState({ events: [], isOpen: false });
  });
  afterEach(cleanup);

  it('renders the card title', () => {
    render(<ActivityFeedCard />);
    expect(screen.getByRole('heading', { level: 2, name: /^Activity$/ })).toBeTruthy();
  });

  it('shows empty state with no events', () => {
    render(<ActivityFeedCard />);
    expect(screen.getByText(/No activity yet/i)).toBeTruthy();
  });

  it('renders the most recent events', () => {
    useActivityFeedStore.setState({
      events: [
        mkEvent('1', 'Build succeeded', 'build-result', 1000),
        mkEvent('2', 'Fireball verified', 'cli-complete', 5000),
      ],
      isOpen: false,
    });
    render(<ActivityFeedCard />);
    expect(screen.getByText(/Build succeeded/)).toBeTruthy();
    expect(screen.getByText(/Fireball verified/)).toBeTruthy();
  });

  it('caps display at 8 events', () => {
    const events = Array.from({ length: 15 }, (_, i) => mkEvent(String(i), `Event ${i}`, 'cli-complete', i * 1000));
    useActivityFeedStore.setState({ events, isOpen: false });
    render(<ActivityFeedCard />);
    const rendered = screen.getAllByTestId('activity-feed-row');
    expect(rendered.length).toBe(8);
  });
});
