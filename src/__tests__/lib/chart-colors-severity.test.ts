import { describe, it, expect } from 'vitest';
import {
  SEVERITY_TOKENS,
  scoreBandToken,
  severityAccentCard,
  CONFIDENCE_TOKENS,
  STATUS_ERROR,
  STATUS_BLOCKER,
  STATUS_WARNING,
  STATUS_INFO,
  STATUS_SUCCESS,
  ACCENT_EMERALD,
  ACCENT_VIOLET,
  OPACITY_8,
  OPACITY_20,
} from '@/lib/chart-colors';

// These tests guard the "single source of truth" contract: a given severity
// must render with the same color in Deep Eval, GDD Compliance, and the
// Codebase Archeologist — they all read from SEVERITY_TOKENS.
describe('SEVERITY_TOKENS', () => {
  it('maps the four canonical finding levels to the shared status hues', () => {
    expect(SEVERITY_TOKENS.critical.color).toBe(STATUS_ERROR);
    expect(SEVERITY_TOKENS.high.color).toBe(STATUS_BLOCKER);
    expect(SEVERITY_TOKENS.medium.color).toBe(STATUS_WARNING);
    expect(SEVERITY_TOKENS.low.color).toBe(STATUS_INFO);
  });

  it('derives bg at 8% and border at 20% opacity for every token', () => {
    for (const token of Object.values(SEVERITY_TOKENS)) {
      expect(token.bg).toBe(`${token.color}${OPACITY_8}`);
      expect(token.border).toBe(`${token.color}${OPACITY_20}`);
    }
  });

  it('keeps domain aliases visually identical to their canonical band', () => {
    // archeologist / insight vocabulary
    expect(SEVERITY_TOKENS.warning.color).toBe(SEVERITY_TOKENS.medium.color);
    expect(SEVERITY_TOKENS.info.color).toBe(SEVERITY_TOKENS.low.color);
    // GDD gap vocabulary
    expect(SEVERITY_TOKENS.major.color).toBe(SEVERITY_TOKENS.high.color);
    expect(SEVERITY_TOKENS.minor.color).toBe(SEVERITY_TOKENS.low.color);
    // positive findings
    expect(SEVERITY_TOKENS.positive.color).toBe(STATUS_SUCCESS);
  });
});

// The Pattern Library confidence chips read from CONFIDENCE_TOKENS so `proven`
// matches the verified emerald badge and `experimental` harmonizes with the
// systems-violet accent — guards against the old near-miss green / purple drift.
describe('CONFIDENCE_TOKENS', () => {
  it('maps each confidence level to its shared evaluator hue', () => {
    expect(CONFIDENCE_TOKENS.proven.color).toBe(ACCENT_EMERALD);
    expect(CONFIDENCE_TOKENS.promising.color).toBe(STATUS_WARNING);
    expect(CONFIDENCE_TOKENS.experimental.color).toBe(ACCENT_VIOLET);
  });

  it('derives bg at 8% and border at 20% opacity for every token', () => {
    for (const token of Object.values(CONFIDENCE_TOKENS)) {
      expect(token.bg).toBe(`${token.color}${OPACITY_8}`);
      expect(token.border).toBe(`${token.color}${OPACITY_20}`);
    }
  });

  it('carries a human-readable chip label per level', () => {
    expect(CONFIDENCE_TOKENS.proven.label).toBe('Proven');
    expect(CONFIDENCE_TOKENS.promising.label).toBe('Promising');
    expect(CONFIDENCE_TOKENS.experimental.label).toBe('Experimental');
  });
});

// The calm-card treatment: severity is shown with a slim left accent rule in the
// token color, NOT a full translucent fill — so Deep Eval / GDD / Archeologist
// rows read as a calm column instead of a wall of saturated red.
describe('severityAccentCard', () => {
  it('paints only a left accent rule in the solid token color', () => {
    const style = severityAccentCard(SEVERITY_TOKENS.critical);
    expect(style.borderLeftColor).toBe(SEVERITY_TOKENS.critical.color);
    expect(style).toEqual({ borderLeftColor: SEVERITY_TOKENS.critical.color });
  });

  it('never returns a background fill — restraint is the point', () => {
    expect('backgroundColor' in severityAccentCard(SEVERITY_TOKENS.high)).toBe(false);
  });

  it('uses the same solid color as the icon/badge for every severity', () => {
    for (const token of Object.values(SEVERITY_TOKENS)) {
      expect(severityAccentCard(token)).toEqual({ borderLeftColor: token.color });
    }
  });
});

describe('scoreBandToken', () => {
  it('maps a 0-100 score to a severity band (green → red as score drops)', () => {
    expect(scoreBandToken(100)).toBe(SEVERITY_TOKENS.positive);
    expect(scoreBandToken(80)).toBe(SEVERITY_TOKENS.positive);
    expect(scoreBandToken(79)).toBe(SEVERITY_TOKENS.medium);
    expect(scoreBandToken(60)).toBe(SEVERITY_TOKENS.medium);
    expect(scoreBandToken(59)).toBe(SEVERITY_TOKENS.high);
    expect(scoreBandToken(40)).toBe(SEVERITY_TOKENS.high);
    expect(scoreBandToken(39)).toBe(SEVERITY_TOKENS.critical);
    expect(scoreBandToken(0)).toBe(SEVERITY_TOKENS.critical);
  });
});
