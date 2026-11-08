import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GCTimelineSection } from '@/components/modules/core-engine/sub_debug/performance/GCTimelineSection';
import { projectDebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';
import { SAMPLE_SESSION } from '@/components/modules/core-engine/sub_debug/_shared/sampleSession';

/**
 * scan-sweep night 2026-11-08 (debug-performance, visual-craft): GC bars were
 * placed at left = timeS / maxTime * 100%, so the LATEST pause (timeS == maxTime)
 * sat at left:100% and its 6px bar was entirely outside the overflow-hidden
 * track - the newest GC pause was never drawn.
 */

afterEach(cleanup);

const BAR_W = 6;

function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[title^="GC @"]'));
}

describe('GCTimelineSection bar placement', () => {
  it('no bar starts at the right edge: every bar keeps its full width inside the track', () => {
    const { gc } = projectDebugSnapshot(SAMPLE_SESSION, null);
    const { container } = render(<GCTimelineSection gc={gc} />);
    const all = bars(container);
    expect(all).toHaveLength(gc.events.length);
    for (const bar of all) expect(bar.style.left).not.toBe('100%');
    // The newest pause ends flush with the right edge instead of past it.
    expect(all[all.length - 1].style.left).toBe(`calc(100% - ${BAR_W}px)`);
  });

  it('control: the first pause keeps its proportional position', () => {
    const { gc } = projectDebugSnapshot(SAMPLE_SESSION, null);
    const { container } = render(<GCTimelineSection gc={gc} />);
    const first = bars(container)[0];
    expect(first.style.left).toMatch(/^calc\(2\.\d+% - 0\.\d+px\)$/);
  });
});
