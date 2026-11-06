/**
 * GTAI quest loop — the wire contract (spark `gta-quest-loop`, 2026-11-02).
 *
 * One quest flows: council PROPOSAL (`gtai.questProposal/1`, 2 seats x 2 variants) -> owner FUSION in the
 * 4-path artifact -> quest PACKAGE (`gtai.quest/1`, `games/gtai/quests/<id>/quest.json`) -> Godot runtime.
 * PoF's guards score proposals AND packages through the shared `QuestDesign` core, so a path is pre-scored
 * before the owner sees it and re-scored after fusion.
 *
 * Absent-value convention (stated once): OMIT a key for "not applicable" (`location`, `when`). `null` is a
 * claim: `timeLimitS: null` = no timer; `audio: null` = no voice recorded yet; `newMechanic: null` = the
 * quest adds no mechanic. A guard that could not measure reports `state: 'unmeasured'` — never green,
 * never red. Numbers in `quest-economy.json` are PROVISIONAL (owner-tunable) and every economy verdict's
 * `basis` names the table revision it was scored against.
 */

export const QUEST_SCHEMA = 'gtai.quest/1' as const;
export const QUEST_PROPOSAL_SCHEMA = 'gtai.questProposal/1' as const;
export const QUEST_ECONOMY_SCHEMA = 'gtai.questEconomy/1' as const;
export const LINE_JUDGE_SCHEMA = 'gtai.lineJudge/1' as const;

/** The campaign parts from pitch.md §2, in play order. */
export type ActId = 'prologue' | 'clock-out' | 'act1' | 'act2' | 'act3' | 'act4' | 'finale';
export const ACT_IDS: readonly ActId[] = ['prologue', 'clock-out', 'act1', 'act2', 'act3', 'act4', 'finale'];

/** Why a line exists. "No line is filler": every line carries at least one purpose and must earn it. */
export type LinePurpose = 'funny' | 'character' | 'progression';
export const LINE_PURPOSES: readonly LinePurpose[] = ['funny', 'character', 'progression'];

export interface QuestLine {
  /** Unique inside the quest, kebab: `fax-intro-1`. */
  id: string;
  /** Character id (a `QuestCharacter.id`), e.g. `don-fax`, `rivet`, `dent`. */
  speaker: string;
  /** Non-empty. */
  purpose: readonly LinePurpose[];
  text: string;
  /** Condition tags for barks: `soul:tonnage`, `madness:choir`, `heat:>=3`. Omit = always. */
  when?: readonly string[];
  /** The voice file the game plays (`res://assets/audio/voice/...ogg`, read as a String by the game's
   *  `quest_voice.gd`). `null` = not recorded. Written by the Voice room export (or the audio lane's temp pass). */
  audio: null | string;
  /** Which approved take the Voice room exported to `audio` (absent for a temp voice). */
  audioTake?: { takeId: string; voiceId: string; model: string };
}

export type CharacterStatus = 'existing' | 'new';
export type CharacterRole = 'giver' | 'target' | 'ally' | 'voice' | 'bystander' | 'antagonist';

export interface QuestCharacter {
  /** Kebab id; for existing cast it matches the cast list (`don-fax`, `lady-cathode`, `general-krump`). */
  id: string;
  name: string;
  status: CharacterStatus;
  role: CharacterRole;
  /** One-line look for the art pass (top-down cutout parts). Required for `new`. */
  designNote?: string;
}

export interface QuestObjective {
  /** The core verb: `steal`, `escort`, `assassinate`, `deliver`, `defend`, `hijack`, ... */
  verb: string;
  target?: string;
  location?: string;
  /** Seconds for timed verbs (`survive`, `defend`). Omit for untimed verbs. */
  durationS?: number;
}

export interface QuestBeat {
  id: string;
  title: string;
  summary: string;
  objective: QuestObjective;
  /** Ids of lines spoken in this beat (each must exist in `lines`). */
  lineIds: readonly string[];
}

/** Where the save engine may checkpoint a quest (owner 2026-11-03). The quest's end is always an autosave, declared or not. */
export interface AutosavePoint {
  /** Unique inside the quest, kebab: `as-b2-payphone`. */
  id: string;
  /** A `QuestBeat.id` in this quest. */
  beat: string;
  at: 'start' | 'end';
  /** One sentence: what replaying from here saves the player. */
  why: string;
}

export interface QuestMechanic {
  id: string;
  name: string;
  status: 'existing' | 'new';
  /** Where it must be built: the game runtime, or PoF (quest management tooling). */
  home: 'game' | 'pof';
  summary: string;
}

export interface QuestReward {
  /** Cash paid on success (the one soft currency, pitch §7). */
  cash: number;
  /** Unlock ids granted: `soul:dent`, `upgrade:dent-overload`, `weapon:smg`, `giver:vend-etta`. */
  unlocks: readonly string[];
}

export interface QuestDifficulty {
  /** Peak wanted heat the quest forces or allows (0-6; 6 = Krump's army). */
  heatPeak: number;
  /** Total hostile actors across the quest. */
  enemyCount: number;
  enemyWaves: number;
  /** `null` = no timer. */
  timeLimitS: number | null;
  /** How the quest can fail, in words: `target escapes`, `car destroyed`. Non-empty. */
  failStates: readonly string[];
  /** Expected play minutes for a first attempt. */
  minutes: number;
}

/** A write the quest makes to campaign state (a variable in the baseline story graph). */
export interface QuestStoryWrite {
  var: string;
  value: unknown;
}

export interface QuestStoryHook {
  /** Campaign variables the quest requires (read), e.g. `soul_dent_unlocked`. */
  reads: readonly string[];
  writes: readonly QuestStoryWrite[];
}

/** What makes this quest unlike every other one. Uniqueness compares these. */
export interface QuestFingerprint {
  giver: string;
  coreVerb: string;
  /** The mechanic this quest introduces, or `null` when it reuses only existing ones. */
  newMechanic: string | null;
  location: string;
  /** What the player gets out of it, as a kind: `soul-unlock`, `betrayal-clue`, `boss-kill`, `gag`. */
  payoffKind: string;
}

/** The core both a proposal and a package carry. Every guard takes this. */
export interface QuestDesign {
  act: ActId;
  title: string;
  /** One sentence. */
  logline: string;
  /** The high-level story goal: what this quest does for the campaign and its characters. */
  goal: string;
  /** Why this is not filler: the specific laugh, reveal or character turn it delivers. */
  whyNotFiller: string;
  characters: readonly QuestCharacter[];
  beats: readonly QuestBeat[];
  /**
   * Checkpoints the designer places at beat boundaries, each with a reason. Required by the `autosave` guard for
   * every design made on or after 2026-11-04 (earlier packages are warned). Omit = none declared.
   */
  autosavePoints?: readonly AutosavePoint[];
  lines: readonly QuestLine[];
  mechanics: readonly QuestMechanic[];
  reward: QuestReward;
  difficulty: QuestDifficulty;
  story: QuestStoryHook;
  fingerprint: QuestFingerprint;
  /**
   * The arc beat this quest REALISES: a campaign-graph beat id in the quest's own act, e.g. `act1.soul-1`
   * (souls are learned through quests, pitch §2). The quest then owns that beat's variables and must write
   * them; one quest per beat; a beat touching protected canon is never claimable. Omit = realises no beat.
   */
  claimsBeat?: string;
}

export type CouncilSeat = 'claude' | 'grok';
export type ProposalVariant = 'A' | 'B';

/** A council path. A = in the act's expected tone; B = a deliberate swerve (different giver/verb/payoff). */
export interface QuestProposal extends QuestDesign {
  schema: typeof QUEST_PROPOSAL_SCHEMA;
  seat: CouncilSeat;
  variant: ProposalVariant;
  /** `<seat>-<variant>`, e.g. `grok-B`. */
  pathId: string;
}

export type QuestStatus = 'planned' | 'building' | 'built' | 'accepted';

/** Which proposal elements the owner kept, from the fuse artifact. */
export interface FusionSource {
  pathId: string;
  /** Element keys kept: `spine`, `giver`, `beat:<id>`, `line:<id>`, `mechanic:<id>`, `character:<id>`. */
  elements: readonly string[];
}

export type GuardId = 'story' | 'economy' | 'lines' | 'uniqueness' | 'vocabulary' | 'autosave';
export const GUARD_IDS: readonly GuardId[] = ['story', 'economy', 'lines', 'uniqueness', 'vocabulary', 'autosave'];
/** Guards an owner override cannot waive: the runtime refuses the package at its boundary whatever the owner says (vocabulary), or the save engine reads the points as written (autosave). */
export const NON_OVERRIDABLE_GUARDS: readonly GuardId[] = ['vocabulary', 'autosave'];

export interface GuardOverride {
  guard: GuardId;
  reason: string;
  /** ISO date. */
  at: string;
}

export interface QuestPackage extends QuestDesign {
  schema: typeof QUEST_SCHEMA;
  /** Kebab, stable, equals the folder name under `games/gtai/quests/`. */
  id: string;
  status: QuestStatus;
  provenance: {
    sources: readonly FusionSource[];
    /**
     * The council run the fusion came from (`games/gtai/quests/_council/<runId>/`). The fuse artifact always
     * records it and `/gta --quest` always writes it; when ABSENT the contracts Council step infers the run
     * (and reports "ambiguous" if several match), because path ids like `claude-A` repeat across runs.
     */
    runId?: string;
    /** The owner's fusion notes, verbatim. */
    ownerNotes: string;
    fusedAt: string;
  };
  /** Owner overrides of red guards, each with its reason. A red guard without one blocks. */
  overrides: readonly GuardOverride[];
}

export type GuardState = 'green' | 'red' | 'unmeasured';
export type FindingSeverity = 'error' | 'warn' | 'info';

export interface GuardFinding {
  /** SCREAMING_SNAKE code, stable across runs. */
  code: string;
  severity: FindingSeverity;
  message: string;
  /** What it points at: a line id, beat id, variable name or other quest id. */
  ref?: string;
}

export interface GuardVerdict {
  guard: GuardId;
  /** red iff any `error` finding; unmeasured iff the guard lacked its input. */
  state: GuardState;
  /** What it was measured against, e.g. `quest-economy.json r1 (provisional)`. */
  basis: string;
  findings: readonly GuardFinding[];
}

export interface QuestVerdict {
  /** Package id, or proposal `pathId`. */
  subject: string;
  guards: readonly GuardVerdict[];
  /** Guards that are red AND not overridden. */
  blockedBy: readonly GuardId[];
  blocked: boolean;
}

// ── The runtime vocabulary (`<gameRoot>/project/data/tables/quest_rules.json`, `gtai.quest-rules/2`) ──

export const QUEST_RULES_SCHEMA = 'gtai.quest-rules/2' as const;

export interface RuleVerb {
  id: string;
  needsTarget: boolean;
  needsLocation: boolean;
  needsEncounter: boolean;
  /** The verb's handler is `enter_vehicle`: its target is a vehicle tag; any other target is an actor tag (the runtime's rule). */
  targetIsVehicle: boolean;
}

/** The tags of a quest's places table (`gtai.questMarkers/1`), projected to the names a package may use. */
export interface QuestPlaces {
  markers: readonly string[];
  vehicles: readonly string[];
  actors: readonly string[];
  /** Markers that hold a combat encounter. */
  encounters: readonly string[];
}

/** A bark condition kind (`soul:`, `heat:`): a closed `values` list, or a `pattern` for the open ones. */
export interface RuleCondition {
  id: string;
  values?: readonly string[];
  pattern?: string;
}

export interface RuleFailRule {
  id: string;
  /** Keyword groups; a phrase matches when every group has a whole-word hit. */
  groups: readonly (readonly string[])[];
}

/** What the game runtime plays, projected from `quest_rules.json` to what PoF guards need. */
export interface QuestRules {
  schema: typeof QUEST_RULES_SCHEMA;
  verbs: readonly RuleVerb[];
  conditions: readonly RuleCondition[];
  /** Bare event-tag ids a line's `when` may carry. */
  eventTags: readonly string[];
  failRules: readonly RuleFailRule[];
}

// ── Provisional per-act balance table (`games/gtai/balance/quest-economy.json`) ──

export interface ActEconomy {
  /** Cash band a single quest in this act should pay. */
  cash: { min: number; max: number };
  heatCeiling: number;
  enemyCount: { max: number };
  enemyWaves: { max: number };
  minutes: { min: number; max: number };
  timerAllowed: boolean;
}

export interface QuestEconomyTable {
  schema: typeof QUEST_ECONOMY_SCHEMA;
  revision: number;
  provisional: boolean;
  note: string;
  acts: Record<ActId, ActEconomy>;
  /** Soul upgrade tier prices, the main cash sink. */
  soulUpgradePrices: readonly number[];
}

// ── Cross-family line judge output (`verdicts/lines.judge.json`, written by council.mjs judge mode) ──

export interface LineJudgement {
  lineId: string;
  /** 1-5: does the line earn each purpose it claims? */
  earned: number;
  /** 1-5: fit to the speaker's voice bible. */
  voiceFit: number;
  note: string;
}

export interface LineJudgeReport {
  schema: typeof LINE_JUDGE_SCHEMA;
  /** The judging seat; must differ from the seat that wrote the lines. */
  judgeSeat: CouncilSeat;
  authorSeat: CouncilSeat;
  judgedAt: string;
  lines: readonly LineJudgement[];
}

/** Inputs every guard run needs, loaded by the server (packages/table/voices are files; guards stay pure). */
export interface QuestGuardContext {
  economy: QuestEconomyTable | null;
  /** Speaker ids that have a voice bible in `games/gtai/voices/`. */
  voiceBibles: ReadonlySet<string>;
  /** Existing cast ids (pitch §3 + every accepted package's characters). */
  cast: ReadonlySet<string>;
  /** Every other quest package (uniqueness + story merge order). */
  ledger: readonly QuestPackage[];
  /** Cross-family judge report for this subject, if one ran. */
  judge: LineJudgeReport | null;
  /** The runtime's playable vocabulary (`quest_rules.json` in the game repo); `null` = not readable, the vocabulary guard is unmeasured. */
  rules: QuestRules | null;
  /** Places tables the game has staged, by quest id; a quest with none yet is not place-checked (the world supplies them later). */
  places?: ReadonlyMap<string, QuestPlaces>;
}
