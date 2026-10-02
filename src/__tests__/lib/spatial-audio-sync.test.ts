import { describe, it, expect } from 'vitest';
import { generateSpatialAudio } from '@/lib/spatial-audio-generator';
import { planLevelAudioSync } from '@/lib/spatial-audio-sync';
import { applySceneOps, type SceneDraft, type SceneOp } from '@/lib/audio-scene-ops';
import { resolveEmitterCue } from '@/lib/audio-codegen';
import type { RoomNode, RoomConnection, RoomType, PacingCurve, DifficultyLevel } from '@/types/level-design';

/**
 * Level -> audio is a SYNC, not a blind append: generated zones are keyed to
 * their room and stamped with what they were derived from, so a re-run can
 * tell "the level changed" (update it) from "a human tuned it" (keep it).
 */

function room(
  id: string, name: string, type: RoomType, pacing: PacingCurve, difficulty: DifficultyLevel,
  x: number, description = '', encounterDesign = '',
): RoomNode {
  return {
    id, name, type, description, encounterDesign, difficulty, pacing, x, y: 100,
    linkedFiles: [], spawnEntries: [], tags: [],
  };
}

/** The probe's 5-room level: 5 zones, 6 emitters. */
function level(): { rooms: RoomNode[]; connections: RoomConnection[] } {
  const rooms = [
    room('r1', 'Entrance Hall', 'hub', 'falling', 1, 0, 'torches and a waterfall'),
    room('r2', 'Crypt', 'combat', 'rising', 3, 300, 'skeletons rattle', 'ambush by undead'),
    room('r3', 'Library', 'puzzle', 'falling', 2, 600, 'dusty books'),
    room('r4', 'Sanctum', 'safe', 'falling', 1, 900),
    room('r5', 'Throne', 'boss', 'rising', 5, 1200, 'lava and fire', 'boss fight'),
  ];
  const connections = [
    { id: 'c1', fromId: 'r1', toId: 'r2' }, { id: 'c2', fromId: 'r2', toId: 'r3' },
    { id: 'c3', fromId: 'r3', toId: 'r4' }, { id: 'c4', fromId: 'r4', toId: 'r5' },
  ] as RoomConnection[];
  return { rooms, connections };
}

const gen = (l = level()) => generateSpatialAudio({ ...l, levelName: 'L' });
const EMPTY: SceneDraft = { zones: [], emitters: [] };
const kinds = (ops: readonly SceneOp[]) => ops.map((o) => o.kind);

/** A scene holding exactly what a first sync of `level()` writes. */
function syncedScene(): SceneDraft {
  return applySceneOps(EMPTY, planLevelAudioSync(EMPTY, gen()).ops);
}

function editZone(scene: SceneDraft, roomId: string, patch: Record<string, unknown>): SceneDraft {
  return {
    zones: scene.zones.map((z) => (z.sourceRoomId === roomId ? { ...z, ...patch } : z)),
    emitters: scene.emitters,
  };
}

describe('generateSpatialAudio — stable, room-keyed output', () => {
  it('two runs on the same level give identical zone and emitter ids, each zone linked to its room', () => {
    const a = gen();
    const b = gen();
    expect(a.zones.map((z) => z.id)).toEqual(b.zones.map((z) => z.id));
    expect(a.emitters.map((e) => e.id)).toEqual(b.emitters.map((e) => e.id));
    const rooms = level().rooms;
    expect(a.zones).toHaveLength(5);
    a.zones.forEach((z, i) => {
      expect(z.sourceRoomId).toBe(rooms[i].id);
      // Stamped with the values it was derived from.
      expect(z.derivedFrom?.reverbPreset).toBe(z.reverbPreset);
      expect(z.derivedFrom?.x).toBe(z.x);
    });
  });

  it('generated emitters carry no invented cue path: codegen labels them placeholders, never manual', () => {
    const { emitters } = gen();
    expect(emitters).toHaveLength(6);
    for (const em of emitters) {
      expect(em.soundCueRef).toBe('');
      expect(resolveEmitterCue(em).provenance).toBe('placeholder');
    }
  });
});

describe('planLevelAudioSync', () => {
  it('into an empty scene: 5 new rows, 5 addZone + 6 addEmitter; applied and re-planned: 0 ops, 5 unchanged', () => {
    const plan = planLevelAudioSync(EMPTY, gen());
    expect(plan.rows.map((r) => r.status)).toEqual(['new', 'new', 'new', 'new', 'new']);
    expect(kinds(plan.ops).filter((k) => k === 'addZone')).toHaveLength(5);
    expect(kinds(plan.ops).filter((k) => k === 'addEmitter')).toHaveLength(6);
    expect(plan.ops).toHaveLength(11);

    const scene = applySceneOps(EMPTY, plan.ops);
    const again = planLevelAudioSync(scene, gen());
    expect(again.ops).toHaveLength(0);
    expect(again.rows.map((r) => r.status)).toEqual(['unchanged', 'unchanged', 'unchanged', 'unchanged', 'unchanged']);
    expect(again.summary.unchanged).toBe(5);
  });

  it('a hand-edited zone is kept with the fields named and no patch; overwrite restores it with one patchZone', () => {
    const tuned = editZone(syncedScene(), 'r2', { reverbPreset: 'cave', x: 333 });
    const plan = planLevelAudioSync(tuned, gen());
    const row = plan.rows.find((r) => r.roomId === 'r2')!;
    expect(row.status).toBe('kept');
    expect(row.fields).toEqual(expect.arrayContaining(['reverbPreset', 'x']));
    expect(plan.ops.filter((o) => o.kind === 'patchZone')).toHaveLength(0);
    expect(plan.ops).toHaveLength(0);

    const forced = planLevelAudioSync(tuned, gen(), { overwrite: ['r2'] });
    const patches = forced.ops.filter((o) => o.kind === 'patchZone');
    expect(patches).toHaveLength(1);
    const restored = applySceneOps(tuned, forced.ops);
    const z = restored.zones.find((zz) => zz.sourceRoomId === 'r2')!;
    const derived = gen().zones.find((zz) => zz.sourceRoomId === 'r2')!;
    expect(z.reverbPreset).toBe(derived.reverbPreset);
    expect(z.x).toBe(derived.x);
    expect(planLevelAudioSync(restored, gen()).ops).toHaveLength(0);
  });

  it('a room moved in the level whose zone is untouched: updated, exactly one patchZone with the new geometry', () => {
    const scene = syncedScene();
    const moved = level();
    moved.rooms[1] = { ...moved.rooms[1], x: 450, y: 260, type: 'boss' }; // moved and (via type) resized
    const next = gen(moved);
    const plan = planLevelAudioSync(scene, next);
    const row = plan.rows.find((r) => r.roomId === 'r2')!;
    expect(row.status).toBe('updated');
    const patches = plan.ops.filter((o): o is Extract<SceneOp, { kind: 'patchZone' }> => o.kind === 'patchZone');
    expect(patches).toHaveLength(1);
    const target = next.zones.find((z) => z.sourceRoomId === 'r2')!;
    expect(patches[0].patch).toMatchObject({ x: 450, y: 260, width: target.width, height: target.height });
    expect(target.width).not.toBe(scene.zones.find((z) => z.sourceRoomId === 'r2')!.width);
    // The applied result is in sync with the new derivation.
    expect(planLevelAudioSync(applySceneOps(scene, plan.ops), next).ops).toHaveLength(0);
  });

  it('the same room moved AND its zone reverb hand-edited: kept, no op', () => {
    const tuned = editZone(syncedScene(), 'r2', { reverbPreset: 'cave' });
    const moved = level();
    moved.rooms[1] = { ...moved.rooms[1], x: 450, y: 260 };
    const plan = planLevelAudioSync(tuned, gen(moved));
    const row = plan.rows.find((r) => r.roomId === 'r2')!;
    expect(row.status).toBe('kept');
    expect(row.fields).toContain('reverbPreset');
    expect(plan.ops).toHaveLength(0);
  });

  it('a room deleted from the level whose zone exists: orphaned, and nothing is deleted', () => {
    const scene = syncedScene();
    const l = level();
    l.rooms = l.rooms.filter((r) => r.id !== 'r4');
    l.connections = l.connections.filter((c) => c.fromId !== 'r4' && c.toId !== 'r4');
    const plan = planLevelAudioSync(scene, gen(l));
    const row = plan.rows.find((r) => r.roomId === 'r4')!;
    expect(row.status).toBe('orphaned');
    expect(plan.summary.orphaned).toBe(1);
    expect(plan.ops.some((o) => o.kind === 'deleteZone' || o.kind === 'deleteEmitter')).toBe(false);
  });
});
