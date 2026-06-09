import { describe, it, expect } from 'vitest';
import {
  STATUS_TOKENS,
  STATUS_RAMP,
  budgetStatusToken,
  recoveryStatusToken,
  scoreStatusToken,
  type StatusLevel,
} from '@/lib/status-token';
import {
  STATUS_SUCCESS,
  STATUS_WARNING,
  STATUS_ERROR,
  statusBg,
  statusBorder,
} from '@/lib/chart-colors';

// These tests guard the colorblind-safe contract: every status level must carry
// a non-color cue (a distinct glyph AND a distinct shape) so meaning never rests
// on hue alone (WCAG 1.4.1), and all consumers read the same token.
describe('STATUS_TOKENS', () => {
  it('maps the three ramp levels to the shared status hues', () => {
    expect(STATUS_TOKENS.ok.color).toBe(STATUS_SUCCESS);
    expect(STATUS_TOKENS.warn.color).toBe(STATUS_WARNING);
    expect(STATUS_TOKENS.bad.color).toBe(STATUS_ERROR);
  });

  it('derives bg/border from the color via the shared helpers', () => {
    for (const token of Object.values(STATUS_TOKENS)) {
      expect(token.bg).toBe(statusBg(token.color));
      expect(token.border).toBe(statusBorder(token.color));
    }
  });

  it('pairs each level with a DISTINCT glyph — the icon is a non-color cue', () => {
    const icons = new Set(Object.values(STATUS_TOKENS).map(t => t.Icon));
    expect(icons.size).toBe(3);
  });

  it('pairs each level with a DISTINCT stroke + border shape', () => {
    const dashes = Object.values(STATUS_TOKENS).map(t => t.dash);
    expect(new Set(dashes).size).toBe(3);
    expect(STATUS_TOKENS.ok.dash).toBe('');          // solid
    expect(STATUS_TOKENS.warn.borderStyle).toBe('dashed');
    expect(STATUS_TOKENS.bad.borderStyle).toBe('dotted');
  });

  it('gives warn/bad a fill hatch pattern and leaves ok solid', () => {
    expect(STATUS_TOKENS.ok.pattern).toBe('');
    expect(STATUS_TOKENS.warn.pattern).toContain('repeating-linear-gradient');
    expect(STATUS_TOKENS.bad.pattern).toContain('repeating-linear-gradient');
    expect(STATUS_TOKENS.warn.pattern).not.toBe(STATUS_TOKENS.bad.pattern);
  });

  it('keeps the default OVER/WARN/OK words and an accessible label per level', () => {
    expect(STATUS_TOKENS.ok.word).toBe('OK');
    expect(STATUS_TOKENS.warn.word).toBe('WARN');
    expect(STATUS_TOKENS.bad.word).toBe('OVER');
    for (const token of Object.values(STATUS_TOKENS)) {
      expect(token.label.length).toBeGreaterThan(0);
    }
  });

  it('exposes the ramp ordered best → worst', () => {
    expect(STATUS_RAMP.map(t => t.level)).toEqual<StatusLevel[]>(['ok', 'warn', 'bad']);
  });
});

describe('status token mappers', () => {
  it('maps getBudgetStatus output to the ramp', () => {
    expect(budgetStatusToken('ok')).toBe(STATUS_TOKENS.ok);
    expect(budgetStatusToken('amber')).toBe(STATUS_TOKENS.warn);
    expect(budgetStatusToken('red')).toBe(STATUS_TOKENS.bad);
  });

  it('maps recovery-result status to the ramp', () => {
    expect(recoveryStatusToken('recovered')).toBe(STATUS_TOKENS.ok);
    expect(recoveryStatusToken('partial')).toBe(STATUS_TOKENS.warn);
    expect(recoveryStatusToken('lost')).toBe(STATUS_TOKENS.bad);
  });

  it('bands a 0-100 score: >=80 ok, >=50 warn, else bad', () => {
    expect(scoreStatusToken(100)).toBe(STATUS_TOKENS.ok);
    expect(scoreStatusToken(80)).toBe(STATUS_TOKENS.ok);
    expect(scoreStatusToken(79)).toBe(STATUS_TOKENS.warn);
    expect(scoreStatusToken(50)).toBe(STATUS_TOKENS.warn);
    expect(scoreStatusToken(49)).toBe(STATUS_TOKENS.bad);
    expect(scoreStatusToken(0)).toBe(STATUS_TOKENS.bad);
  });
});
