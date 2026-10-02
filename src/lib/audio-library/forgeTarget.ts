import type { AudioAsset, AudioSet } from '@/types/audio-asset';
import type { AudioKind, AudioProvider } from '@/lib/audio-gen/types';
import { supportsKind, unsupportedReason } from '@/lib/audio-gen/capabilities';

/**
 * Where a Sound Forge run lands, decided BEFORE any billed call.
 *
 * The Forge used to post a free-text set name with no knowledge of the library:
 * every run restarted at `(variation 1)`, so re-running a prompt returned the
 * cached takes (0 new), and a changed prompt under a taken name minted a SECOND
 * set of that name (`upsertSet` keys on id only). Import status, emitter cue
 * paths and the UE folder `/Game/Audio/<setName>/` are all keyed by name, so a
 * twin corrupts all three. Here a taken name resolves to the set it names, the
 * numbering continues past every take the set already holds, and an ambiguous
 * or unservable target is refused with zero request bodies.
 */

export type ForgeTarget =
  | {
      mode: 'existing';
      setId: string;
      set: AudioSet;
      /** Takes the set holds now. */
      takeCount: number;
      /** First free take number: max(highest parsed `(variation N)`, takeCount) + 1. */
      nextIndex: number;
      /** Every prompt already stored in the set — a planned prompt never equals one. */
      existingPrompts: string[];
      matchedBy: 'selection' | 'name';
    }
  | { mode: 'new'; name: string }
  | { mode: 'ambiguous'; name: string; candidates: string[] };

export interface ForgeForm {
  prompt: string;
  variations: number;
  kind: AudioKind;
  eventKey: string;
  surface: string;
  loop: boolean;
  /** Seconds; 0 or less means "provider chooses" and is omitted from the body. */
  durationSeconds: number;
}

/** The exact POST /api/audio-gen body for one take (the route contract, unchanged). */
export interface ForgeRequestBody {
  provider: string;
  kind: AudioKind;
  prompt: string;
  durationSeconds?: number;
  loop: boolean;
  setId?: string;
  setName: string;
  eventKey?: string;
  surface?: string;
}

/** A form value the target set overrides (the set's own metadata wins). */
export interface LockedField {
  field: 'kind' | 'eventKey' | 'surface' | 'loop';
  formValue: string | boolean;
  setValue: string | boolean;
}

export type ForgeRefusal = 'name-ambiguous' | 'name-missing' | 'prompt-missing' | 'kind-unservable';

export type ForgePlan =
  | { ok: true; bodies: ForgeRequestBody[]; lockedFields: LockedField[]; firstTake: number; lastTake: number; setName: string }
  | { ok: false; reason: ForgeRefusal; detail: string };

/** Per-run spend guard: one click never bills more than this many takes. */
export const MAX_VARIATIONS_PER_RUN = 6;

const VARIATION_SUFFIX = /\(variation (\d+)\)\s*$/;

/** The take number a stored prompt carries, or 0 when it carries none. */
export function parseVariationIndex(prompt: string): number {
  const m = VARIATION_SUFFIX.exec(prompt);
  return m ? Number(m[1]) : 0;
}

function existingTarget(set: AudioSet, assets: AudioAsset[], matchedBy: 'selection' | 'name'): ForgeTarget {
  const own = assets.filter((a) => a.setId === set.id);
  const highest = own.reduce((max, a) => Math.max(max, parseVariationIndex(a.prompt)), 0);
  return {
    mode: 'existing', setId: set.id, set, takeCount: own.length,
    nextIndex: Math.max(highest, own.length) + 1,
    existingPrompts: own.map((a) => a.prompt), matchedBy,
  };
}

/**
 * An explicit selection wins; otherwise the typed name is matched against the
 * library (trimmed, case-insensitive — UE folder paths are case-insensitive, so
 * `Footstep-Stone` would land in the same `/Game/Audio/` folder).
 */
export function resolveForgeTarget(
  sets: AudioSet[],
  assets: AudioAsset[],
  input: { typedName: string; selectedSetId: string | null },
): ForgeTarget {
  if (input.selectedSetId) {
    const picked = sets.find((s) => s.id === input.selectedSetId);
    if (picked) return existingTarget(picked, assets, 'selection');
  }
  const name = input.typedName.trim();
  const key = name.toLowerCase();
  const matches = name ? sets.filter((s) => s.name.trim().toLowerCase() === key) : [];
  if (matches.length === 1) return existingTarget(matches[0], assets, 'name');
  if (matches.length > 1) return { mode: 'ambiguous', name, candidates: matches.map((s) => s.id) };
  return { mode: 'new', name };
}

function clampVariations(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_VARIATIONS_PER_RUN, Math.floor(n)));
}

/**
 * The request bodies one Generate click will send, or the reason it sends none.
 * For an existing set every body carries its `setId` (so the route files the
 * take into THAT set and scopes the cache to it) and the set's own kind, event
 * key, surface and loop flag; for a new set the first body carries only the
 * name, and the caller threads the returned id into the rest (today's shape).
 */
export function planForgeRun(target: ForgeTarget, form: ForgeForm, provider: AudioProvider): ForgePlan {
  if (target.mode === 'ambiguous') {
    return {
      ok: false, reason: 'name-ambiguous',
      detail: `${target.candidates.length} library sets are named "${target.name}". Pick one as the target; nothing was generated.`,
    };
  }
  if (target.mode === 'new' && !target.name) {
    return { ok: false, reason: 'name-missing', detail: 'Name the new set or pick a library set as the target.' };
  }
  const prompt = form.prompt;
  if (!prompt.trim()) return { ok: false, reason: 'prompt-missing', detail: 'Write a prompt first.' };

  const set = target.mode === 'existing' ? target.set : null;
  const kind: AudioKind = set ? set.kind : form.kind;
  if (!supportsKind(provider, kind)) {
    return { ok: false, reason: 'kind-unservable', detail: unsupportedReason(provider, kind) ?? '' };
  }

  const count = clampVariations(form.variations);
  const durationSeconds = form.durationSeconds > 0 ? form.durationSeconds : undefined;
  const bodies: ForgeRequestBody[] = [];

  if (target.mode === 'existing' && set) {
    const taken = new Set(target.existingPrompts);
    let n = target.nextIndex;
    for (let i = 0; i < count; i++, n++) {
      while (taken.has(`${prompt} (variation ${n})`)) n++;
      bodies.push({
        provider: provider.id, kind: set.kind, prompt: `${prompt} (variation ${n})`, durationSeconds,
        loop: set.loopable, setId: set.id, setName: set.name,
        eventKey: set.eventKey ?? undefined, surface: set.surface ?? undefined,
      });
    }
    const lockedFields: LockedField[] = [];
    const lock = (field: LockedField['field'], formValue: string | boolean, setValue: string | boolean) => {
      if (formValue !== setValue) lockedFields.push({ field, formValue, setValue });
    };
    lock('kind', form.kind, set.kind);
    lock('eventKey', form.eventKey, set.eventKey ?? '');
    lock('surface', form.surface, set.surface ?? '');
    lock('loop', form.loop, set.loopable);
    return {
      ok: true, bodies, lockedFields, setName: set.name,
      firstTake: parseVariationIndex(bodies[0].prompt), lastTake: parseVariationIndex(bodies[bodies.length - 1].prompt),
    };
  }

  const name = target.mode === 'new' ? target.name : '';
  for (let i = 0; i < count; i++) {
    bodies.push({
      provider: provider.id, kind, prompt: `${prompt} (variation ${i + 1})`, durationSeconds,
      loop: form.loop, setName: name,
      eventKey: form.eventKey, surface: form.surface,
    });
  }
  return { ok: true, bodies, lockedFields: [], setName: name, firstTake: 1, lastTake: count };
}
