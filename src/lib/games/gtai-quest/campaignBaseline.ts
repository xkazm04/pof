/**
 * GTAI campaign baseline — the cast, the owner arc and the campaign variables, transcribed from
 * `games/gtai/pitch.md` §2-4 (baseline v1, 2026-11-01). Pure data; the story guard builds the
 * `pof.storygraph/1` campaign graph from it (`storyGuard.ts`).
 *
 * Every variable names its owning writer node(s): one authority per quantity, the
 * state-variable declaration contract of the registry's branching-narrative-graph-validation
 * subject. The two PROTECTED variables carry the open canon (betrayer, act-antagonist order). Their `writers` list is EMPTY: no node, and so no quest, may write them;
 * only the owner resolves them by editing this baseline. The structural validator accepts an
 * empty `writers` (a variable never read or written raises nothing), so no sentinel is needed.
 *
 * The souls are the four ghosts in story order (owner, 2026-11-06): Dent, Tonnage, Kerf, Ohm. That one
 * unlocks per act is still the pitch's [proposal]; the old souls Gearbox, Sentry and Hauler are descoped.
 */

import type { ActId } from '@/lib/games/gtai-quest/types';
import type { StoryVarType } from '@/lib/story/types';

export type CastKind = 'protagonist' | 'soul' | 'antagonist' | 'boss' | 'giver' | 'voice';

export interface CastMember {
  id: string;
  name: string;
  kind: CastKind;
}

/** Every named character in pitch §3 and §4 (the souls are the four ghosts, in story order). */
export const GTAI_CAST: readonly CastMember[] = [
  { id: 'rivet', name: 'Rivet', kind: 'protagonist' },
  { id: 'general-krump', name: 'General Krump', kind: 'antagonist' },
  { id: 'king', name: 'King', kind: 'boss' },
  { id: 'servo', name: 'Servo', kind: 'boss' },
  { id: 'torque', name: 'Torque', kind: 'boss' },
  { id: 'kronk', name: 'Kronk', kind: 'boss' },
  { id: 'lady-cathode', name: 'Lady Cathode', kind: 'giver' },
  { id: 'don-fax', name: 'Don Fax', kind: 'giver' },
  // Don Fax's place (owner, 2026-11-02, pitch §3): each has a side questline. Names are working titles.
  { id: 'nurse', name: 'Nurse', kind: 'giver' },
  { id: 'gunsmith', name: 'Gunsmith', kind: 'giver' },
  { id: 'scientist', name: 'Scientist', kind: 'giver' },
  { id: 'big-lenny-lift', name: 'Big Lenny Lift', kind: 'giver' },
  { id: 'vend-etta', name: 'Vend-Etta', kind: 'giver' },
  { id: 'sister-suction', name: 'Sister Suction', kind: 'giver' },
  { id: 'the-valet', name: 'The Valet', kind: 'giver' },
  { id: 'brick-daddy', name: 'Brick Daddy', kind: 'giver' },
  { id: 'father-piston', name: 'Father Piston', kind: 'giver' },
  { id: 'chef-guillotine', name: 'Chef Guillotine', kind: 'giver' },
  { id: 'nursie-9000', name: 'Nursie-9000', kind: 'giver' },
  { id: 'chad-9000', name: 'Chad-9000', kind: 'giver' },
  { id: 'mc-crumbtray', name: 'MC Crumbtray', kind: 'voice' },
  { id: 'patch', name: 'Patch', kind: 'voice' },
  { id: 'filibuster', name: 'Filibuster', kind: 'antagonist' },
  { id: 'the-pundit', name: 'The Pundit', kind: 'antagonist' },
  { id: 'whip-hand', name: 'Whip Hand', kind: 'antagonist' },
  { id: 'core-zero', name: 'CORE-ZERO', kind: 'voice' },
  { id: 'dent', name: 'Dent', kind: 'soul' },
  { id: 'tonnage', name: 'Tonnage', kind: 'soul' },
  { id: 'kerf', name: 'Kerf', kind: 'soul' },
  { id: 'ohm', name: 'Ohm', kind: 'soul' },
];

/** The soul each act unlocks: the ghosts in the owner's story order (2026-11-06), one per act (pitch §4 [proposal]). */
export const ACT_SOUL: Readonly<Partial<Record<ActId, string>>> = {
  act1: 'dent',
  act2: 'tonnage',
  act3: 'kerf',
  act4: 'ohm',
};

export interface ArcBeat {
  /** Node id in the campaign graph: `<act>.<slug>`. */
  id: string;
  title: string;
  /** `[owner]` = the owner's decision; `[proposal]` = a host direction that stands until overridden. */
  tag: '[owner]' | '[proposal]';
  /** Campaign variables this beat writes (`set true`) on its outgoing edge. */
  writes: readonly string[];
}

export interface ArcAct {
  act: ActId;
  title: string;
  beats: readonly ArcBeat[];
}

/** The arc in `ACT_IDS` order (pitch §2 arc table). */
export const GTAI_ARC: readonly ArcAct[] = [
  { act: 'prologue', title: 'Prologue', beats: [
    { id: 'prologue.line-accident', title: 'Line accident', tag: '[owner]', writes: [] },
    { id: 'prologue.police-takedown', title: 'Police takedown', tag: '[owner]', writes: [] },
  ] },
  { act: 'clock-out', title: 'Clock-Out', beats: [
    { id: 'clock-out.tutorial', title: 'Movement and combat on the remaining police', tag: '[owner]', writes: [] },
  ] },
  { act: 'act1', title: 'Act 1', beats: [
    { id: 'act1.soul-1', title: 'Soul 1 (Dent) unlocks', tag: '[proposal]', writes: ['soul_dent_unlocked'] },
    { id: 'act1.krump-radio', title: 'Krump on the radio', tag: '[owner]', writes: [] },
  ] },
  { act: 'act2', title: 'Act 2', beats: [
    { id: 'act2.soul-2', title: 'Soul 2 (Tonnage) unlocks', tag: '[proposal]', writes: ['soul_tonnage_unlocked'] },
  ] },
  { act: 'act3', title: 'Act 3', beats: [
    { id: 'act3.twist', title: 'Twist revealed: the military is behind it', tag: '[owner]', writes: ['twist_revealed'] },
    { id: 'act3.betrayal', title: 'A friendly boss betrays Rivet', tag: '[owner]', writes: ['betrayal_happened'] },
    { id: 'act3.krump-hostile', title: "Krump's radio turns hostile", tag: '[proposal]', writes: ['krump_hostile'] },
    { id: 'act3.soul-3', title: 'Soul 3 (Kerf) unlocks', tag: '[proposal]', writes: ['soul_kerf_unlocked'] },
  ] },
  { act: 'act4', title: 'Act 4', beats: [
    { id: 'act4.soul-4', title: 'Soul 4 (Ohm) unlocks', tag: '[proposal]', writes: ['soul_ohm_unlocked'] },
  ] },
  { act: 'finale', title: 'Finale', beats: [
    { id: 'finale.pentagon-raid', title: 'Pentagon raid', tag: '[owner]', writes: [] },
  ] },
];

/** The declared ending node (inside the finale container). The punchline itself is [open]. */
export const ENDING_NODE = 'finale.ending';

export interface BaselineVariable {
  name: string;
  type: StoryVarType;
  values?: readonly unknown[];
  initial: unknown;
  writers: readonly string[];
  doc: string;
}

const owned = (name: string): string[] =>
  GTAI_ARC.flatMap((a) => a.beats).filter((b) => b.writes.includes(name)).map((b) => b.id);

const flag = (name: string, doc: string): BaselineVariable => ({ name, type: 'bool', initial: false, writers: owned(name), doc });

/** Owner-only open canon: no quest writer, ever. */
export const PROTECTED_VAR_NAMES = ['betrayer', 'act_antagonist_order'] as const;

export const BASELINE_VARIABLES: readonly BaselineVariable[] = [
  flag('soul_dent_unlocked', 'Soul 1 (Dent, the crash-test ghost) is available.'),
  flag('soul_tonnage_unlocked', 'Soul 2 (Tonnage, the stamping-press ghost) is available.'),
  flag('soul_kerf_unlocked', 'Soul 3 (Kerf, the laser-cutter ghost) is available.'),
  flag('soul_ohm_unlocked', 'Soul 4 (Ohm, the elder spot-welder ghost) is available.'),
  flag('twist_revealed', 'The player knows the US military is behind it.'),
  flag('krump_hostile', "Krump's radio has turned hostile."),
  flag('betrayal_happened', 'A friendly boss has betrayed Rivet (who is protected).'),
  { name: 'betrayer', type: 'enum', values: ['unresolved', 'don-fax', 'vend-etta'], initial: 'unresolved', writers: [], doc: 'PROTECTED: the betrayer (owner-only).' },
  { name: 'act_antagonist_order', type: 'enum', values: ['unresolved'], initial: 'unresolved', writers: [], doc: 'PROTECTED: act-antagonist order (owner-only).' },
];

/** The act whose owner beat first writes each baseline variable (protected ones have none). */
export function firstWriterAct(name: string): ActId | null {
  for (const a of GTAI_ARC) if (a.beats.some((b) => b.writes.includes(name))) return a.act;
  return null;
}
