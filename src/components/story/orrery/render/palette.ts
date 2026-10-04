/**
 * The wheel's palette, resolved from the theme's CSS custom properties.
 *
 * A canvas cannot read a custom property, so every colour the wheel paints is resolved here, once,
 * from the themed ancestor — and re-resolved when `data-orrery-theme` changes, which is what lets
 * the wheel re-theme without a remount. There is not one colour literal in this file or in any
 * draw pass; the only values below are mix ratios and ramp positions.
 *
 * ── Why a mapping and not a token set of its own ────────────────────────────────────────────────
 * The winner's `app.js` carried about thirty wheel colours as hexes. The theme layer
 * (`themes/orrery.css` + `themes/blueprint.css`) declares a chrome token set, not a wheel one, and
 * it is not this package's file to extend. Declaring `--or-wheel-*` in a component would be worse
 * than a mapping: the blueprint overlay could not then redefine them, so the wheel would stay dark
 * while the chrome changed — the exact failure the two-theme split exists to catch.
 *
 * So each wheel colour is DERIVED from the token whose job it already is. Most are exact: the
 * winner's choice amber is `--or-brass` to the byte, its impact amber is `--or-amber`, its gate
 * violet is `--or-violet`, its influence magenta is `--or-infl`, its ending rose is `--or-rose`,
 * its outbound teal is `--or-teal`. The structural blues (events, containers, the container ramp,
 * the traversal chord) have no single token and are built from the theme's own structural blues —
 * `--or-line`, `--or-line2`, `--or-line-hot`, `--or-stage-core` — mixed toward `--or-bg` or
 * `--or-ink`. Those are approximations of the winner's hexes, deliberately, because they are the
 * values that MUST move when the theme does.
 */

import type { StoryNodeKind } from '@/lib/story/types';
import {
  buildRamp,
  isLight,
  mixRgb,
  parseCssColor,
  rgbCss,
  rgbaCss,
  type Rgb,
  type Stop,
} from '@/components/story/orrery/render/colorMath';

/** One resolved token: the string a canvas accepts, and its channels when they could be read. */
interface Tok {
  css: string;
  rgb: Rgb | null;
}

export interface OrreryPalette {
  /** The theme id this palette was read for, so a stale one is detectable. */
  theme: string;
  bg: string;
  ink: string;
  inkHi: string;
  mut: string;
  dim: string;
  hubInner: string;
  hubOuter: string;
  hubRim: string;
  ringGuide: string;
  rimBase: string;
  kind: Record<StoryNodeKind, string>;
  /** Container fills by ring depth (0..4), each with a sibling-parity pair. */
  container: string[][];
  /** 101-entry reach ramp: 0% of runs to 100%. */
  reach: string[];
  /** 101-entry cohort-divergence ramp. */
  diverge: string[];
  /** 17-entry folded-block ramp: few choices inside to many. */
  density: string[];
  chord: Record<'then' | 'option' | 'gate', (alpha: number) => string>;
  impact: string;
  impactCosmetic: string;
  hollow: string;
  flag: string;
  endingRing: string;
  influence: string;
  outbound: string;
  inbound: string;
  hover: string;
  select: string;
  measuredZero: string;
  /** Flat-dial lane tracks, by lane parity. */
  track: string[];
  trackLine: string;
  spoke: string;
  hatch: { ground: string; ink: string };
  fontFamily: string;
  /** Wheel label size in px, read from `--or-fs-min` — the theme's 12px legibility floor. */
  labelPx: number;
  /** Is this fill light enough to need dark ink on it? Memoised per colour string. */
  isLightFill: (css: string) => boolean;
}

/** Reads resolved values off a hidden probe inside the themed host. */
function openReader(host: HTMLElement) {
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.display = 'none';
  host.appendChild(probe);
  const computed = getComputedStyle(probe);
  return {
    /** A token as a colour. Falls back to the expression, which the canvas may still parse. */
    tok(expr: string): Tok {
      probe.style.removeProperty('color');
      probe.style.setProperty('color', expr);
      const css = computed.color || expr;
      return { css, rgb: parseCssColor(css) };
    },
    px(expr: string, fallback: number): number {
      probe.style.setProperty('font-size', expr);
      const n = parseFloat(computed.fontSize);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    },
    close() {
      probe.remove();
    },
  };
}

/** Mix two tokens, keeping the nearer raw string when the channels could not be read. */
function blend(a: Tok, b: Tok, t: number): string {
  if (!a.rgb || !b.rgb) return t < 0.5 ? a.css : b.css;
  return rgbCss(mixRgb(a.rgb, b.rgb, t));
}

function stop(at: number, a: Tok, b: Tok, t: number): Stop {
  return [at, a.rgb && b.rgb ? mixRgb(a.rgb, b.rgb, t) : null, blend(a, b, t)];
}

/**
 * The winner's label size was 11.5px. The owner's one complaint about this variant was that "the
 * font is often too small", and package C answered it with a 12px floor (`--or-fs-min`); the wheel
 * reads the same token so canvas text cannot sink below the floor the DOM honours.
 */
const LABEL_TOKEN = 'var(--or-fs-min)';
const LABEL_FALLBACK_PX = 12;

/**
 * Resolve the whole palette from a themed element. Call it on mount and whenever
 * `data-orrery-theme` changes; it is ~20 style reads, so it is a per-theme cost, never a per-frame
 * one.
 */
export function readOrreryPalette(host: HTMLElement): OrreryPalette {
  const r = openReader(host);
  const bg = r.tok('var(--or-bg)');
  const bg2 = r.tok('var(--or-bg2)');
  const line = r.tok('var(--or-line)');
  const line2 = r.tok('var(--or-line2)');
  const hot = r.tok('var(--or-line-hot)');
  const core = r.tok('var(--or-stage-core)');
  const ink = r.tok('var(--or-ink)');
  const inkHi = r.tok('var(--or-ink-hi)');
  const mut = r.tok('var(--or-mut)');
  const dim = r.tok('var(--or-dim-text)');
  const brass = r.tok('var(--or-brass)');
  const amber = r.tok('var(--or-amber)');
  const teal = r.tok('var(--or-teal)');
  const violet = r.tok('var(--or-violet)');
  const rose = r.tok('var(--or-rose)');
  const infl = r.tok('var(--or-infl)');
  const ok = r.tok('var(--or-ok)');
  const labelPx = r.px(LABEL_TOKEN, LABEL_FALLBACK_PX);
  r.close();

  const chordOf = (t: Tok) => (alpha: number) => (t.rgb ? rgbaCss(t.rgb, alpha) : t.css);

  // The traversal chord is the winner's sky blue: the theme's hottest structural line lifted
  // toward ink, so it stays a cool line in both themes.
  const traversalCss = blend(hot, inkHi, 0.35);
  const traversal: Tok = { css: traversalCss, rgb: parseCssColor(traversalCss) };

  const lightCache = new Map<string, boolean>();

  return {
    theme: host.getAttribute('data-orrery-theme') ?? '',
    bg: bg.css,
    ink: ink.css,
    inkHi: inkHi.css,
    mut: mut.css,
    dim: dim.css,
    hubInner: core.css,
    hubOuter: blend(core, bg, 0.55),
    hubRim: blend(brass, bg, 0.18),
    ringGuide: blend(line, bg, 0.3),
    rimBase: blend(line2, bg, 0.12),
    kind: {
      event: blend(hot, ink, 0.06),
      choice: brass.css,
      gate: blend(violet, bg, 0.14),
      ending: blend(rose, bg, 0.08),
      entry: blend(ok, teal, 0.35),
      template: blend(mut, bg, 0.3),
      container: blend(line2, hot, 0.45),
    },
    // Five containment rings, alternating siblings, from the deep stage floor to the hot line —
    // the winner's `CF` table expressed as one ramp so the theme controls both ends.
    container: [0, 1, 2, 3, 4].map((d) => {
      const t = d / 4;
      return [blend(core, hot, 0.1 + 0.75 * t), blend(core, hot, 0.18 + 0.8 * t)];
    }),
    reach: buildRamp([
      stop(0, bg2, bg, 0.35),
      stop(0.12, teal, bg, 0.78),
      stop(0.45, teal, bg, 0.3),
      stop(0.8, teal, inkHi, 0.35),
      stop(1, teal, inkHi, 0.82),
    ]),
    diverge: buildRamp([
      stop(0, bg2, bg, 0.35),
      stop(0.25, violet, bg, 0.7),
      stop(0.6, infl, bg, 0.3),
      stop(1, infl, inkHi, 0.55),
    ]),
    density: buildRamp([stop(0, hot, bg, 0.3), stop(1, amber, bg, 0.08)], 17),
    chord: { then: chordOf(traversal), option: chordOf(amber), gate: chordOf(violet) },
    impact: amber.css,
    impactCosmetic: blend(hot, mut, 0.5),
    hollow: mut.css,
    flag: rose.css,
    endingRing: blend(rose, bg, 0.08),
    influence: infl.css,
    outbound: teal.css,
    inbound: violet.css,
    hover: inkHi.css,
    select: blend(amber, inkHi, 0.35),
    measuredZero: blend(hot, bg, 0.12),
    track: [blend(core, bg, 0.7), blend(core, bg, 0.62)],
    trackLine: blend(line, bg, 0.1),
    spoke: blend(line2, bg, 0.35),
    hatch: { ground: blend(bg2, bg, 0.3), ink: blend(mut, bg, 0.22) },
    fontFamily: getComputedStyle(host).fontFamily,
    labelPx,
    isLightFill(css: string) {
      const hit = lightCache.get(css);
      if (hit !== undefined) return hit;
      const parsed = parseCssColor(css);
      // Unparseable means "assume dark", which keeps light ink — the readable default on this
      // palette, and never a guessed colour.
      const v = parsed ? isLight(parsed) : false;
      lightCache.set(css, v);
      return v;
    },
  };
}
