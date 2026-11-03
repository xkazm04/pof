/**
 * Design decisions — the wire shape of the Game home's "Decisions" room (client-safe: no fs).
 *
 * Day lanes ask the owner a design question by writing `<root>/asks/<lane>-<n>.json`
 * (`{ id, lane, question, options: [{ key, label, tradeoff, frames: [abs paths] }], default, asked }`); the owner
 * answers in the page; the answer lands in `<root>/answers.json` (`{ answers: [{ id, choice, note, at }] }`).
 * Those two on-disk shapes belong to the lanes: nothing here renames a field of either.
 *
 * Absent-value convention: OMIT a key for "not there" (`answer`, `default`, `reason`); `null` is not used.
 */

export type MediaKind = 'image' | 'video';

export interface DecisionMedia {
  kind: MediaKind;
  /** Base name, for the caption. */
  name: string;
  /** Served by the media door; omitted when the file cannot be served (see `unservable`). */
  url?: string;
  /** Why this path is not shown: missing on disk, unsupported type, a directory. Never silently dropped. */
  unservable?: string;
}

export interface DecisionOption {
  key: string;
  label: string;
  tradeoff: string;
  media: DecisionMedia[];
}

export interface DecisionAnswer {
  choice: string;
  note: string;
  at: string;
}

export interface DecisionView {
  id: string;
  lane: string;
  question: string;
  options: DecisionOption[];
  /** The lane's own default (an option key); omitted when the ask gave none or an unknown key. */
  default?: string;
  asked: string;
  answer?: DecisionAnswer;
}

/** An ask file that could not be used, with the reason; the room lists it instead of hiding it. */
export interface DecisionProblem {
  file: string;
  reason: string;
}

export interface DecisionsBoard {
  gameId: string;
  /** Server clock at read time (the client never reads one). */
  readAt: string;
  configured: boolean;
  reason?: string;
  root?: string;
  /** Unanswered, newest first. */
  open: DecisionView[];
  /** Answered, newest answer first. */
  answered: DecisionView[];
  problems: DecisionProblem[];
}

export const ANSWER_NOTE_MAX = 2000;
