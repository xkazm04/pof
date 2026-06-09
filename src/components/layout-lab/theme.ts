/* eslint-disable no-restricted-syntax -- identity-lab theme: var() tokens + bespoke font classNames */
import type { CSSProperties } from 'react';
import { inter, ibmPlexMono, jetbrainsMono } from './fonts';

/** Lab theme. Color fields are var(--lab-*) refs resolved by [data-theme] (see lab-tokens.css).
 *  JS-read fields (id/label/glass/gridLine/fonts) stay real values. */
export interface LabTheme {
  id: 'light' | 'dark';
  label: string;
  bg: string; gridLine: string | null; panel: string;
  ink: string; inkDeep: string; text: string; muted: string; line: string;
  accentBg: string; glass: boolean;
  fontBody: string; fontMono: string;
  ok: string; warn: string; bad: string; onAccent: string;
}

/** Color fields shared by both themes — identical var() refs; the actual values
 *  come from [data-theme] in lab-tokens.css. */
const VARS = {
  bg: 'var(--lab-bg)', panel: 'var(--lab-panel)',
  ink: 'var(--lab-ink)', inkDeep: 'var(--lab-ink-deep)', text: 'var(--lab-text)',
  muted: 'var(--lab-muted)', line: 'var(--lab-line)', accentBg: 'var(--lab-accent-bg)',
  ok: 'var(--lab-ok)', warn: 'var(--lab-warn)', bad: 'var(--lab-bad)', onAccent: 'var(--lab-on-accent)',
} as const;

export const LIGHT: LabTheme = {
  id: 'light', label: 'Blueprint',
  ...VARS,
  gridLine: '#aebfd6', // real value retained for any non-grid reader; the grid itself is CSS now
  glass: false, fontBody: inter.className, fontMono: ibmPlexMono.className,
};

export const DARK: LabTheme = {
  id: 'dark', label: 'Studio Dark',
  ...VARS,
  gridLine: null,
  glass: true, fontBody: inter.className, fontMono: jetbrainsMono.className,
};

export const LAB_THEMES: LabTheme[] = [LIGHT, DARK];

/** Maps the LabTheme.id ('light'|'dark') to the [data-theme] attribute value. */
export const themeAttr = (id: LabTheme['id']): 'blueprint' | 'studio' => (id === 'light' ? 'blueprint' : 'studio');

/**
 * The lab's canonical glass-panel surface: tokenized `panel` background + a 1px
 * `line` border, plus a backdrop blur in Studio (glass) mode. This is the single
 * source for the Blueprint/Studio panel treatment shared by the timeline, the
 * Acceptance banner, and the step/work panels.
 *
 * `extra` is merged last so callers can add padding / overrides. borderRadius is
 * intentionally NOT defaulted: Blueprint keeps sharp corners and the full-width
 * header bar must never round — callers opt into a radius via
 * `labPanelStyle(t, { borderRadius: t.glass ? 12 : 0 })` where a studio-rounded
 * panel is wanted.
 */
export function labPanelStyle(t: LabTheme, extra?: CSSProperties): CSSProperties {
  return {
    background: t.panel,
    border: `1px solid ${t.line}`,
    ...(t.glass ? { backdropFilter: 'blur(12px)' } : {}),
    ...extra,
  };
}
