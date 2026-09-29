import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * The audio scene's edit vocabulary and its one pure reducer.
 *
 * Every edit to a scene — a painter gesture or a property-panel field — is a
 * named op. An edit buffer holds the op LIST (not a snapshot of the scene), and
 * `applySceneOps(base, ops)` replays it onto whatever the server copy is now, so
 * a write that landed while the ops were buffered (another panel field, a retry)
 * is kept rather than overwritten.
 *
 * Two rules live here and nowhere else:
 *   - membership: `emitter.zoneId` is DERIVED. After any geometry op it is
 *     recomputed with `resolveMembership` (the highest-priority containing zone,
 *     array order breaking ties — UE AudioVolume semantics).
 *   - pitch range: a patch that moves `pitchMin` above `pitchMax` pushes the
 *     other end along (and vice versa), so min <= max always holds.
 *
 * Ops are idempotent against a server that already has them (an `addZone` whose
 * id exists is skipped, a `deleteZone` of a missing id is a no-op), because a
 * buffer re-sends its whole list after a failure or an overlapping commit.
 */

/** The editable half of a scene document: what a scene write carries. */
export interface SceneDraft {
  zones: AudioZone[];
  emitters: SoundEmitter[];
}

/** Fields a panel may patch on a zone (identity is not editable). */
export type ZonePatch = Partial<Omit<AudioZone, 'id'>>;
/** Fields a panel may patch on an emitter (`zoneId` is derived, never written). */
export type EmitterPatch = Partial<Omit<SoundEmitter, 'id' | 'zoneId'>>;

export type SceneOp =
  | { kind: 'addZone'; zone: AudioZone }
  | { kind: 'moveZone'; id: string; x: number; y: number }
  | { kind: 'resizeZone'; id: string; width: number; height: number }
  | { kind: 'deleteZone'; id: string }
  | { kind: 'patchZone'; id: string; patch: ZonePatch }
  | { kind: 'addEmitter'; emitter: SoundEmitter }
  | { kind: 'moveEmitter'; id: string; x: number; y: number }
  | { kind: 'deleteEmitter'; id: string }
  | { kind: 'patchEmitter'; id: string; patch: EmitterPatch };

/** Zone fields whose change can move an emitter in or out of a zone. */
const ZONE_GEOMETRY: ReadonlyArray<keyof AudioZone> = ['x', 'y', 'width', 'height', 'shape', 'priority'];

/** True when the point lies inside the zone (edges inclusive). */
export function zoneContains(zone: AudioZone, x: number, y: number): boolean {
  if (zone.shape === 'circle') {
    const dx = x - zone.x;
    const dy = y - zone.y;
    const r = zone.width / 2;
    return dx * dx + dy * dy <= r * r;
  }
  return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
}

/**
 * The zone a point belongs to: the highest-priority zone containing it, the
 * earlier zone in array order on a tie, `null` outside every zone.
 */
export function resolveMembership(x: number, y: number, zones: readonly AudioZone[]): string | null {
  let best: AudioZone | null = null;
  for (const zone of zones) {
    if (!zoneContains(zone, x, y)) continue;
    if (!best || zone.priority > best.priority) best = zone;
  }
  return best ? best.id : null;
}

/** Keep `pitchMin <= pitchMax`: the end the patch moved pushes the other one. */
function applyEmitterPatch(em: SoundEmitter, patch: EmitterPatch): SoundEmitter {
  const next = { ...em, ...patch };
  if (next.pitchMin > next.pitchMax) {
    if (patch.pitchMin !== undefined) next.pitchMax = next.pitchMin;
    else next.pitchMin = next.pitchMax;
  }
  return next;
}

/** Replace the record with `id` via `fn`; the same array when it is absent. */
function mapById<T extends { id: string }>(list: T[], id: string, fn: (item: T) => T): T[] {
  const i = list.findIndex((item) => item.id === id);
  if (i < 0) return list;
  const next = list.slice();
  next[i] = fn(list[i]);
  return next;
}

function withoutId<T extends { id: string }>(list: T[], id: string): T[] {
  return list.some((item) => item.id === id) ? list.filter((item) => item.id !== id) : list;
}

const withZones = (s: SceneDraft, zones: AudioZone[]): SceneDraft =>
  (zones === s.zones ? s : { zones, emitters: s.emitters });
const withEmitters = (s: SceneDraft, emitters: SoundEmitter[]): SceneDraft =>
  (emitters === s.emitters ? s : { zones: s.zones, emitters });

/** Apply one op. `geometry` says whether membership must be re-derived. */
function applyOne(s: SceneDraft, op: SceneOp): { scene: SceneDraft; geometry: boolean } {
  switch (op.kind) {
    case 'addZone':
      if (s.zones.some((z) => z.id === op.zone.id)) return { scene: s, geometry: false };
      return { scene: withZones(s, [...s.zones, op.zone]), geometry: true };
    case 'moveZone':
      return { scene: withZones(s, mapById(s.zones, op.id, (z) => ({ ...z, x: op.x, y: op.y }))), geometry: true };
    case 'resizeZone':
      return {
        scene: withZones(s, mapById(s.zones, op.id, (z) => ({ ...z, width: op.width, height: op.height }))),
        geometry: true,
      };
    case 'deleteZone':
      return { scene: withZones(s, withoutId(s.zones, op.id)), geometry: true };
    case 'patchZone':
      return {
        scene: withZones(s, mapById(s.zones, op.id, (z) => ({ ...z, ...op.patch, id: z.id }))),
        geometry: ZONE_GEOMETRY.some((k) => k in op.patch),
      };
    case 'addEmitter':
      if (s.emitters.some((e) => e.id === op.emitter.id)) return { scene: s, geometry: false };
      return { scene: withEmitters(s, [...s.emitters, op.emitter]), geometry: true };
    case 'moveEmitter':
      return { scene: withEmitters(s, mapById(s.emitters, op.id, (e) => ({ ...e, x: op.x, y: op.y }))), geometry: true };
    case 'deleteEmitter':
      return { scene: withEmitters(s, withoutId(s.emitters, op.id)), geometry: false };
    case 'patchEmitter':
      return {
        scene: withEmitters(s, mapById(s.emitters, op.id, (e) => applyEmitterPatch(e, op.patch))),
        geometry: 'x' in op.patch || 'y' in op.patch,
      };
  }
}

/** Re-derive every emitter's zone; unchanged emitters (and array) keep identity. */
function deriveMembership(scene: SceneDraft): SceneDraft {
  let changed = false;
  const emitters = scene.emitters.map((em) => {
    const zoneId = resolveMembership(em.x, em.y, scene.zones);
    if (zoneId === em.zoneId) return em;
    changed = true;
    return { ...em, zoneId };
  });
  return changed ? { zones: scene.zones, emitters } : scene;
}

/**
 * Replay `ops` onto `base`. Pure: `base` is never mutated, and a list that
 * changes nothing returns `base` itself. Untouched halves keep their array
 * identity, so a caller can tell which half a write actually changed.
 */
export function applySceneOps(base: SceneDraft, ops: readonly SceneOp[]): SceneDraft {
  let scene = base;
  let geometry = false;
  for (const op of ops) {
    const step = applyOne(scene, op);
    // Only a geometry op that actually changed something re-derives membership.
    if (step.geometry && step.scene !== scene) geometry = true;
    scene = step.scene;
  }
  return geometry ? deriveMembership(scene) : scene;
}

/** A move/resize target: consecutive ops with the same key collapse to the last. */
function collapseKey(op: SceneOp): string | null {
  switch (op.kind) {
    case 'moveZone': case 'resizeZone': case 'moveEmitter':
      return `${op.kind}:${op.id}`;
    default:
      return null;
  }
}

/** Same record, same field set: a typing burst or one slider's drag frames. */
function samePatchTarget(a: SceneOp, b: SceneOp): boolean {
  if (a.kind !== b.kind || (a.kind !== 'patchZone' && a.kind !== 'patchEmitter')) return false;
  if (a.id !== (b as typeof a).id) return false;
  const ka = Object.keys(a.patch).sort().join();
  return ka === Object.keys((b as typeof a).patch).sort().join();
}

/**
 * Append `next` to the buffered list. Consecutive moves/resizes of one target
 * fold into the latest (a 60-frame drag is ONE op), and so do consecutive
 * patches of the same fields of one record (a typing burst, a slider drag).
 * Nothing is ever reordered, and ops of different kinds never merge.
 */
export function foldSceneOps(prev: readonly SceneOp[] | null, next: readonly SceneOp[]): SceneOp[] {
  const out = prev ? prev.slice() : [];
  for (const op of next) {
    const last = out[out.length - 1];
    const key = collapseKey(op);
    const collapses = last !== undefined
      && ((key !== null && collapseKey(last) === key) || samePatchTarget(last, op));
    if (collapses) out[out.length - 1] = op;
    else out.push(op);
  }
  return out;
}
