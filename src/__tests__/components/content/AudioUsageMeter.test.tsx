import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { AudioUsageMeter } from '@/components/modules/content/audio/AudioUsageMeter';
import { WaveformThumbnail } from '@/components/modules/content/audio/WaveformThumbnail';
import type { AudioUsageSummary } from '@/types/audio-asset';

afterEach(cleanup);

const usage = (over: Partial<AudioUsageSummary> = {}): AudioUsageSummary => ({
  generated: 10, cached: 3, quota: 200, windowStart: 0, totalGenerated: 40, totalCached: 8, ...over,
});

describe('AudioUsageMeter', () => {
  it('shows generated/quota and a progressbar', () => {
    render(<AudioUsageMeter usage={usage({ generated: 50, quota: 200 })} />);
    expect(screen.getByTestId('audio-usage-count').textContent).toContain('50');
    expect(screen.getByTestId('audio-usage-count').textContent).toContain('200');
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('25'); // 50/200
  });

  it('reports cache savings with correct pluralization', () => {
    const { rerender } = render(<AudioUsageMeter usage={usage({ cached: 1 })} />);
    expect(screen.getByTestId('audio-usage-saved').textContent).toContain('1 call saved');
    rerender(<AudioUsageMeter usage={usage({ cached: 4 })} />);
    expect(screen.getByTestId('audio-usage-saved').textContent).toContain('4 calls saved');
  });
});

describe('WaveformThumbnail', () => {
  it('renders the requested number of bars deterministically', () => {
    const { container } = render(<WaveformThumbnail seed="abc" color="#fff" bars={20} />);
    expect(within(container).getByLabelText('Audio waveform')).toBeTruthy();
    expect(container.querySelectorAll('rect')).toHaveLength(20);
  });
});
