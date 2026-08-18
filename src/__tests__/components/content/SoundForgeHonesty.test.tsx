import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SoundForgePanel } from '@/components/modules/content/audio/SoundForgePanel';
import { AudioUsageMeter } from '@/components/modules/content/audio/AudioUsageMeter';
import type { AudioUsageSummary } from '@/types/audio-asset';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const usage = (over: Partial<AudioUsageSummary> = {}): AudioUsageSummary => ({
  generated: 10, cached: 3, quota: 200, windowStart: 0, totalGenerated: 40, totalCached: 8, ...over,
});

describe('SoundForgePanel — the Kind list cannot promise what the provider will not serve', () => {
  it('offers only the kinds the provider serves as selectable', () => {
    render(<SoundForgePanel />);
    const select = screen.getByLabelText(/^kind$/i, { selector: 'select' }) as HTMLSelectElement;
    const enabled = Array.from(select.options).filter((o) => !o.disabled).map((o) => o.value);
    expect(enabled.sort()).toEqual(['ambient', 'sfx']);
  });

  it('shows the unserved kinds disabled, each with the reason', () => {
    render(<SoundForgePanel />);
    const select = screen.getByLabelText(/^kind$/i, { selector: 'select' }) as HTMLSelectElement;
    const disabled = Array.from(select.options).filter((o) => o.disabled).map((o) => o.value);
    expect(disabled.sort()).toEqual(['music', 'tts']);

    const why = screen.getByTestId('forge-unsupported-kinds');
    expect(why.textContent).toContain('music');
    expect(why.textContent).toContain('tts');
    // A reason, not just a list of names.
    expect(why.textContent!.length).toBeGreaterThan(60);
  });
});

describe('AudioUsageMeter — the budget says what it is', () => {
  it('states that the budget is informational and not enforced', () => {
    render(<AudioUsageMeter usage={usage({ generated: 190, quota: 200 })} />);
    const note = screen.getByTestId('audio-usage-informational');
    expect(note.textContent).toMatch(/informational/i);
    expect(note.textContent).toMatch(/not|never/i);
  });

  it('keeps reporting the real counts alongside the disclaimer', () => {
    render(<AudioUsageMeter usage={usage({ generated: 190, quota: 200 })} />);
    const count = within(screen.getByTestId('audio-usage-meter')).getByTestId('audio-usage-count');
    expect(count.textContent).toContain('190');
    expect(count.textContent).toContain('200');
  });
});
