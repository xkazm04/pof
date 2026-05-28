/**
 * Plain-language summariser for animation prompts and generated C++.
 *
 * The `Explain` toggle on the Animations module shows this summary above each
 * dense code block / step prompt so non-engineers can read what the section is
 * actually about before diving into the code.
 *
 * Approach: scan the text for known jargon (via `findAnimationJargon`), bucket
 * the matches into a few conceptual themes (locomotion, montages, notifies,
 * mixamo, lifecycle), then emit a short bulleted summary. Falls back to a
 * one-line "no known concepts detected" when nothing matches — never throws.
 */

import { findAnimationJargon, type AnimationJargonEntry } from './jargon';

export interface PlainEnglishSummary {
  /** One-line headline that paraphrases what this section is about. */
  headline: string;
  /** Up to ~4 short bullets, each explaining one concept the section touches. */
  bullets: string[];
  /** Raw jargon entries found in the source, in encounter order. */
  detected: AnimationJargonEntry[];
}

interface Theme {
  id: string;
  /** Concept terms that pull the theme in. */
  terms: string[];
  /** One-line, jargon-free description of the theme. */
  bullet: string;
}

const THEMES: Theme[] = [
  {
    id: 'lifecycle',
    terms: ['NativeInitializeAnimation', 'NativeUpdateAnimation', 'ComputeAnimState', 'AnimInstance', 'UAnimInstance'],
    bullet: 'Wires the per-frame animation update — reads movement state and feeds it to the AnimGraph.',
  },
  {
    id: 'blend-and-states',
    terms: ['blend space', 'state machine', 'AnimGraph', 'Animation Blueprint'],
    bullet: 'Sets up the state graph and blend spaces that decide which pose plays based on Speed / Direction / IsInAir.',
  },
  {
    id: 'montage',
    terms: ['AnimMontage', 'UAnimMontage', 'Montage_JumpToSection', 'CompositeSections', 'SlotAnimTracks', 'bIsFullBodyMontage', 'montage'],
    bullet: 'Drives scripted clips (attack combos, dodges, hit reactions) with named sections you can jump between.',
  },
  {
    id: 'notifies',
    terms: ['anim notify'],
    bullet: 'Fires gameplay events at exact frames — combo windows, hit detection, footsteps, VFX, sounds.',
  },
  {
    id: 'root-motion',
    terms: ['root motion', 'in place', 'CharacterMovementComponent', 'CalculateDirection'],
    bullet: 'Decides whether the character is moved by the animation itself (root motion) or by the movement component.',
  },
  {
    id: 'priority',
    terms: ['priority cascade'],
    bullet: 'Higher-priority animations cancel lower-priority ones — so a hit reaction can interrupt a swing.',
  },
  {
    id: 'mixamo',
    terms: ['Mixamo', 'IK Retargeter', 'Skeleton', 'mixamorig:'],
    bullet: 'Imports Mixamo content and retargets it onto the project skeleton so the animations play on your character.',
  },
];

/**
 * Build a plain-English summary of a prompt or code block. Pure function:
 * deterministic, no side effects, safe to call inside `useMemo`.
 */
export function summarizeAnimationPrompt(text: string): PlainEnglishSummary {
  const detected = findAnimationJargon(text ?? '');

  if (detected.length === 0) {
    return {
      headline: 'No animation concepts detected — read the section directly.',
      bullets: [],
      detected: [],
    };
  }

  const detectedTerms = new Set(detected.map((e) => e.term));
  const hitThemes: Theme[] = [];
  for (const theme of THEMES) {
    if (theme.terms.some((t) => detectedTerms.has(t))) {
      hitThemes.push(theme);
    }
  }

  const headline = buildHeadline(hitThemes, detected);
  const bullets = hitThemes.length > 0
    ? hitThemes.slice(0, 4).map((t) => t.bullet)
    : [
        // No themes matched but jargon was detected — paraphrase the first
        // couple of entries directly.
        ...detected.slice(0, 3).map((e) => `${capitalise(e.term)} — ${e.plain}`),
      ];

  return { headline, bullets, detected };
}

function buildHeadline(themes: Theme[], detected: AnimationJargonEntry[]): string {
  if (themes.length === 0) {
    return `Covers ${joinList(detected.slice(0, 3).map((e) => e.term))} and related ideas.`;
  }

  const shorthand = themes.map((t) => themeShorthand(t.id));
  return `In plain English: ${joinList(shorthand)}.`;
}

function themeShorthand(id: string): string {
  switch (id) {
    case 'lifecycle': return 'how the animation system updates each frame';
    case 'blend-and-states': return 'the state graph + blend spaces that pick the pose';
    case 'montage': return 'scripted clips like combos and hit reactions';
    case 'notifies': return 'frame-accurate gameplay events';
    case 'root-motion': return 'who moves the character (animation vs. movement component)';
    case 'priority': return 'which animations can interrupt which';
    case 'mixamo': return 'getting Mixamo animations onto your skeleton';
    default: return id;
  }
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function capitalise(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}
