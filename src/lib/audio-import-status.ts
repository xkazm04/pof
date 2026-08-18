/**
 * Pure reading of what `audio_import_runs` actually records for an audio set.
 *
 * "Import to UE" used to be write-only: the CLI callback persisted a full result
 * (`assetsImported` / `cuePath` / `wiredEvent`), the GET route exposed it, and NO
 * UI consumed it — the only feedback was a spinner clearing, which reads as
 * "done" whatever happened. This module turns a stored row (or its absence) into
 * an honest verdict the Library renders.
 *
 * Rule-4 honesty: an import whose result was never recorded is UNVERIFIED, never
 * assumed successful. Client-safe (no node/db imports) so the panel can use it.
 */
import type { AudioImportResult } from '@/types/audio-import';

export type ImportState = 'never' | 'unverified' | 'imported';

/**
 * Result of checking the UE project for the importer script the dispatch drives.
 * Lives here (not in the server-only `audio-import-preflight`, which statically
 * imports `node:fs`) so the client panel can type the API response.
 */
export interface AudioImportPreflight {
  /** True only when the script was found on disk. Dispatch is gated on this. */
  ok: boolean;
  ueRoot: string | null;
  scriptRelPath: string;
  /** Absolute path checked, or null when no UE root could be resolved. */
  scriptAbsPath: string | null;
  scriptPresent: boolean;
  /** Human reason — always populated, including on success. */
  reason: string;
}

export interface ImportStatusView {
  state: ImportState;
  /** Short line rendered next to the set. */
  headline: string;
  /** The evidence (or the absence of it) behind {@link headline}. */
  detail: string;
  /** The recorded cue path, when one was reported. */
  cuePath: string | null;
  /** The AnimNotify the script reported wiring, when it reported one. */
  wiredEvent: string | null;
}

/** UTC stamp for a recorded run — deterministic (no locale, no `Date.now()` in render). */
export function importedAtLabel(createdAt: number): string {
  return `${new Date(createdAt).toISOString().slice(0, 16).replace('T', ' ')}Z`;
}

/**
 * Classify a set's last import run. `null` (no row) is NEVER treated as success.
 *
 * - `never`      — nothing was ever recorded for this set.
 * - `unverified` — a run was recorded but it reported no cue path (or zero clips),
 *                  so nothing confirms a USoundCue exists in UE.
 * - `imported`   — a cue path was reported; wiring is stated separately because a
 *                  cue with no AnimNotify wired is a real, partial outcome.
 */
export function describeImport(rec: AudioImportResult | null): ImportStatusView {
  if (!rec) {
    return {
      state: 'never',
      headline: 'Never imported',
      detail: 'No import result recorded for this set — nothing in UE is claimed.',
      cuePath: null,
      wiredEvent: null,
    };
  }
  const when = importedAtLabel(rec.createdAt);
  if (!rec.cuePath || rec.assetsImported <= 0) {
    return {
      state: 'unverified',
      headline: 'Import not verified',
      detail:
        `Last run ${when} reported ${rec.assetsImported} clip(s) and ` +
        `${rec.cuePath ? 'a cue path' : 'no cue path'} — nothing confirms a USoundCue exists in UE.`,
      cuePath: rec.cuePath,
      wiredEvent: rec.wiredEvent,
    };
  }
  return {
    state: 'imported',
    headline: `Imported ${when}`,
    detail:
      `${rec.assetsImported} clip(s) → ${rec.cuePath} · ` +
      (rec.wiredEvent ? `wired to ${rec.wiredEvent}` : 'no AnimNotify wiring reported'),
    cuePath: rec.cuePath,
    wiredEvent: rec.wiredEvent,
  };
}
