import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AccessibilityTab, expansionBar } from '@/components/modules/core-engine/sub_ui/accessibility/AccessibilityTab';
import { LANGUAGES } from '@/components/modules/core-engine/sub_ui/_shared/data';

/**
 * scan-sweep night 2026-11-08 game-ui-hud: the localization expansion bar must
 * tell 125% from 135%. Its track was 0-100%, so every over-budget language
 * filled it completely and the 100% limit marker sat on the clipped edge.
 */
describe('Localization expansion bar', () => {
  afterEach(cleanup);

  it('gives every language a distinct fill, all inside the track', () => {
    const fills = LANGUAGES.map((l) => expansionBar(l.expansion).fillPct);
    expect(new Set(fills).size).toBe(LANGUAGES.length);
    for (const f of fills) expect(f).toBeLessThanOrEqual(100);
  });

  it('puts the 100% limit marker inside the track, not on its clipped edge', () => {
    render(<AccessibilityTab />);
    const marker = screen.getByTestId('expansion-limit');
    const left = parseFloat(marker.style.left);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(100);
    expect(left).toBeCloseTo(expansionBar(100).fillPct, 5);
  });
});
