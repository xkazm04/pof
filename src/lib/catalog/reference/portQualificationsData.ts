/**
 * Companion laws for the PINNED PORT (devilutionX 4138a82): where an engine-derived law assumes a port gameplay option
 * at its default, or quotes behaviour the port marks as its own bug fix (audit cx-b58, W41). One statement per law — the
 * qualified laws keep their bodies verbatim (parsers read them); each companion names the laws it qualifies.
 * Type-only imports: the canon imports these laws directly (see profileImportCycle.test.ts).
 */
import type { ProjectRule } from '@/lib/catalog/canon/types';

const PIN = 'https://github.com/diasurgical/devilutionX/blob/4138a82/Source/';

export interface PortQualificationData {
  id: `d1-port-${string}-law`;
  /** The catalog whose prompts carry it — the scope of the (first) law it qualifies. */
  scope: string;
  title: string;
  /** Canon law ids whose statements assume this option default or quote this port fix. */
  qualifies: readonly string[];
  body: string;
  refs: readonly string[];
}

export const PORT_QUALIFICATIONS_DATA: readonly PortQualificationData[] = [
  {
    id: 'd1-port-tick-rate-law', scope: 'bestiary', title: 'Game speed is a port option',
    qualifies: ['d1-timing-law', 'd1-ai-awareness-law'],
    body: 'The pinned port makes game speed an option (tickRate, default 20 ticks per second). Laws that convert ticks into seconds assume that default; at another setting one tick lasts 1/tickRate seconds. Tick counts themselves — animation frames, the 255-tick awareness counter — do not change with it.',
    refs: [`${PIN}options.h#L573`, `${PIN}options.cpp#L843`, `${PIN}multi.cpp#L609`],
  },
  {
    id: 'd1-port-run-in-town-law', scope: 'player-movement', title: 'Running in town is a port option',
    qualifies: ['d1-player-walk-law', 'd1-timing-law'],
    body: 'The pinned port adds a Run in Town option, off by default (its own description credits running to the expansion). With it on, a hero walking in town skips extra animation frames, so town steps are faster than the walk the walk and timing laws describe. Those laws assume it off.',
    refs: [`${PIN}options.h#L575`, `${PIN}options.cpp#L844`, `${PIN}multi.cpp#L610`],
  },
  {
    id: 'd1-port-quick-cast-law', scope: 'input-schemes', title: 'Quick Cast is a port option',
    qualifies: ['d1-click-context-law'],
    body: 'Quick Cast is a pinned-port option, off by default. With it on, the F5-F8 spell hotkeys cast immediately instead of readying the spell for the right mouse button. The click-context law describes the default.',
    refs: [`${PIN}options.h#L633`, `${PIN}options.cpp#L873`, `${PIN}diablo.cpp#L1872`],
  },
  {
    id: 'd1-port-multiplayer-quests-law', scope: 'bestiary', title: 'Quest-gated monster behaviour follows the full-quest predicate',
    qualifies: ['d1-ai-skeleton-king-law', 'd1-ai-lazarus-law'],
    body: "Quest-gated monster behaviour branches on UseMultiplayerQuests(), not on single- versus multiplayer: single-player always runs the full quests, multiplayer only with the port option Full quests in Multiplayer (off by default). Skeleton King's summoning and Lazarus's encounter branch follow that predicate; the full-quest Lazarus branch also repairs saves hit by an old teleport bug.",
    refs: [`${PIN}options.h#L587`, `${PIN}monster.cpp#L538`, `${PIN}monster.cpp#L1462`, `${PIN}monster.cpp#L2915`],
  },
  {
    id: 'd1-port-crippling-shrines-law', scope: 'props', title: 'Harmful shrines can be disabled in the port',
    qualifies: ['d1-object-operation-law', 'd1-shrine-selection-law', 'd1-status-shrine-spell-mana-mutations-law', 'd1-status-hellfire-shrine-persistent-mutations-law'],
    body: "Disable Crippling Shrines is a pinned-port option, off by default. With it on, Goat Shrines, Cauldrons and the Fascinating, Ornate, Sacred and Murphy's Shrines are made non-interactive before dispatch, so their selection and mutations never happen. The object, shrine-selection and shrine-mutation laws describe the default.",
    refs: [`${PIN}options.h#L631`, `${PIN}options.cpp#L872`, `${PIN}objects.cpp#L3627`],
  },
  {
    id: 'd1-port-friendly-fire-law', scope: 'spellbook', title: 'Friendly fire is a port option',
    qualifies: ['d1-spell-fire-wall-law'],
    body: "Friendly Fire is a pinned-port multiplayer option, on by default. A player's missile harms another player only when Friendly Fire is on or the attacker is in hostile mode, so Fire Wall harming either faction assumes that default. Single-player is unaffected.",
    refs: [`${PIN}options.h#L585`, `${PIN}options.cpp#L849`, `${PIN}multi.cpp#L613`],
  },
  {
    id: 'd1-port-randomize-quests-law', scope: 'quests', title: 'Quest-pool elimination is a port option',
    qualifies: ['d1-quest-selection-law'],
    body: "Randomize Quests is a pinned-port option, on by default; the quest-pool elimination the quest-selection law describes runs only with it on. With it off, the pools eliminate none; shareware/mode restrictions and Zhar's missing-library fallback can still make quests unavailable. The port also handles one known compatibility seed safely where, by its own comment, the original read invalid memory.",
    refs: [`${PIN}options.h#L623`, `${PIN}options.cpp#L868`, `${PIN}quests.cpp#L82`, `${PIN}quests.cpp#L119`],
  },
  {
    id: 'd1-port-damage-fixes-law', scope: 'bestiary', title: 'Two combat laws quote port bug fixes',
    qualifies: ['d1-combat-monster-damage-law', 'd1-spell-fire-wall-law'],
    body: "Two combat laws quote behaviour the pinned port marks as its own fix: monster melee and projectile damage can reach the exact maximum (the port's comment says the old method fell 63/64 short), and Fire Wall's source-level damage ternary carries a fixed parenthesis. The 1996 results are not provable at the pin.",
    refs: [`${PIN}monster.cpp#L1217`, `${PIN}missiles.cpp#L1150`, `${PIN}missiles.cpp#L1964`],
  },
];

export const DIABLO1_PORT_LAWS: readonly ProjectRule[] = PORT_QUALIFICATIONS_DATA.map((law) => ({
  id: law.id,
  profile: 'diablo1',
  category: 'game',
  scope: law.scope,
  title: `${law.title} (pinned port)`,
  body: law.body,
  refs: [...law.refs],
}));
