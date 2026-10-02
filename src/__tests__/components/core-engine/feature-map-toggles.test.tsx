import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, renderHook } from '@testing-library/react';
import FeatureMapTab from '@/components/modules/core-engine/unique-tabs/FeatureMapTab';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';

/**
 * Feature Map toggles only what a gate hides (scan-sweep --challenge core-engine-genre-tabs/A).
 * Disable All writes exactly the gated ids — including attribute-defaults, which no toggle
 * could reach before — and a sub-panel card (Sankey, inside the DPS gate) is a read-only
 * "in DPS" card rather than a toggle that hides nothing.
 */

const KEY = 'pof-feature-vis-arpg-combat';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function storedFalse(): string[] {
  const raw = localStorage.getItem(KEY);
  const vis = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  return Object.entries(vis).filter(([, v]) => v === false).map(([k]) => k).sort();
}

describe('FeatureMapTab — toggles are the gates', () => {
  it('Disable All hides exactly the gated sections; Sankey reads "in DPS" with no toggle', () => {
    render(<FeatureMapTab moduleId="arpg-combat" />);
    fireEvent.click(screen.getByRole('button', { name: 'Disable All' }));
    expect(storedFalse()).toEqual(['attribute-defaults', 'damage-pipeline', 'dps', 'encounter-choreography', 'feedback-tuner', 'lanes', 'traces']);

    fireEvent.click(screen.getByRole('tab', { name: /Metrics/ }));
    const sankey = screen.getByText('Sankey').closest('[data-section-card]') as HTMLElement;
    expect(sankey).toBeTruthy();
    expect(sankey.getAttribute('aria-pressed')).toBeNull();
    expect(sankey.tagName).not.toBe('BUTTON');
    expect(sankey.textContent).toContain('in DPS');
    // The DPS gate itself is still a pressed-state toggle.
    const dps = screen.getByText('DPS').closest('button');
    expect(dps?.getAttribute('aria-pressed')).toBe('false');
  });

  it('a stale stored toggle for a non-gate section neither crashes nor hides it', () => {
    localStorage.setItem(KEY, JSON.stringify({ sankey: false, 'removed-section': false }));
    render(<FeatureMapTab moduleId="arpg-combat" />);
    fireEvent.click(screen.getByRole('tab', { name: /Metrics/ }));
    const sankey = screen.getByText('Sankey').closest('[data-section-card]') as HTMLElement;
    expect(sankey.getAttribute('data-effective-visible')).toBe('true');
  });

  it('[guard] an unset section stays visible by default', () => {
    const { result } = renderHook(() => useFeatureVisibility('arpg-combat'));
    expect(result.current.isVisible('never-set')).toBe(true);
  });
});
