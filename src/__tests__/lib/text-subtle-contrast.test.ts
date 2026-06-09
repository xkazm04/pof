/**
 * WCAG AA contract for the `--text-subtle` token.
 *
 * `--text-subtle` is the legible "subtle" tier — dimmer than `--text` / `--text-muted`,
 * but unlike the old `text-text-muted/40–/70` opacity hacks it must still clear the
 * 4.5:1 AA threshold for normal text. The bestiary (and any future caller) routes its
 * de-emphasized micro-text through this token via the shared `MicroLabel` primitive,
 * so the contrast fix lands in exactly one place.
 *
 * The token is theme-aware (globals.css `:root` for the dark app, lab-tokens.css for the
 * Blueprint/Studio lab themes). The hex values below MIRROR those CSS declarations — keep
 * them in lockstep. `TEXT_SUBTLE` (the dark-app value) is imported from chart-colors so the
 * primary tier has a single TS source of truth.
 */
/* eslint-disable no-restricted-syntax -- this test's fixtures are literal theme hex
   values (page backgrounds + the per-theme --text-subtle) mirrored from globals.css /
   lab-tokens.css; the whole point is to assert those exact hexes clear WCAG AA. */
import { describe, it, expect } from 'vitest';
import { contrastRatio, meetsContrastAA, WCAG_AA_TEXT } from '@/lib/contrast';
import { TEXT_SUBTLE } from '@/lib/chart-colors';

/** Each theme's page background + the `--text-subtle` value resolved against it. */
const THEMES = [
  // globals.css :root  — the dark app shell the bestiary actually renders in.
  { name: 'app dark', bg: '#0a0a16', subtle: TEXT_SUBTLE },
  // lab-tokens.css [data-theme="studio"] — Studio Dark.
  { name: 'studio dark', bg: '#0a0e14', subtle: '#7e84a8' },
  // lab-tokens.css [data-theme="blueprint"] — Blueprint (light).
  { name: 'blueprint light', bg: '#dde3ec', subtle: '#525d70' },
] as const;

describe('--text-subtle token meets WCAG AA', () => {
  for (const t of THEMES) {
    it(`${t.name}: ${t.subtle} on ${t.bg} clears 4.5:1`, () => {
      expect(meetsContrastAA(t.subtle, t.bg)).toBe(true);
      expect(contrastRatio(t.subtle, t.bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it('the dark-app subtle tier is dimmer than full --text-muted (a real third tier)', () => {
    // --text-muted (#9aa0c4) sits ~7.6:1; --text-subtle is intentionally lower-emphasis
    // while still AA, so it reads as a distinct, quieter tier — not just a clone.
    expect(contrastRatio(TEXT_SUBTLE, '#0a0a16')).toBeLessThan(contrastRatio('#9aa0c4', '#0a0a16'));
  });
});

describe('the old opacity-muted micro-text it replaces failed AA', () => {
  // Documents the defect: text-text-muted at 40/50/70% alpha on the dark page floor all
  // fall well under 4.5:1 — which is exactly why those call sites move to --text-subtle.
  for (const alpha of [0.4, 0.5, 0.7]) {
    it(`text-text-muted/${alpha * 100} on #0a0a16 was below AA`, () => {
      expect(meetsContrastAA('#9aa0c4', '#0a0a16', 'text', alpha)).toBe(false);
    });
  }
});
