/**
 * The scan-complete feed entry counts its recommendations in English.
 *
 * RED before the fix: a scan with one recommendation read "1 recommendations."
 * and a clean scan read "0 recommendations." instead of saying there were none.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useActivityFeedBridge } from '@/hooks/useActivityFeedBridge';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { eventBus } from '@/lib/event-bus';

beforeEach(() => { useActivityFeedStore.setState({ events: [] } as never); });
afterEach(cleanup);

function scanText(recommendationCount: number): string {
  useActivityFeedStore.setState({ events: [] } as never);
  act(() => { eventBus.emit('eval.scan.completed', { overallScore: 72, recommendationCount }); });
  const ev = useActivityFeedStore.getState().events.find((e) => e.type === 'quality-change');
  return ev?.description ?? '';
}

describe('useActivityFeedBridge — scan copy', () => {
  it('singular, plural and none', () => {
    renderHook(() => useActivityFeedBridge());
    expect(scanText(1)).toBe('Overall score: 72/100. 1 recommendation.');
    expect(scanText(3)).toBe('Overall score: 72/100. 3 recommendations.');
    expect(scanText(0)).toBe('Overall score: 72/100. No recommendations.');
  });
});
