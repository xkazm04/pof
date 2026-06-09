import { describe, it, expect } from 'vitest';
import { SEVERITY_TOKENS, SEVERITY_ORDER, SEVERITY_DESCRIPTIONS } from '@/lib/game-director-styles';

// Phase 2 — fix color-only severity encoding (WCAG 1.4.1).
describe('game-director severity tokens are not color-only', () => {
  it('every severity has a DISTINCT icon — medium and low no longer share Info', () => {
    const icons = SEVERITY_ORDER.map((s) => SEVERITY_TOKENS[s].icon);
    expect(new Set(icons).size).toBe(SEVERITY_ORDER.length);
    // The specific regression this guards: medium/low only differed by hue.
    expect(SEVERITY_TOKENS.low.icon).not.toBe(SEVERITY_TOKENS.medium.icon);
  });

  it('order + plain-language descriptions cover all five severities', () => {
    expect(SEVERITY_ORDER).toEqual(['critical', 'high', 'medium', 'low', 'positive']);
    for (const sev of SEVERITY_ORDER) {
      expect(SEVERITY_DESCRIPTIONS[sev]).toBeTruthy();
      expect(SEVERITY_TOKENS[sev].label).toBeTruthy();
    }
  });
});
