/* ------------------------------------------------------------------ */
/*  Localization Pipeline — Pseudo-locale (engine-free)                */
/* ------------------------------------------------------------------ */
/*                                                                     */
/*  The first "locale" a pipeline builds: every source string run      */
/*  through a deterministic transform so clipping, catalog bypass and  */
/*  concatenation show up BEFORE a translation is paid for. It is      */
/*  built, never offered, never counted: it is not a SUPPORTED_LOCALE, */
/*  no TranslationEntry is ever made for it, so QA / progress /        */
/*  ready-to-ship cannot see it.                                       */
/* ------------------------------------------------------------------ */

/** Windows' pseudo-locale tag; deliberately absent from SUPPORTED_LOCALES. */
export const PSEUDO_LOCALE = 'qps-ploc';

/**
 * Expansion by SOURCE length — short strings grow most (published pseudo-localization
 * guidance, e.g. IBM / Microsoft globalization tables), so one flat per-locale factor
 * under-reports exactly the button/label surfaces that clip. `maxLen` is inclusive.
 */
export const EXPANSION_BANDS: readonly { maxLen: number; factor: number }[] = [
  { maxLen: 10, factor: 2.0 },
  { maxLen: 20, factor: 1.8 },
  { maxLen: 30, factor: 1.6 },
  { maxLen: 50, factor: 1.4 },
  { maxLen: 70, factor: 1.4 },
  { maxLen: Infinity, factor: 1.3 },
];

export function expansionBand(sourceLength: number): number {
  return (EXPANSION_BANDS.find((b) => sourceLength <= b.maxLen) ?? EXPANSION_BANDS[EXPANSION_BANDS.length - 1]).factor;
}

/** Projected pseudo length (markers excluded). Integer tenths so 15 × 1.8 is 27, not 27.000…1. */
export function projectedLength(sourceLength: number): number {
  const tenths = Math.round(expansionBand(sourceLength) * 10);
  return Math.ceil((sourceLength * tenths) / 10);
}

/** Three independent knobs, so a defect can be attributed to one transform. */
export interface PseudoKnobs {
  /** Pad to the banded projected length. */
  length: boolean;
  /** Wrap in [ ] so truncation at either edge is visible. */
  markers: boolean;
  /** Map ASCII letters to accented look-alikes (catches unlocalized + font gaps). */
  accents: boolean;
}

export const DEFAULT_PSEUDO_KNOBS: PseudoKnobs = { length: true, markers: true, accents: true };

/** Padding glyph: not a letter, digit, brace or angle bracket, so no QA check can trip on it. */
const PAD = '~';

// One BMP code unit per letter, so accenting never changes the string's length.
const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ACCENTED = 'áƀçðéƒĝĥíĵķļɱñóþǫŕšţúṽŵẋýžÅƁÇÐÉƑĜĤÍĴĶĻṀÑÓÞǪŔŠŢÚṼŴẊÝŽ';
const ACCENT_MAP = new Map<string, string>(Array.from(PLAIN, (c, i) => [c, ACCENTED[i]]));

/** The skeleton a transform must never touch: FText::Format `{0}`/`{Name}` and rich-text `<Tag>`/`</>`. */
const SKELETON_RE = /\{[^}]*\}|<[^>]*>/g;

function accent(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(SKELETON_RE)) {
    out += mapLetters(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + mapLetters(text.slice(last));
}

function mapLetters(segment: string): string {
  let out = '';
  for (const c of segment) out += ACCENT_MAP.get(c) ?? c;
  return out;
}

/** Deterministic pseudo-localization of one source string. */
export function pseudoLocalize(text: string, knobs: PseudoKnobs): string {
  let body = knobs.accents ? accent(text) : text;
  if (knobs.length) body += PAD.repeat(Math.max(0, projectedLength(text.length) - text.length));
  return knobs.markers ? `[${body}]` : body;
}
