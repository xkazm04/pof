/* eslint-disable no-restricted-syntax -- identity-lab theme tokens: bespoke palettes by design, not the app's chart-color tokens */
import { inter, ibmPlexMono, jetbrainsMono } from './fonts';

/** A lab theme for the Blueprint baseline. Light = Blueprint drafting; Dark = Studio palette/type. */
export interface LabTheme {
  id: 'light' | 'dark';
  label: string;
  bg: string;
  gridLine: string | null;   // null = no schematic grid (dark)
  panel: string;
  ink: string;               // primary line/heading color
  inkDeep: string;
  text: string;
  muted: string;
  line: string;
  accentBg: string;          // soft accent fill (selected)
  glass: boolean;            // backdrop-blur panels (dark)
  fontBody: string;          // className
  fontMono: string;          // className (labels, numbers, stats)
  ok: string;                // acceptance pass
  warn: string;              // acceptance pending
  bad: string;               // acceptance fail
  onAccent: string;          // glyph/text on an accent-filled square (checkmark)
}

export const LIGHT: LabTheme = {
  id: 'light', label: 'Blueprint',
  bg: '#dde3ec', gridLine: 'rgba(27,79,156,0.07)', panel: 'rgba(255,255,255,0.62)',
  ink: '#1b4f9c', inkDeep: '#10325f', text: '#243446', muted: '#647488', line: '#aebfd6',
  accentBg: '#d2deef', glass: false, fontBody: inter.className, fontMono: ibmPlexMono.className,
  ok: '#2e7d4f', warn: '#b5790f', bad: '#b23b3b', onAccent: '#ffffff',
};

export const DARK: LabTheme = {
  id: 'dark', label: 'Studio Dark',
  bg: '#0a0e14', gridLine: null, panel: 'rgba(255,255,255,0.05)',
  ink: '#22d3ee', inkDeep: '#67e8f9', text: '#e2e8f0', muted: '#8c9aae', line: 'rgba(255,255,255,0.12)',
  accentBg: 'rgba(34,211,238,0.10)', glass: true, fontBody: inter.className, fontMono: jetbrainsMono.className,
  ok: '#34d399', warn: '#fbbf24', bad: '#f87171', onAccent: '#06141b',
};

export const LAB_THEMES: LabTheme[] = [LIGHT, DARK];
