/**
 * Colour arithmetic for the Orrery canvas, with no colour of its own.
 *
 * The wheel needs ramps and a contrast decision, and a canvas cannot read a CSS custom property —
 * so the surface resolves tokens to concrete colour strings (`palette.ts`) and this module does the
 * arithmetic on what came back. Everything here is pure and DOM-free: it parses a colour string,
 * mixes two, builds a lookup ramp and answers "is this light enough to need dark ink on it".
 *
 * Why a parser at all: `getComputedStyle(el).color` is the only reliable way to resolve a token
 * that is itself a `color-mix()` (an unregistered custom property's computed value keeps the
 * function text), and what comes back is serialised by the engine, not by us — `rgb()`, `rgba()`,
 * `color(srgb …)` or, in a DOM that does not implement the colour space, nothing at all. A string
 * this module cannot parse is never faked into a colour: `parseCssColor` returns `null`, the
 * caller keeps the original string for `fillStyle` (the canvas has its own parser) and any
 * arithmetic that needed numbers degrades to the nearest stop.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNC = /^(rgba?|color)\(([^)]*)\)$/i;

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Parse one channel of a `color()` / `rgb()` body: a number, or a percentage of the range. */
function channel(token: string, range: number): number {
  const t = token.trim();
  if (t.endsWith('%')) return (parseFloat(t) / 100) * 255;
  const n = parseFloat(t);
  return range === 1 ? n * 255 : n;
}

/**
 * Parse a resolved CSS colour into 0..255 channels, or `null` when the string is not a form this
 * module understands (a named colour, `oklab()`, an unresolved `var()`, the empty string).
 */
export function parseCssColor(input: string | null | undefined): Rgb | null {
  if (!input) return null;
  const s = input.trim();
  const hex = HEX.exec(s);
  if (hex) {
    const h = hex[1];
    const w = h.length <= 4 ? 1 : 2;
    const at = (i: number) => {
      const part = h.slice(i * w, i * w + w);
      const v = parseInt(w === 1 ? part + part : part, 16);
      return Number.isNaN(v) ? null : v;
    };
    const r = at(0);
    const g = at(1);
    const b = at(2);
    if (r === null || g === null || b === null) return null;
    return { r, g, b };
  }
  const fn = FUNC.exec(s);
  if (!fn) return null;
  const body = fn[2].split('/')[0].replace(/,/g, ' ').trim().split(/\s+/);
  // `color(srgb r g b)` carries its space first and its channels as 0..1.
  const isColorFn = fn[1].toLowerCase() === 'color';
  if (isColorFn && body[0]?.toLowerCase() !== 'srgb') return null;
  const parts = isColorFn ? body.slice(1) : body;
  if (parts.length < 3) return null;
  const range = isColorFn ? 1 : 255;
  const r = channel(parts[0], range);
  const g = channel(parts[1], range);
  const b = channel(parts[2], range);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

/** Serialise channels back to a string a canvas context accepts. */
export function rgbCss(c: Rgb): string {
  return `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)})`;
}

/** Same, with an alpha channel — the chord layers are drawn translucent. */
export function rgbaCss(c: Rgb, alpha: number): string {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

/** Linear mix: `t = 0` is `a`, `t = 1` is `b`. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k };
}

/**
 * Relative luminance, WCAG 2.x definition. Used for one decision only: whether a label sitting on
 * a filled sector takes dark ink or light ink.
 */
export function luminance(c: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/**
 * The winner's threshold for flipping label ink, kept verbatim: it compared a simple weighted
 * average against 0.46. Expressed against WCAG luminance the same split lands near 0.18.
 */
export function isLight(c: Rgb): boolean {
  return luminance(c) > 0.18;
}

export type Stop = readonly [position: number, colour: Rgb | null, raw: string];

/**
 * Build a 0..1 lookup ramp of `steps` entries from positioned stops.
 *
 * When every stop parsed, entries are interpolated colour strings. When one did not, that span
 * degrades to the nearest stop's RAW string rather than inventing a colour — a ramp that cannot be
 * computed still paints the right family, and nothing here ever substitutes a literal.
 */
export function buildRamp(stops: readonly Stop[], steps = 101): string[] {
  if (stops.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    out.push(sampleRamp(stops, t));
  }
  return out;
}

/** One sample from a stop list. Exported so a test can assert the ends and a midpoint. */
export function sampleRamp(stops: readonly Stop[], t: number): string {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let s = 1; s < stops.length; s++) {
    if (k > stops[s][0]) continue;
    const lo = stops[s - 1];
    const hi = stops[s];
    const span = hi[0] - lo[0] || 1;
    const f = (k - lo[0]) / span;
    if (lo[1] && hi[1]) return rgbCss(mixRgb(lo[1], hi[1], f));
    return f < 0.5 ? lo[2] : hi[2];
  }
  const last = stops[stops.length - 1];
  return last[1] ? rgbCss(last[1]) : last[2];
}

/** Index into a `steps`-entry ramp for a 0..1 value. */
export function rampIndex(value: number, steps: number): number {
  const i = Math.round(value * (steps - 1));
  return i < 0 ? 0 : i > steps - 1 ? steps - 1 : i;
}
