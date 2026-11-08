import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { StatDashboardSection } from '@/components/modules/core-engine/sub_debug/crashes/StatDashboardSection';
import { projectDebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';
import { SAMPLE_SESSION } from '@/components/modules/core-engine/sub_debug/_shared/sampleSession';

/**
 * scan-sweep night 2026-11-08 (debug-performance, accessibility-checker): the
 * stat groups are disclosure buttons, but none exposed aria-expanded, so a
 * screen reader could not tell an open group from a collapsed one.
 */

afterEach(cleanup);

describe('StatDashboardSection disclosure state', () => {
  it('every group toggle exposes aria-expanded and flips it on click', () => {
    const { stats } = projectDebugSnapshot(SAMPLE_SESSION, null);
    const { container } = render(<StatDashboardSection stats={stats} />);
    const toggles = Array.from(container.querySelectorAll('button'));
    expect(toggles).toHaveLength(stats.length);
    for (const t of toggles) expect(t.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggles[0]);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
  });
});
