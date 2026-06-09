/**
 * Crash & diagnostics glossary — the single source of plain-English text for the
 * developer-heavy crash, pattern, and error-memory surfaces in the evaluator.
 *
 * Two layers live here:
 *
 *   1. A **term map** of UE5 crash jargon (GAS, GC, ASC, ensure, assertion,
 *      access violation, …) on top of the base UE5 dictionary in
 *      `blueprint-jargon.ts`. {@link lookupCrashTerm} checks the crash terms
 *      first, then falls back to the base dictionary, so a single hover-tooltip
 *      vocabulary is shared across the Crash Analyzer, the Pattern Library, and
 *      the Error Memory panel.
 *
 *   2. **Plain-language translations** of the machine-y `CrashType` /
 *      `CrashSeverity` enums into a one-line "what happened" + "what to do",
 *      used by the Crash Analyzer's Plain English mode so a non-technical reader
 *      (PM, newcomer) gets a legible story before any callstack.
 *
 * Consumers should look terms up through {@link lookupCrashTerm} (never inline a
 * second copy) and read the plain maps below instead of re-deriving labels.
 */

import { type JargonEntry, lookupJargon } from './blueprint-jargon';
import type { CrashType, CrashSeverity } from '@/types/crash-analyzer';

export type { JargonEntry };

// ─── Crash / GAS / engine jargon ─────────────────────────────────────────────
// Terse, jargon-free one-liners. Keep `term` as the human label; the key is the
// raw token a reader will actually see in a message or chip.

const CRASH_TERMS: Record<string, JargonEntry> = {
  GAS: {
    term: 'GAS',
    plain: "Gameplay Ability System — Unreal's framework for abilities, attributes, and effects.",
    whyItMatters: 'Most ability/cooldown/damage crashes trace back to GAS setup order.',
  },
  ASC: {
    term: 'ASC',
    plain: 'Ability System Component — the per-actor object that runs that actor’s abilities.',
    whyItMatters: 'It must be initialized before any ability is used, or activation crashes.',
  },
  AbilitySystemComponent: {
    term: 'AbilitySystemComponent',
    plain: 'The component that grants and activates an actor’s gameplay abilities.',
    whyItMatters: 'Using it before it’s set up (a common race) causes a null-pointer crash.',
  },
  AbilitySpec: {
    term: 'AbilitySpec',
    plain: 'The record of one granted ability on an actor (the ability plus its level/inputs).',
  },
  InitAbilityActorInfo: {
    term: 'InitAbilityActorInfo',
    plain: 'The setup call that wires an actor to its Ability System Component.',
    whyItMatters: 'Abilities used before this runs will crash — it must come first.',
  },
  GameplayCue: {
    term: 'GameplayCue',
    plain: 'A cosmetic effect (sound, particle) triggered by the ability system.',
  },
  GC: {
    term: 'GC',
    plain: 'Garbage Collection — Unreal automatically frees objects nothing is using.',
    whyItMatters: 'Holding a raw pointer to a collected object and then using it crashes.',
  },
  UObject: {
    term: 'UObject',
    plain: 'The base type for most Unreal game objects (managed by garbage collection).',
  },
  TWeakObjectPtr: {
    term: 'TWeakObjectPtr',
    plain: 'A safe, tracked reference that knows when its object has been freed.',
    whyItMatters: 'Use it instead of a raw pointer so you can check validity before use.',
  },
  ensure: {
    term: 'ensure',
    plain: 'A non-fatal safety check — it logs a warning but lets the game keep running.',
    whyItMatters: 'Unlike an assert, an ensure failure won’t crash the player.',
  },
  assertion: {
    term: 'assertion',
    plain: 'A hard safety check — if its condition is false the game stops on purpose.',
    whyItMatters: 'It marks a "this should never happen" assumption that turned out false.',
  },
  Blackboard: {
    term: 'Blackboard',
    plain: 'The shared memory an AI Behavior Tree reads and writes (target, state, etc.).',
  },
  BehaviorTree: {
    term: 'BehaviorTree',
    plain: 'A visual decision graph that drives an AI’s actions.',
  },
  FArchive: {
    term: 'FArchive',
    plain: 'Unreal’s reader/writer used to save and load (serialize) data.',
  },
  serialization: {
    term: 'serialization',
    plain: 'Turning game state into bytes to save, and back again to load.',
    whyItMatters: 'Loading a save written by older code is a common corruption cause.',
  },
  CustomVersion: {
    term: 'CustomVersion',
    plain: 'A version stamp on saved data so newer code can read older save files.',
  },
  nullptr: {
    term: 'nullptr',
    plain: 'An "empty" reference that points at nothing.',
    whyItMatters: 'Using one (a null dereference) is the single most common crash cause.',
  },
  montage: {
    term: 'montage',
    plain: 'An animation sequence that can be played, sectioned, and blended at runtime.',
  },
  replication: {
    term: 'replication',
    plain: 'Keeping a value in sync from the server to every connected client.',
  },
  EXCEPTION_ACCESS_VIOLATION: {
    term: 'EXCEPTION_ACCESS_VIOLATION',
    plain: 'The program touched memory it wasn’t allowed to — usually a bad/empty pointer.',
  },
  EXCEPTION_STACK_OVERFLOW: {
    term: 'EXCEPTION_STACK_OVERFLOW',
    plain: 'Code called itself too many times and ran out of call-stack room.',
  },
};

/**
 * Look up the plain-language entry for a crash/engine term. Checks the crash
 * vocabulary first, then falls back to the base UE5 jargon dictionary. Returns
 * `undefined` for unknown terms (callers fail soft and show the raw term).
 * Matching is case-sensitive — engine tokens are.
 */
export function lookupCrashTerm(term: string): JargonEntry | undefined {
  return CRASH_TERMS[term] ?? lookupJargon(term);
}

/** The full hover string for an entry: plain text + optional "why it matters". */
export function crashTermTooltip(entry: JargonEntry): string {
  return entry.whyItMatters ? `${entry.plain} — ${entry.whyItMatters}` : entry.plain;
}

/**
 * Does this token look like a raw engine identifier (vs. an everyday word)?
 * Used to decide which tokens to auto-decorate inside free-text prose so common
 * words ("the", "memory", "game") are never underlined, while `GAS`,
 * `AbilitySystemComponent`, `TWeakObjectPtr`, and `EXCEPTION_ACCESS_VIOLATION`
 * are. Mirrors `isRawEngineToken` in the blueprint glossary but also accepts
 * short ALL-CAPS acronyms (GAS/GC/ASC) and camel/Pascal humps.
 */
export function isRawCrashToken(term: string): boolean {
  return (
    /_/.test(term) || // EXCEPTION_ACCESS_VIOLATION
    /^[A-Z]{2,6}$/.test(term) || // GAS, GC, ASC, AI, UI, HUD, BT
    /[a-z][A-Z]/.test(term) // camel/Pascal hump: AbilitySystemComponent, TWeakObjectPtr
  );
}

// ─── Plain-language CrashType translations ───────────────────────────────────
// One-line "what happened" + "what to do" for every crash category, written for
// a non-technical reader. The Crash Analyzer leads with the AI diagnosis when
// present and falls back to these so there is ALWAYS a friendly summary.

export interface PlainCrash {
  /** Short human label (sentence case) for the crash category. */
  label: string;
  /** One line: what actually went wrong, in plain English. */
  what: string;
  /** One line: the general direction of the fix. */
  fix: string;
}

export const CRASH_TYPE_PLAIN: Record<CrashType, PlainCrash> = {
  nullptr_deref: {
    label: 'Empty reference used',
    what: 'The game tried to use something that wasn’t there (an empty reference) and shut down.',
    fix: 'Add a safety check before using that object, and make sure it’s created before it’s used.',
  },
  access_violation: {
    label: 'Forbidden memory access',
    what: 'The game tried to read or write memory it wasn’t allowed to, and crashed.',
    fix: 'Track down the invalid pointer or out-of-range index behind it and guard it before use.',
  },
  assertion_failed: {
    label: 'Safety assumption broke',
    what: 'A built-in assumption the code relies on turned out to be false, so it stopped on purpose.',
    fix: 'Look at the failed condition and make sure that assumption holds — or handle when it doesn’t.',
  },
  ensure_failed: {
    label: 'Non-fatal warning',
    what: 'A safety check failed and flagged a problem, but the game kept running.',
    fix: 'It won’t crash the player, but fix the flagged condition so the warning stops.',
  },
  gc_reference: {
    label: 'Freed object reused',
    what: 'The game used an object that had already been cleaned up from memory.',
    fix: 'Hold the object with a tracked reference (or re-fetch it each time) instead of a raw pointer.',
  },
  stack_overflow: {
    label: 'Endless loop',
    what: 'A piece of code kept calling itself without stopping until it ran out of room.',
    fix: 'Find the recursion or loop that never ends and add a stopping condition.',
  },
  out_of_memory: {
    label: 'Out of memory',
    what: 'The game asked for more memory than the machine could give and had to quit.',
    fix: 'Load less at once, or free things you no longer need.',
  },
  unhandled_exception: {
    label: 'Uncaught error',
    what: 'An unexpected error happened that nothing was set up to catch, so the game closed.',
    fix: 'Find the failing operation and handle its error path gracefully.',
  },
  fatal_error: {
    label: 'Fatal error',
    what: 'The game hit an error serious enough that it couldn’t safely continue.',
    fix: 'Read the error message for the specific cause and address it.',
  },
  gpu_crash: {
    label: 'Graphics crash',
    what: 'The graphics card stopped responding and the game lost its display connection.',
    fix: 'Check for heavy or invalid rendering work and reduce GPU load; update drivers if needed.',
  },
  unknown: {
    label: 'Uncategorized crash',
    what: 'The cause of this crash couldn’t be categorized automatically.',
    fix: 'Open the technical details below and inspect the error message and callstack.',
  },
};

// ─── Plain-language severity translations ────────────────────────────────────
// What each severity means for the player + how urgent the fix is.

export interface PlainSeverity {
  label: string;
  meaning: string;
}

export const CRASH_SEVERITY_PLAIN: Record<CrashSeverity, PlainSeverity> = {
  critical: {
    label: 'Critical',
    meaning: 'Crashes the game for the player — fix this first.',
  },
  high: {
    label: 'High',
    meaning: 'Crashes in a common path — high priority.',
  },
  medium: {
    label: 'Medium',
    meaning: 'Can crash under certain conditions — worth fixing soon.',
  },
  low: {
    label: 'Low',
    meaning: 'Minor or non-fatal — fix when convenient.',
  },
};

/** Plain "what happened" + "what to do" for a crash type (never throws). */
export function plainCrashType(type: CrashType): PlainCrash {
  return CRASH_TYPE_PLAIN[type] ?? CRASH_TYPE_PLAIN.unknown;
}

/** Plain meaning + urgency for a severity (never throws). */
export function plainSeverity(sev: CrashSeverity): PlainSeverity {
  return CRASH_SEVERITY_PLAIN[sev] ?? CRASH_SEVERITY_PLAIN.medium;
}
