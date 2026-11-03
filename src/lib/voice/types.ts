/**
 * The voice room's three objects (lane pof-voice): a VOICE per character, the LINE QUEUE (every quest
 * line in chronological play order) and the TAKES generated per line. Human gated: a take verdict and a
 * cast are set only from the Voice room UI (see `gate.ts`); nothing headless approves or casts.
 */

export type VoiceSource = 'designed' | 'stock';
export type VoiceStatus = 'candidate' | 'cast';
/** `superseded` = was approved, replaced by a later approval of another take (history kept). */
export type TakeVerdict = 'pending' | 'approved' | 'rejected' | 'superseded';
/** A line's state in the queue. `proven` = it has an approved take on its CURRENT text. */
export type LineState = 'no-takes' | 'awaiting-verdict' | 'all-rejected' | 'proven';
/**
 * A line's class, recorded per line (registry `game-dialogue-voice-pipeline`: "the line has a class").
 * Basis: the quest schema's own definition (`QuestLine.when` = "condition tags for barks"), so a line with
 * `when` tags is a reactive `bark` and a line without is an authored `story` line played once in its beat.
 */
export type LineClass = 'story' | 'bark';

export interface VoicePreview {
  /** The provider's temporary design id (`generated_voice_id`). */
  generatedVoiceId: string | null;
  file: string;
  durationMs: number | null;
}

export interface VoiceRow {
  id: string;
  gameId: string;
  characterId: string;
  name: string;
  /** The provider voice id usable with text-to-speech; null for a designed preview not yet created. */
  providerVoiceId: string | null;
  source: VoiceSource;
  /** The description sent to voice design (designed), or the casting note (stock). */
  designPrompt: string | null;
  previews: VoicePreview[];
  status: VoiceStatus;
  createdAt: number;
  updatedAt: number;
}

export interface QueueLine {
  gameId: string;
  questId: string;
  lineId: string;
  speaker: string;
  text: string;
  textHash: string;
  purpose: string[];
  lineClass: LineClass;
  /** The package's condition tags (`when`), verbatim; empty for a story line. */
  when: string[];
  /** The beat that speaks this line (`beats[].lineIds`): the scene a direction is written for. */
  beatId: string | null;
  beatTitle: string | null;
  beatSummary: string | null;
  /** Chronological play position: quest order (ledger), then `lines[]` order. */
  questOrder: number;
  lineOrder: number;
  /** False when the line is no longer in its quest package (kept for its takes' history). */
  present: boolean;
  syncedAt: number;
}

export interface TakeSettings {
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

export interface TakeRow {
  id: string;
  gameId: string;
  questId: string;
  lineId: string;
  voiceId: string;
  providerVoiceId: string;
  /** The line text this take was generated from (a later text edit makes the take stale). */
  textHash: string;
  /** The delivery direction in the words used ("whispered, panicking, fast"). */
  direction: string;
  /** Exactly what was sent to the provider (v3: audio tags + text). */
  sentText: string;
  settings: TakeSettings;
  file: string;
  durationMs: number | null;
  loudnessLufs: number | null;
  /** Longest internal silence in ms (a dropout screen); null = unmeasured. */
  maxSilenceMs: number | null;
  /** Billed characters (`sentText.length`). */
  chars: number;
  verdict: TakeVerdict;
  verdictNote: string | null;
  verdictAt: number | null;
  createdAt: number;
}

/** A render with an internal silence longer than this is flagged as a possible dropout (registry
 *  `speech-synthesis-script-writing`: measure the render's silence against its length). */
export const SILENCE_FLAG_MS = 1500;

export interface VerdictEvent {
  takeId: string;
  verdict: TakeVerdict;
  note: string | null;
  at: number;
}

/** One verdict event with the take it judged: the owner's feedback stream the next round is written from. */
export interface VerdictFeedItem extends VerdictEvent {
  questId: string;
  lineId: string;
  voiceId: string;
  direction: string;
  model: string;
}

/** One queue row as the room and the CLI read it. */
export interface QueueEntry extends QueueLine {
  state: LineState;
  takes: number;
  pending: number;
  approvedTakeId: string | null;
}

export interface QuestProgress {
  questId: string;
  title: string;
  questOrder: number;
  proven: number;
  total: number;
}

export interface VoiceStatusView {
  proven: number;
  total: number;
  quests: QuestProgress[];
  next: QueueEntry[];
  chars: number;
}
