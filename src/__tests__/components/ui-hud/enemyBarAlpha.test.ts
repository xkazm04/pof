import { describe, it, expect } from 'vitest';
import { enemyBarAlpha } from '@/components/modules/content/ui-hud/HudThemeEditor/helpers';
import { DEFAULT_THEME } from '@/components/modules/content/ui-hud/HudThemeEditor/constants';

const grid = (delay: number) => {
  const theme = { ...DEFAULT_THEME, fadeOutDelay: delay };
  return Array.from({ length: 80 }, (_, i) => enemyBarAlpha(i * 0.1, theme));
};

describe('enemyBarAlpha (UE fade FSM over the scripted hits)', () => {
  it('FadeOutDelay changes the preview frames', () => {
    const a = grid(0.5);
    const b = grid(3.0);
    expect(a.some((v, i) => Math.abs(v - b[i]) > 1e-6)).toBe(true);
  });

  it('delay 0.5 fades between the 0.7s-spaced hits; delay 10 stays visible until death', () => {
    const short = { ...DEFAULT_THEME, fadeInDuration: 0.1, fadeOutDuration: 0.2, fadeOutDelay: 0.5 };
    const long = { ...short, fadeOutDelay: 10 };
    // 1.6s: last hit 1.2, delay 0.5 elapsed at 1.7 -> still fully visible; at 1.9 fading
    expect(enemyBarAlpha(1.6, short)).toBeCloseTo(1, 5);
    expect(enemyBarAlpha(1.8, short)).toBeLessThan(0.9);
    expect(enemyBarAlpha(1.8, long)).toBeCloseTo(1, 5);
  });

  it('hand-stepped points: hidden before first hit, fully in after fadeIn, out after death', () => {
    const t = { ...DEFAULT_THEME, fadeInDuration: 0.5, fadeOutDuration: 1.0, fadeOutDelay: 10 };
    expect(enemyBarAlpha(0.3, t)).toBe(0);
    expect(enemyBarAlpha(1.1, t)).toBeCloseTo(1, 5);
    expect(enemyBarAlpha(6.5, t)).toBeCloseTo(0.5, 1);
    expect(enemyBarAlpha(7.5, t)).toBe(0);
  });
});
