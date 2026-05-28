/**
 * Plain-language dictionary for UE5 animation-system jargon.
 *
 * Mirrors the shape of `blueprint-jargon.ts` but covers the animation domain:
 * AnimInstance lifecycle, montages, blend spaces, state machines, root motion,
 * Mixamo terms, and the specific symbols our generated C++ tends to emit
 * (NativeUpdateAnimation, bIsFullBodyMontage, ComputeAnimState, priority
 * cascade, etc.).
 *
 * Keep entries terse — one or two short sentences. The UI surfaces these as
 * inline tooltips under the `Explain` toggle on the Animations module.
 */

import { lookupJargon as lookupBlueprintJargon, type JargonEntry } from '@/lib/blueprint-jargon';

export type AnimationJargonEntry = JargonEntry & {
  /** Extra surface forms to match (e.g. "AnimBP" → "Animation Blueprint"). */
  aliases?: string[];
  /**
   * If true, only the exact-case form matches (used for C++ identifiers like
   * `NativeUpdateAnimation`). If false, matching is case-insensitive (used for
   * natural-language phrases like "root motion").
   */
  caseSensitive?: boolean;
};

// ─── AnimInstance lifecycle / C++ symbols ───────────────────────────────────

const ANIM_INSTANCE: Record<string, AnimationJargonEntry> = {
  NativeInitializeAnimation: {
    term: 'NativeInitializeAnimation',
    plain: 'Runs once when the character\'s animation system starts — used to cache references like the owning character and movement component.',
    whyItMatters: 'Looking these up every frame is wasted work; cache them here and reuse in the update tick.',
    caseSensitive: true,
  },
  NativeUpdateAnimation: {
    term: 'NativeUpdateAnimation',
    plain: 'Runs every frame to refresh animation variables (speed, direction, in-air) from the character\'s movement state.',
    whyItMatters: 'This is where Speed/Direction get updated so the blend space picks the right pose.',
    caseSensitive: true,
  },
  UAnimInstance: {
    term: 'UAnimInstance',
    plain: 'The C++ "brain" behind an Animation Blueprint — owns the variables the AnimGraph reads.',
    caseSensitive: true,
  },
  AnimInstance: {
    term: 'AnimInstance',
    plain: 'The runtime object that drives a skeletal mesh\'s pose — the C++ side of an Animation Blueprint.',
    aliases: ['AnimBP runtime'],
    caseSensitive: false,
  },
  ComputeAnimState: {
    term: 'ComputeAnimState',
    plain: 'The function that decides which animation state to play right now based on speed, in-air, attacking, etc.',
    whyItMatters: 'If a state never gets picked, this is usually where the wrong condition lives.',
    caseSensitive: true,
  },
};

// ─── Montage system ─────────────────────────────────────────────────────────

const MONTAGE: Record<string, AnimationJargonEntry> = {
  AnimMontage: {
    term: 'AnimMontage',
    plain: 'A scripted animation clip with named sections (e.g. Attack1 → Attack2) — used for attacks, dodges, hit reactions.',
    caseSensitive: true,
  },
  UAnimMontage: {
    term: 'UAnimMontage',
    plain: 'The C++ class for a montage asset — a scripted clip you can branch through (combos, hit reacts).',
    caseSensitive: true,
  },
  Montage_JumpToSection: {
    term: 'Montage_JumpToSection',
    plain: 'Snaps the currently playing montage to a named section — how attack combos advance to the next swing.',
    caseSensitive: true,
  },
  CompositeSections: {
    term: 'CompositeSections',
    plain: 'The list of named time-ranges inside a montage (e.g. "Attack1", "Attack2") that you can jump between.',
    caseSensitive: true,
  },
  SlotAnimTracks: {
    term: 'SlotAnimTracks',
    plain: 'The animation tracks inside a montage, each tied to a named slot (e.g. "DefaultSlot", "UpperBody").',
    caseSensitive: true,
  },
  bIsFullBodyMontage: {
    term: 'bIsFullBodyMontage',
    plain: 'When true, the montage takes over the whole body; when false, it only plays on one slot (e.g. just the arms).',
    whyItMatters: 'Full-body montages cancel locomotion. Upper-body slots let you swing while still running.',
    caseSensitive: true,
  },
  montage: {
    term: 'montage',
    plain: 'A scripted animation clip with named sections (Attack1 → Attack2, etc.) — used for actions like combos.',
    aliases: ['montages'],
    caseSensitive: false,
  },
};

// ─── Blend spaces & state machines ──────────────────────────────────────────

const BLEND_AND_STATES: Record<string, AnimationJargonEntry> = {
  'blend space': {
    term: 'blend space',
    plain: 'An asset that smoothly mixes between multiple animations based on input values (e.g. Idle ↔ Walk ↔ Run driven by Speed).',
    whyItMatters: 'Without it, you get a hard cut between Walk and Run instead of a smooth speedup.',
    aliases: ['BlendSpace', 'BlendSpace1D', 'BS1D'],
    caseSensitive: false,
  },
  'state machine': {
    term: 'state machine',
    plain: 'The graph that decides which animation state is active and when to switch between them (e.g. Idle → Jump → Fall → Land).',
    aliases: ['AnimGraph state machine'],
    caseSensitive: false,
  },
  AnimGraph: {
    term: 'AnimGraph',
    plain: 'The visual graph inside an Animation Blueprint that wires states, blend spaces, and montages into a final pose.',
    caseSensitive: true,
  },
  'Animation Blueprint': {
    term: 'Animation Blueprint',
    plain: 'The visual graph that decides which animation plays — usually fed by C++ variables on the AnimInstance.',
    aliases: ['AnimBlueprint', 'AnimBP'],
    caseSensitive: false,
  },
  'priority cascade': {
    term: 'priority cascade',
    plain: 'The rule that says "higher-priority animations cancel lower-priority ones" (e.g. a hit reaction interrupts a swing).',
    whyItMatters: 'Without a cascade, a stronger reaction can be drowned out by whatever was already playing.',
    caseSensitive: false,
  },
  'anim notify': {
    term: 'anim notify',
    plain: 'A marker on an animation timeline that fires a gameplay event at a specific frame (footstep sound, hit detection, VFX spawn).',
    aliases: ['AnimNotify', 'anim notifies', 'AnimNotifyState'],
    caseSensitive: false,
  },
};

// ─── Root motion & locomotion ───────────────────────────────────────────────

const ROOT_MOTION: Record<string, AnimationJargonEntry> = {
  'root motion': {
    term: 'root motion',
    plain: 'When the animation itself moves the character through the world (instead of the movement component pushing them).',
    whyItMatters: 'Great for attacks/dodges that need exact distances — but switching it on for run/walk usually fights the game\'s movement.',
    caseSensitive: false,
  },
  'in place': {
    term: 'in place',
    plain: 'An animation that plays without moving — used for Idle/Walk/Run where the movement component drives location.',
    aliases: ['in-place'],
    caseSensitive: false,
  },
  CharacterMovementComponent: {
    term: 'CharacterMovementComponent',
    plain: 'The C++ component that actually moves the character (walk speed, gravity, jump). Animations usually read its state, not drive it.',
    aliases: ['CMC'],
    caseSensitive: true,
  },
  CalculateDirection: {
    term: 'CalculateDirection',
    plain: 'A helper that converts a velocity vector into a -180°..180° angle relative to where the character is facing — used to pick the right strafe animation.',
    caseSensitive: true,
  },
};

// ─── Mixamo / retargeting ───────────────────────────────────────────────────

const MIXAMO: Record<string, AnimationJargonEntry> = {
  Mixamo: {
    term: 'Mixamo',
    plain: 'Adobe\'s free library of rigged characters and animations — common starting point for UE5 prototypes.',
    caseSensitive: false,
  },
  'IK Retargeter': {
    term: 'IK Retargeter',
    plain: 'A UE5 asset that copies animations from one skeleton onto another (e.g. Mixamo → Manny) by mapping equivalent bone chains.',
    aliases: ['IKRetargeter'],
    caseSensitive: false,
  },
  Skeleton: {
    term: 'Skeleton',
    plain: 'The bone hierarchy a mesh deforms with — multiple animations must share the same Skeleton asset to play on a character.',
    aliases: ['skeleton asset'],
    caseSensitive: false,
  },
  'mixamorig:': {
    term: 'mixamorig:',
    plain: 'The bone-name prefix Mixamo uses (e.g. "mixamorig:Hips"). UE5 strips it on import so bone names become "Hips" etc.',
    caseSensitive: false,
  },
};

// ─── Aggregate ──────────────────────────────────────────────────────────────

const ALL: Record<string, AnimationJargonEntry> = {
  ...ANIM_INSTANCE,
  ...MONTAGE,
  ...BLEND_AND_STATES,
  ...ROOT_MOTION,
  ...MIXAMO,
};

/**
 * Return the plain-language entry for an animation term, or undefined.
 * Tries the animation dictionary first, then falls back to the general
 * UE5 / blueprint jargon dictionary so a single annotator can handle both
 * (e.g. `UPROPERTY` inside a generated AnimInstance header).
 */
export function lookupAnimationJargon(term: string): AnimationJargonEntry | undefined {
  const direct = ALL[term];
  if (direct) return direct;

  // Case-insensitive fallback for natural-language phrases
  const lower = term.toLowerCase();
  for (const key of Object.keys(ALL)) {
    const entry = ALL[key];
    if (entry.caseSensitive) continue;
    if (key.toLowerCase() === lower) return entry;
    if (entry.aliases?.some((a) => a.toLowerCase() === lower)) return entry;
  }

  // Fall back to general UE jargon (UPROPERTY etc.)
  const blueprint = lookupBlueprintJargon(term);
  return blueprint;
}

interface JargonMatch {
  start: number;
  end: number;
  /** The exact substring matched in the source text. */
  matched: string;
  entry: AnimationJargonEntry;
}

/**
 * Walk `text` and return non-overlapping matches for every known animation
 * jargon term (including aliases). Returned in source order; longer terms
 * shadow shorter ones (so "blend space" wins over "blend").
 */
export function scanAnimationJargon(text: string): JargonMatch[] {
  if (!text) return [];

  // Build the list of surface forms to search for, longest first so multi-word
  // phrases beat substrings (avoids matching "AnimInstance" inside
  // "UAnimInstance").
  type Surface = { surface: string; entry: AnimationJargonEntry; caseSensitive: boolean };
  const surfaces: Surface[] = [];
  for (const entry of Object.values(ALL)) {
    const cs = entry.caseSensitive ?? false;
    surfaces.push({ surface: entry.term, entry, caseSensitive: cs });
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        surfaces.push({ surface: alias, entry, caseSensitive: cs });
      }
    }
  }
  surfaces.sort((a, b) => b.surface.length - a.surface.length);

  const matches: JargonMatch[] = [];
  const taken = new Uint8Array(text.length);

  for (const { surface, entry, caseSensitive } of surfaces) {
    const haystack = caseSensitive ? text : text.toLowerCase();
    const needle = caseSensitive ? surface : surface.toLowerCase();
    if (!needle) continue;

    let from = 0;
    while (true) {
      const idx = haystack.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;

      // Skip if it overlaps an earlier (longer) match
      let overlap = false;
      for (let i = idx; i < end; i++) {
        if (taken[i]) { overlap = true; break; }
      }

      // Word-ish boundary check: don't match in the middle of an identifier.
      // For natural-language entries we require a non-alphanumeric boundary;
      // for case-sensitive C++ identifiers (CamelCase), boundary checks would
      // mis-fire on suffixes like `NativeUpdateAnimation_Implementation`, so
      // we only require that the character right before isn't an alpha-num
      // continuation.
      if (!overlap) {
        const before = idx > 0 ? text[idx - 1] : '';
        const after = end < text.length ? text[end] : '';
        const isWordChar = (c: string) => /[A-Za-z0-9_]/.test(c);
        if (!caseSensitive) {
          if (isWordChar(before) || isWordChar(after)) {
            from = idx + 1;
            continue;
          }
        } else {
          // Don't reject CamelCase suffixes; just reject if we're clearly
          // inside a longer identifier (preceded by a letter that isn't an
          // underscore boundary).
          if (/[A-Za-z0-9]/.test(before) && before !== '_') {
            from = idx + 1;
            continue;
          }
        }

        matches.push({ start: idx, end, matched: text.slice(idx, end), entry });
        for (let i = idx; i < end; i++) taken[i] = 1;
      }

      from = idx + 1;
    }
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/**
 * Return de-duplicated list of jargon entries that appear in `text`.
 * Used by the summary builder to figure out which concepts to mention.
 */
export function findAnimationJargon(text: string): AnimationJargonEntry[] {
  const seen = new Set<string>();
  const out: AnimationJargonEntry[] = [];
  for (const m of scanAnimationJargon(text)) {
    if (seen.has(m.entry.term)) continue;
    seen.add(m.entry.term);
    out.push(m.entry);
  }
  return out;
}

export const ANIMATION_JARGON_TERMS = Object.keys(ALL);
