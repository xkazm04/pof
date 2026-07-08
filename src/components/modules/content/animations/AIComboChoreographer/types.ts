/* ══════════════════════════════════════════════════════════════════════════
   DATA MODEL — matches AnimationStateGraph.tsx schemas
   ══════════════════════════════════════════════════════════════════════════ */

export interface NotifyWindow {
  name: string;
  color: string;
  start: number; // 0-1 normalized position within section
  width: number; // 0-1 normalized width
}

export interface ComboSection {
  label: string;
  duration: number; // seconds
  damage: number;
  windows: NotifyWindow[];
  rootMotionDistance: number; // cm
  motionWarpTarget: boolean;
  description: string;
}

export interface ComboChainEdge {
  from: number;
  to: number;
  windowStart: number; // seconds
  windowEnd: number;
}

/** One input word that mapped to a hit type, kept so the UI can echo it back. */
export interface MatchedComboKeyword {
  word: string;
  type: HitType;
}

/** Diagnostics from parsing the free-text combo description. */
export interface ComboParse {
  /** Number of hits the combo will have. */
  count: number;
  /** True when the user explicitly stated a hit count (e.g. "3-hit"). */
  countExplicit: boolean;
  /** Final per-hit type sequence (length === count). */
  hitTypes: HitType[];
  /** Unique input words that mapped to a hit type, in order of first appearance. */
  matchedKeywords: MatchedComboKeyword[];
  /** True when at least one hit-type keyword was recognized (else a default combo was used). */
  typesRecognized: boolean;
}

export interface GeneratedCombo {
  name: string;
  description: string;
  sections: ComboSection[];
  edges: ComboChainEdge[];
  totalDuration: number;
  totalDamage: number;
  avgDPS: number;
  /** How the description was interpreted — surfaced to the user above the results. */
  parseInfo: ComboParse;
}

/* ══════════════════════════════════════════════════════════════════════════
   COMBO GENERATOR — deterministic generation from natural language keywords
   ══════════════════════════════════════════════════════════════════════════ */

export type HitType = 'light' | 'medium' | 'heavy' | 'sweep' | 'thrust' | 'slam' | 'uppercut' | 'spin';

export interface HitSpec {
  type: HitType;
  label: string;
  baseDuration: number;
  baseDamage: number;
  rootMotion: number;
  hasMotionWarp: boolean;
  hitWindowStart: number;
  hitWindowWidth: number;
  comboWindowStart: number;
  comboWindowWidth: number;
  vfxWindowStart: number;
  vfxWindowWidth: number;
}
