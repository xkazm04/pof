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

/**
 * Why a take is NOT the current take of its line (`staleReason` in `lineQueue.ts`, the one place this is
 * decided). A render is bound to everything that produced it (registry `game-dialogue-voice-pipeline`):
 *  - `text-edited`: the line's text changed after the take spoke it.
 *  - `wrong-speaker`: the take's voice belongs to another character than the line's speaker now (the quest
 *    package reassigned the line), or has no voice row at all.
 *  - `recast`: the speaker has a cast voice and it is a different one.
 *  - `audition`: the speaker has NO cast voice yet. The take may be generated and heard (that is how the owner
 *    auditions a candidate on real lines) but never proves a line: no line renders against a voice with no
 *    ledger row (registry `game-dialogue-voice-pipeline`). Cast the speaker first.
 *  - `profile-changed`: the take's recipe (model, speed, stability, style) differs from its voice's CURRENT take
 *    profile, so it no longer sounds like what the owner decided for that voice (`takeProfile.ts`).
 */
export type StaleReason = 'text-edited' | 'wrong-speaker' | 'recast' | 'audition' | 'profile-changed';

/** The reason in words, for the room (client-safe: no node imports here). */
export const STALE_REASON_WORDS: Record<StaleReason, string> = {
  'text-edited': 'stale: the line text changed after this take',
  'wrong-speaker': "stale: this voice is not the line's speaker (the line was reassigned)",
  recast: "stale: not the speaker's cast voice",
  audition: 'audition: the speaker has no cast voice yet, so this take cannot prove the line',
  'profile-changed': "stale: rendered with a recipe that is not the voice's take profile now",
};

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
  /** The render recipe decided for this voice (set on the Cast tab, gated); null/absent = none decided. */
  takeProfile?: TakeProfile | null;
}

/** A cast voice's take profile: the settings every take for it defaults to, and an approval is bound to. */
export interface TakeProfile {
  model: string;
  speed: number;
  stability: number;
  style: number;
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
  /** What a local Whisper heard (the read-back ear proxy); null = not read back (yet). */
  readbackText: string | null;
  /** Word error rate of `readbackText` against the line text (0..1+); null = not read back. */
  readbackWer: number | null;
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

/** A take whose read-back word error rate is above this is flagged "listen for garbled words". Basis: the
 *  game audio lane's Whisper read-back of the 23 temp quest-1 voices averaged 2.9 % and its one real fault
 *  (a stray TTS syllable) stood out; number words vs digits and names can cost a few points on clean takes. */
export const READBACK_FLAG_WER = 0.15;

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
  /** Takes of this line that are auditions (the speaker has no cast voice): heard, never proven. */
  auditions: number;
  /** Current takes a screen flags: read-back over READBACK_FLAG_WER or a pause over SILENCE_FLAG_MS. */
  flagged: number;
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
  /** Lines with at least one flagged current take (listen for garbled words / a dropout). */
  flaggedLines: number;
  /** Speakers with present lines and no cast voice, in order of first appearance (`castingDemand`). */
  needsVoice: SpeakerDemand[];
}

/** One speaker's demand on casting: how many present lines they speak, and whether a voice is cast for them. */
export interface SpeakerDemand {
  speaker: string;
  story: number;
  bark: number;
  lines: number;
  /** Where the speaker first appears in play order. */
  firstQuestId: string;
  firstLineId: string;
  cast: { voiceId: string; name: string } | null;
}

/** Casting's view of the line queue: who speaks, who is cast, and which cast voices speak nothing. */
export interface CastingDemand {
  /** Every speaker with a present line, first appearance first. */
  speakers: SpeakerDemand[];
  /** The speakers with no cast voice (a subset of `speakers`, same order). */
  needsVoice: SpeakerDemand[];
  /** Cast voices whose character speaks no present line. */
  castWithoutLines: Array<{ characterId: string; voiceId: string; name: string }>;
}
