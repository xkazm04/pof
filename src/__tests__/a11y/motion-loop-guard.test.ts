import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guard: no framer-motion animation may loop forever, unstoppably, for a user who
 * has asked their operating system for reduced motion.
 *
 * Why a guard and not a review note: `globals.css` honours
 * `@media (prefers-reduced-motion: reduce)` for CSS animations, but framer-motion
 * drives styles from JavaScript and never reads that media query. Its own default
 * is `reducedMotion: "never"` — the library ships explicitly ignoring the OS
 * preference — and until wave 19 this app had no `MotionConfig` at all.
 *
 * Two layers now cover it, and this guard pins the seam between them:
 *
 *  1. `AppMotionProvider` (`reducedMotion="user"`, mounted at the root) neutralises
 *     every *positional* animation. Framer's own `positionalKeys` set is
 *     `width | height | top | left | right | bottom` plus the transform props, and
 *     `layout` / `layoutId` animations run as transforms, so those are covered for
 *     free — a looping `rotate`/`x`/`scale` snaps to its final keyframe and stops.
 *  2. Everything else — `opacity`, `borderColor`, `boxShadow`, `strokeDashoffset`,
 *     SVG geometry attributes like `r` — keeps animating by framer's design. A
 *     `repeat: Infinity` loop on one of those properties is still a perpetually
 *     moving element, so it must opt out itself via `motionSafe(t, prefersReduced)`.
 *
 * Every file that writes `repeat: Infinity` must therefore either reference the
 * reduced-motion hook/helper, or be listed below with the reason it does not need
 * to. The list may only shrink: an entry that no longer loops, or that has grown a
 * non-positional loop, fails the test rather than silently ageing into decoration.
 */

const SRC = path.join(process.cwd(), 'src');
const LOOP_MARKER = 'repeat: Infinity';
const GUARD_MARKERS = ['useReducedMotion', 'motionSafe'];

/**
 * Framer's positional keys, transcribed from the installed library
 * (`framer-motion/dist/framer-motion.dev.js` → `positionalKeys`). Animations of
 * these — and only these — are forced instant by `reducedMotion="user"`.
 */
const POSITIONAL_KEYS = [
  'width', 'height', 'top', 'left', 'right', 'bottom',
  'x', 'y', 'z', 'translateX', 'translateY', 'translateZ',
  'scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'rotateZ',
  'skew', 'skewX', 'skewY', 'perspective',
] as const;

/**
 * Non-positional properties whose keyframe form is the tell-tale of a loop the
 * root provider CANNOT stop. Used to re-derive the exemption reason from source
 * rather than trusting the annotation.
 */
const NON_POSITIONAL_KEYFRAME_PATTERNS = [
  /\bopacity:\s*\[/,
  /\bbackgroundColor:\s*\[/,
  /\bborderColor:\s*\[/,
  /\bboxShadow:\s*\[/,
  /\bcolor:\s*\[/,
  /\bfill:\s*\[/,
  /\bstroke:\s*\[/,
  /\bstrokeDashoffset:/,
  /\bpathLength:\s*\[/,
  /\br:\s*\[/,
];

interface Exemption {
  /** The positional properties this file's infinite loops animate. */
  animates: ReadonlyArray<(typeof POSITIONAL_KEYS)[number]>;
  /** Why the root provider alone is sufficient here. */
  why: string;
}

/**
 * Files that loop forever but animate ONLY positional properties, so
 * `AppMotionProvider`'s `reducedMotion="user"` already stops them. No local hook
 * needed — adding one would be noise.
 */
const POSITIONAL_ONLY_LOOPS: Record<string, Exemption> = {
  'components/blender-mcp/ViewportPreview.tsx': {
    animates: ['x'],
    why: 'Shimmer sweep translates a gradient across the preview; x is a transform prop.',
  },
  'components/modules/content/animations/AIComboChoreographer/index.tsx': {
    animates: ['rotate'],
    why: 'Generating spinner — rotate only.',
  },
  'components/modules/core-engine/sub_ability/gas-balance/index.tsx': {
    animates: ['rotate'],
    why: 'Simulation-running spinner — rotate only.',
  },
  'components/modules/core-engine/sub_animation/combos-montages/ComboTimelinePanel.tsx': {
    animates: ['x'],
    why: 'Connector sweep between sections translates on x.',
  },
  'components/modules/core-engine/sub_character/overview/HitboxWireframeViewer.tsx': {
    animates: ['y'],
    why: 'Scan line travels down the wireframe on y (deliberately framer-driven to avoid per-frame state).',
  },
  'components/modules/core-engine/sub_character/simulator/feedback/ConfigPanel.tsx': {
    animates: ['rotate'],
    why: 'Run-in-progress spinner — rotate only.',
  },
  'components/modules/core-engine/sub_character/simulator/predictive/PredictiveBalanceSimulator.tsx': {
    animates: ['rotate'],
    why: 'Two run-in-progress spinners — rotate only.',
  },
  'components/modules/core-engine/sub_combat/combos/TimelineBlock.tsx': {
    animates: ['x'],
    why: 'Combo-window arrow nudges back and forth on x.',
  },
  'components/modules/core-engine/sub_inventory/catalog/TradingCard.tsx': {
    animates: ['rotate'],
    why: 'Placeholder art sways on rotate when an item has no image.',
  },
  'components/modules/core-engine/sub_loot/economy/BeaconVisualizer.tsx': {
    animates: ['y'],
    why: 'Beam highlight travels up each bar on y.',
  },
  'components/modules/core-engine/unique-tabs/index.tsx': {
    animates: ['rotate'],
    why: 'Loading ring — rotate only.',
  },
};

/**
 * Files whose reduced-motion flag is supplied by a *colocated* hook module rather
 * than by calling `useReducedMotion` inline — so a per-file marker scan cannot see
 * it, but the component is genuinely covered. Value = the sibling module that must
 * actually call the hook (re-derived below, not taken on trust).
 */
const COLOCATED_GUARDS: Record<string, { supplier: string; why: string }> = {
  'components/modules/core-engine/sub_loot/affix/AffixRollSimulator/index.tsx': {
    supplier: 'components/modules/core-engine/sub_loot/affix/AffixRollSimulator/useAffixRollSimulator.tsx',
    why: 'The slot reel takes `prefersReducedMotion` from its own hook and passes `animate={undefined}` '
      + 'when set — which also covers its non-positional win-flash (boxShadow keyframes).',
  },
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function relOf(file: string): string {
  return path.relative(SRC, file).split(path.sep).join('/');
}

const LOOPING_FILES = walk(SRC)
  .filter((f) => !relOf(f).startsWith('__tests__/'))
  .filter((f) => fs.readFileSync(f, 'utf8').includes(LOOP_MARKER));

describe('reduced motion: infinite framer-motion loops', () => {
  it('finds the infinite-loop population it is meant to police', () => {
    // A sanity floor. If this ever reads 0 the scanner has broken (renamed marker,
    // moved source root) and every assertion below would vacuously pass.
    expect(LOOPING_FILES.length).toBeGreaterThan(20);
  });

  it('every `repeat: Infinity` file is either reduced-motion aware or a listed positional-only loop', () => {
    const unguarded: string[] = [];
    for (const file of LOOPING_FILES) {
      const rel = relOf(file);
      if (rel in POSITIONAL_ONLY_LOOPS || rel in COLOCATED_GUARDS) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (!GUARD_MARKERS.some((m) => src.includes(m))) unguarded.push(rel);
    }
    expect(unguarded, `These files loop forever with no reduced-motion opt-out:\n${unguarded.join('\n')}`)
      .toEqual([]);
  });

  it('the exemption list only shrinks — no stale entries', () => {
    const looping = new Set(LOOPING_FILES.map(relOf));
    const stale = [...Object.keys(POSITIONAL_ONLY_LOOPS), ...Object.keys(COLOCATED_GUARDS)]
      .filter((rel) => !looping.has(rel));
    expect(stale, `Listed as an exempt loop but no longer loops (delete the entry):\n${stale.join('\n')}`)
      .toEqual([]);
  });
});

describe('reduced motion: each exemption still holds', () => {
  // The point of this second suite: an allowlist whose reasons are never re-checked
  // is decoration. Every claim below is re-derived from the file's own source.

  it.each(Object.keys(POSITIONAL_ONLY_LOOPS))(
    '%s animates only properties the root MotionConfig can stop',
    (rel) => {
      const entry = POSITIONAL_ONLY_LOOPS[rel];
      expect(entry.why.length, `${rel} needs a real reason, not a placeholder`).toBeGreaterThan(25);
      expect(entry.animates.length, `${rel} must name the properties it animates`).toBeGreaterThan(0);

      for (const key of entry.animates) {
        expect(
          POSITIONAL_KEYS as ReadonlyArray<string>,
          `${rel} claims exemption for "${key}", which framer does NOT treat as positional`,
        ).toContain(key);
      }

      const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
      const offending = NON_POSITIONAL_KEYFRAME_PATTERNS.filter((re) => re.test(src)).map(String);
      expect(
        offending,
        `${rel} is exempt on the grounds that its loops are positional-only, but its source now animates `
        + `non-positional properties (${offending.join(', ')}). The root provider cannot stop those — `
        + 'either gate them with motionSafe() or correct this entry.',
      ).toEqual([]);
    },
  );

  it.each(Object.keys(COLOCATED_GUARDS))(
    '%s really does receive a reduced-motion flag from its colocated hook',
    (rel) => {
      const entry = COLOCATED_GUARDS[rel];
      expect(entry.why.length).toBeGreaterThan(25);

      const supplierPath = path.join(SRC, entry.supplier);
      expect(fs.existsSync(supplierPath), `${entry.supplier} does not exist`).toBe(true);

      const supplier = fs.readFileSync(supplierPath, 'utf8');
      expect(supplier, `${entry.supplier} must call useReducedMotion() for this exemption to hold`)
        .toContain('useReducedMotion()');

      // …and the exempt component must actually consume it, not merely sit next to it.
      const consumer = fs.readFileSync(path.join(SRC, rel), 'utf8');
      expect(consumer, `${rel} does not consume prefersReducedMotion`).toContain('prefersReducedMotion');
    },
  );
});
