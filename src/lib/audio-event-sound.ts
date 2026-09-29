/**
 * Event Catalog ↔ generated-audio library: which sound each event class plays.
 *
 * The catalog authors event classes whose generated `FAudioEventDefinition` has
 * a `SoundCue` slot, yet it had no sound column — the manager prompt asked the
 * CLI to fill 13 cue paths from nothing. Events now bind to a library set by id
 * (`AudioEvent.assetSetId`, the same edge emitters use), and this module holds
 * the pure decisions around that edge:
 *
 *  - `suggestEventSounds` — confident matches only; a tie is reported as
 *    ambiguous, never silently picked; a category only takes kinds it can play.
 *  - `eventSoundCoverage` — imported / bound-not-imported / set-missing /
 *    unbound, or `unknown` when the library could not be read.
 *  - `eventCueLine` — the per-event prompt line: the REAL imported cue path, or
 *    `SoundCue: NONE — PLACEHOLDER …` with the reason. Never an invented path.
 */

import type { AudioEvent, EventCategory } from '@/components/modules/content/audio/AudioEventCatalog/types';
import type { AudioAssetBindings } from '@/lib/audio-codegen';

/** One library set as a binding decision sees it (structurally `AudioSetOption`). */
export interface EventSoundOption {
  id: string;
  name: string;
  kind: string;
  clipCount: number;
  /** Cue path of the set's LAST RECORDED UE import, or `null` — never guessed. */
  cuePath: string | null;
}

/**
 * Which set kinds an event category can play. `tts` appears nowhere: no
 * provider serves it (fleet-memory CONVENTION 2026-09-07), so a tts set is
 * never offered as an event's sound.
 */
export const CATEGORY_KINDS: Record<EventCategory, readonly string[]> = {
  combat: ['sfx'],
  environment: ['sfx', 'ambient'],
  ui: ['sfx'],
  music: ['music'],
};

const NAME_WEIGHT = 2;
const TAG_WEIGHT = 1;

/** Lower-case word tokens (≥ 3 chars), trailing plural `s` folded. */
function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    out.add(raw.length > 3 && raw.endsWith('s') ? raw.slice(0, -1) : raw);
  }
  return out;
}

function score(event: AudioEvent, setTokens: Set<string>): number {
  let s = 0;
  for (const t of tokens(event.name)) if (setTokens.has(t)) s += NAME_WEIGHT;
  for (const t of tokens(event.tags.join(' '))) if (setTokens.has(t)) s += TAG_WEIGHT;
  return s;
}

export interface EventSoundSuggestions {
  /** eventId → the one set that matches best. */
  suggested: Record<string, string>;
  /** eventId → every set tied for best: the user picks, the code never does. */
  ambiguous: Record<string, string[]>;
}

/**
 * Suggest a library set for every UNBOUND event: set-name tokens vs the event's
 * name (weighted) and tags, restricted to kinds the category can play and to
 * sets that actually hold clips.
 */
export function suggestEventSounds(events: readonly AudioEvent[], options: readonly EventSoundOption[]): EventSoundSuggestions {
  const candidates = options
    .filter((o) => o.clipCount > 0)
    .map((o) => ({ o, t: tokens(o.name) }));
  const suggested: Record<string, string> = {};
  const ambiguous: Record<string, string[]> = {};

  for (const evt of events) {
    if (evt.assetSetId) continue;
    const kinds = CATEGORY_KINDS[evt.category] ?? [];
    let best = 0;
    let top: string[] = [];
    for (const { o, t } of candidates) {
      if (!kinds.includes(o.kind)) continue;
      const s = score(evt, t);
      if (s === 0 || s < best) continue;
      if (s > best) { best = s; top = []; }
      top.push(o.id);
    }
    if (top.length === 1) suggested[evt.id] = top[0];
    else if (top.length > 1) ambiguous[evt.id] = top;
  }
  return { suggested, ambiguous };
}

export type EventSoundStatus = 'imported' | 'not-imported' | 'set-missing' | 'unbound' | 'unknown';

/** One event's binding status. `options === null` means the library is unreadable. */
export function eventSoundStatus(event: AudioEvent, options: readonly EventSoundOption[] | null): EventSoundStatus {
  if (!event.assetSetId) return 'unbound';
  if (!options) return 'unknown';
  const set = options.find((o) => o.id === event.assetSetId);
  if (!set) return 'set-missing';
  return set.cuePath ? 'imported' : 'not-imported';
}

export type EventSoundCoverage =
  | { state: 'known'; total: number; imported: number; notImported: number; setMissing: number; unbound: number }
  /** Library unreadable: the bound events' import status is not known — not "unbound". */
  | { state: 'unknown'; total: number; bound: number; unbound: number };

export function eventSoundCoverage(events: readonly AudioEvent[], options: readonly EventSoundOption[] | null): EventSoundCoverage {
  const total = events.length;
  const unbound = events.filter((e) => !e.assetSetId).length;
  if (!options) return { state: 'unknown', total, bound: total - unbound, unbound };
  const c = { imported: 0, notImported: 0, setMissing: 0 };
  for (const e of events) {
    const s = eventSoundStatus(e, options);
    if (s === 'imported') c.imported++;
    else if (s === 'not-imported') c.notImported++;
    else if (s === 'set-missing') c.setMissing++;
  }
  return { state: 'known', total, ...c, unbound };
}

/** The prompt bindings for every bound event whose set is in the library. */
export function eventSoundBindings(events: readonly AudioEvent[], options: readonly EventSoundOption[]): AudioAssetBindings {
  const out: AudioAssetBindings = {};
  for (const e of events) {
    const set = e.assetSetId ? options.find((o) => o.id === e.assetSetId) : undefined;
    if (set) out[set.id] = { setName: set.name, cuePath: set.cuePath };
  }
  return out;
}

/** The per-event `SoundCue:` line of the manager prompt. */
export function eventCueLine(event: AudioEvent, bindings: AudioAssetBindings): string {
  const binding = event.assetSetId ? bindings[event.assetSetId] : undefined;
  if (binding?.cuePath) {
    return `SoundCue: ${binding.cuePath} (recorded UE import of audio set "${binding.setName}")`;
  }
  const why = event.assetSetId
    ? binding
      ? `audio set "${binding.setName}" is bound but has NO recorded UE import`
      : `bound to audio set ${event.assetSetId}, which is not in the library`
    : 'no library sound is bound to this event';
  return `SoundCue: NONE — PLACEHOLDER (${why}); leave SoundCue null and log a warning when the event fires`;
}
