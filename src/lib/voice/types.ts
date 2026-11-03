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
  /** Billed characters (`sentText.length`). */
  chars: number;
  verdict: TakeVerdict;
  verdictNote: string | null;
  verdictAt: number | null;
  createdAt: number;
}

export interface VerdictEvent {
  takeId: string;
  verdict: TakeVerdict;
  note: string | null;
  at: number;
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
