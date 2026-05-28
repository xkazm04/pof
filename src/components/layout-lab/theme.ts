/* eslint-disable no-restricted-syntax -- identity-lab theme: var() tokens + bespoke font classNames */
import { inter, ibmPlexMono, jetbrainsMono } from './fonts';

export type LabDensity = 'comfortable' | 'compact';

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
export const LAB_DENSITIES: LabDensity[] = ['comfortable', 'compact'];

/** Maps the LabTheme.id ('light'|'dark') to the [data-theme] attribute value. */
export const themeAttr = (id: LabTheme['id']): 'blueprint' | 'studio' => (id === 'light' ? 'blueprint' : 'studio');
