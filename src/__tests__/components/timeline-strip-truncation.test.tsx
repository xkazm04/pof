import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TimelineStrip } from '@/components/modules/core-engine/unique-tabs/_shared/dataviz';

afterEach(cleanup);

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `e${i}`, timestamp: i, label: `E${i}`, category: 'c', color: 'red',
}));

describe('TimelineStrip says when it hides events', () => {
  it('60 events with maxVisible 50 renders "+10 more"', () => {
    const { container } = render(<TimelineStrip events={mk(60)} accent="red" />);
    expect(container.textContent).toContain('+10 more');
  });

  it('events within maxVisible render no marker', () => {
    const { container } = render(<TimelineStrip events={mk(50)} accent="red" />);
    expect(container.textContent).not.toContain('more');
  });
});
