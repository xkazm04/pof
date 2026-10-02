import type { SceneDraft, SceneOp } from '@/lib/audio-scene-ops';
import type { SpatialAudioGeneratorResult } from '@/lib/spatial-audio-generator';
import type {
  AudioZone, SoundEmitter, ReverbPreset, ZoneDerivation, EmitterDerivation,
  SyncedZoneField, SyncedEmitterField, LevelAudioSyncRow, LevelAudioSyncStatus,
} from '@/types/audio-scene';

/**
 * Level -> audio as a SYNC. The generator's output is a proposal; this plans
 * what writing it into a scene would do, one row per room, as `SceneOp`s the
 * scene's one reducer (`applySceneOps`) replays. Pure: nothing is written here.
 *
 * Every generated zone/emitter carries `derivedFrom`, the values it was written
 * with. Three copies of a field make a room's fate decidable:
 *   current != stamp            -> a human tuned it: KEPT, no op (unless overwritten)
 *   stamp   != new derivation   -> the level changed: UPDATED, one patch
 *   neither                     -> UNCHANGED
 * A room whose zone is gone from the level is ORPHANED; a sync never deletes.
 */

export const SYNCED_ZONE_FIELDS: readonly SyncedZoneField[] = [
  'name', 'shape', 'x', 'y', 'width', 'height', 'soundscapeDescription',
  'reverbPreset', 'reverbDecayTime', 'reverbDiffusion', 'reverbWetDry',
  'attenuationRadius', 'occlusionMode', 'priority', 'color',
];
export const SYNCED_EMITTER_FIELDS: readonly SyncedEmitterField[] = [
  'name', 'type', 'x', 'y', 'soundCueRef', 'attenuationRadius', 'volumeMultiplier',
  'pitchMin', 'pitchMax', 'spawnChance', 'cooldownSeconds',
];
const GEOMETRY: readonly SyncedZoneField[] = ['x', 'y', 'width', 'height'];

function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

/** The stamp a generated zone carries. */
export function zoneDerivation(zone: AudioZone, emitterIds: string[]): ZoneDerivation {
  return { ...pick(zone, SYNCED_ZONE_FIELDS), emitterIds };
}
/** The stamp a generated emitter carries. */
export function emitterDerivation(em: SoundEmitter): EmitterDerivation {
  return pick(em, SYNCED_EMITTER_FIELDS);
}

/** Fields of `keys` whose values differ between `a` and `b`. */
function differing<K extends string>(a: Partial<Record<K, unknown>>, b: Partial<Record<K, unknown>>, keys: readonly K[]): K[] {
  return keys.filter((k) => a[k] !== b[k]);
}

export interface LevelAudioSyncPlan {
  rows: LevelAudioSyncRow[];
  ops: SceneOp[];
  summary: Record<LevelAudioSyncStatus, number>;
  /** The level's dominant reverb: applied only when the sync creates the scene. */
  suggestedGlobalReverb: ReverbPreset;
}

export interface LevelAudioSyncOptions {
  /** Rooms whose hand-tuned zone/emitters the operator chose to reset to the derivation. */
  overwrite?: readonly string[];
}

/** The scene zone a derived zone maps to: linked by room, by id, or (a pre-sync scene) by name. */
function findZone(scene: SceneDraft, derived: AudioZone): AudioZone | undefined {
  return scene.zones.find((z) => z.sourceRoomId === derived.sourceRoomId)
    ?? scene.zones.find((z) => z.id === derived.id)
    ?? scene.zones.find((z) => !z.sourceRoomId && z.name === derived.name);
}
function findEmitter(scene: SceneDraft, derived: SoundEmitter): SoundEmitter | undefined {
  return scene.emitters.find((e) => e.id === derived.id)
    ?? scene.emitters.find((e) => !e.sourceRoomId && e.name === derived.name);
}

/** Ops for one room's emitters when its zone is not kept. */
function planEmitters(scene: SceneDraft, derived: SoundEmitter[], stampedIds: readonly string[] | null, force: boolean) {
  const ops: SceneOp[] = [];
  const kept: string[] = [];
  for (const de of derived) {
    const cur = findEmitter(scene, de);
    if (!cur) {
      // Generated before and gone now: the operator deleted it, so it stays deleted.
      if (!force && stampedIds?.includes(de.id)) kept.push(`${de.name} (deleted)`);
      else ops.push({ kind: 'addEmitter', emitter: de });
      continue;
    }
    const tuned = differing(cur, cur.derivedFrom ?? de, SYNCED_EMITTER_FIELDS);
    if (tuned.length > 0 && !force) { kept.push(de.name); continue; }
    const fields = force ? differing(cur, de, SYNCED_EMITTER_FIELDS) : differing(cur.derivedFrom ?? de, de, SYNCED_EMITTER_FIELDS);
    // A stamp that already equals the derivation needs no rewrite; an unstamped
    // (pre-sync) emitter is only adopted when the operator overwrites its room.
    const stampCurrent = cur.derivedFrom ? differing(cur.derivedFrom, de, SYNCED_EMITTER_FIELDS).length === 0 : !force;
    if (fields.length === 0 && stampCurrent) continue;
    ops.push({
      kind: 'patchEmitter', id: cur.id,
      patch: { ...pick(de, fields), sourceRoomId: de.sourceRoomId, derivedFrom: emitterDerivation(de) },
    });
  }
  return { ops, kept };
}

function planRoom(scene: SceneDraft, dz: AudioZone, dEmitters: SoundEmitter[], force: boolean) {
  const roomId = dz.sourceRoomId ?? '';
  const row = (status: LevelAudioSyncStatus, zoneId: string, fields: string[] = [], keptEmitters: string[] = []) =>
    ({ roomId, roomName: dz.name.replace(/ Audio Zone$/, ''), zoneId, status, fields, keptEmitters });

  const cur = findZone(scene, dz);
  if (!cur) {
    return { row: row('new', dz.id), ops: [{ kind: 'addZone', zone: dz } as SceneOp, ...dEmitters.map((emitter): SceneOp => ({ kind: 'addEmitter', emitter }))] };
  }
  const stamp = cur.derivedFrom ?? null;
  // No stamp (a zone written before the sync existed): any difference counts as tuning.
  const tuned = differing(cur, stamp ?? dz, SYNCED_ZONE_FIELDS);
  if (tuned.length > 0 && !force) return { row: row('kept', cur.id, tuned), ops: [] };

  let fields = force ? differing(cur, dz, SYNCED_ZONE_FIELDS) : differing(stamp ?? dz, dz, SYNCED_ZONE_FIELDS);
  // Geometry moves as one unit, so the patch always carries the whole rect.
  if (fields.some((f) => GEOMETRY.includes(f))) fields = [...new Set([...fields, ...GEOMETRY])];

  const em = planEmitters(scene, dEmitters, stamp?.emitterIds ?? null, force);
  const newStamp = dz.derivedFrom!;
  const stampStale = stamp
    ? differing(stamp, newStamp, SYNCED_ZONE_FIELDS).length > 0 || stamp.emitterIds.join() !== newStamp.emitterIds.join()
    : force;
  const ops: SceneOp[] = [];
  if (fields.length > 0 || stampStale) {
    ops.push({ kind: 'patchZone', id: cur.id, patch: { ...pick(dz, fields), sourceRoomId: roomId, derivedFrom: newStamp } });
  }
  ops.push(...em.ops);
  const status: LevelAudioSyncStatus = ops.length > 0 ? 'updated' : 'unchanged';
  return { row: row(status, cur.id, fields, em.kept), ops };
}

/**
 * Plan writing `generation` into `scene`. Kept and orphaned rooms produce no
 * ops; `overwrite` lists rooms whose tuning the operator chose to reset.
 */
export function planLevelAudioSync(
  scene: SceneDraft,
  generation: SpatialAudioGeneratorResult,
  options: LevelAudioSyncOptions = {},
): LevelAudioSyncPlan {
  const overwrite = new Set(options.overwrite ?? []);
  const rows: LevelAudioSyncRow[] = [];
  const ops: SceneOp[] = [];
  const roomIds = new Set<string>();

  for (const dz of generation.zones) {
    const roomId = dz.sourceRoomId ?? dz.id;
    roomIds.add(roomId);
    const dEmitters = generation.emitters.filter((e) => e.sourceRoomId === roomId);
    const planned = planRoom(scene, dz, dEmitters, overwrite.has(roomId));
    rows.push(planned.row);
    ops.push(...planned.ops);
  }

  for (const z of scene.zones) {
    if (z.sourceRoomId && !roomIds.has(z.sourceRoomId)) {
      rows.push({
        roomId: z.sourceRoomId, roomName: z.name.replace(/ Audio Zone$/, ''), zoneId: z.id,
        status: 'orphaned', fields: [], keptEmitters: [],
      });
    }
  }

  const summary: Record<LevelAudioSyncStatus, number> = { new: 0, unchanged: 0, updated: 0, kept: 0, orphaned: 0 };
  for (const r of rows) summary[r.status]++;
  return { rows, ops, summary, suggestedGlobalReverb: generation.globalReverbPreset };
}
