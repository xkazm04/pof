import { describe, it, expect } from 'vitest';
import {
  applySceneOps,
  foldSceneOps,
  resolveMembership,
  type SceneDraft,
  type SceneOp,
} from '@/lib/audio-scene-ops';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * The audio scene's ONE edit reducer. Every gesture (painter) and every field
 * (property panels) is a named op; `applySceneOps` rebases the op list onto the
 * newest server copy and re-derives `emitter.zoneId` after geometry changes, so
 * membership is a derived relation instead of a value frozen at placement.
 */

function zone(id: string, x: number, y: number, width: number, height: number, over: Partial<AudioZone> = {}): AudioZone {
  return {
    id, name: id, shape: 'rect', x, y, width, height,
    soundscapeDescription: '', reverbPreset: 'none', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '',
    ...over,
  };
}

function emitter(id: string, x: number, y: number, zoneId: string | null, over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id, name: id, type: 'ambient', x, y, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId,
    ...over,
  };
}

describe('applySceneOps — membership is derived on every geometry op', () => {
  it('case 1: dragging an emitter across a zone boundary reparents it', () => {
    const scene: SceneDraft = {
      zones: [zone('A', 0, 0, 100, 100), zone('B', 200, 0, 100, 100)],
      emitters: [emitter('e', 50, 50, 'A')],
    };
    const next = applySceneOps(scene, [{ kind: 'moveEmitter', id: 'e', x: 250, y: 50 }]);
    expect(next.emitters[0].x).toBe(250);
    expect(next.emitters[0].zoneId).toBe('B');
  });

  it('case 4: deleting a zone re-derives each child instead of nulling all of them', () => {
    const scene: SceneDraft = {
      zones: [zone('A', 0, 0, 200, 100), zone('B', 100, 0, 200, 100)],
      emitters: [emitter('e1', 150, 50, 'A'), emitter('e2', 50, 50, 'A')],
    };
    const next = applySceneOps(scene, [{ kind: 'deleteZone', id: 'A' }]);
    expect(next.zones.map((z) => z.id)).toEqual(['B']);
    expect(next.emitters.find((e) => e.id === 'e1')!.zoneId).toBe('B');
    expect(next.emitters.find((e) => e.id === 'e2')!.zoneId).toBeNull();
  });
});

describe('resolveMembership — the highest-priority containing zone wins', () => {
  it('case 2: priority beats array order; array order breaks a tie', () => {
    const a = zone('A', 0, 0, 200, 100, { priority: 3 });
    expect(resolveMembership(150, 50, [a, zone('B', 100, 0, 200, 100, { priority: 8 })])).toBe('B');
    expect(resolveMembership(150, 50, [a, zone('B', 100, 0, 200, 100, { priority: 3 })])).toBe('A');
  });
});

describe('applySceneOps — ops rebase onto the newest server copy', () => {
  it('case 3: a zone move keeps a panel write that landed after the gesture began', () => {
    const server: SceneDraft = {
      zones: [zone('A', 0, 0, 100, 100, { name: 'Cave' })],
      emitters: [],
    };
    const next = applySceneOps(server, [{ kind: 'moveZone', id: 'A', x: 40, y: 40 }]);
    expect(next.zones[0].name).toBe('Cave');
    expect(next.zones[0].x).toBe(40);
    expect(next.zones[0].y).toBe(40);
  });
});

describe('foldSceneOps — consecutive moves of one target collapse', () => {
  it('case 5: 60 moves fold to 1; move/patch/move keeps 3 in order', () => {
    let acc: SceneOp[] | null = null;
    for (let i = 1; i <= 60; i++) {
      acc = foldSceneOps(acc, [{ kind: 'moveEmitter', id: 'e', x: i, y: i * 2 }]);
    }
    expect(acc).toEqual([{ kind: 'moveEmitter', id: 'e', x: 60, y: 120 }]);

    let mixed: SceneOp[] | null = null;
    const seq: SceneOp[] = [
      { kind: 'moveEmitter', id: 'e', x: 1, y: 1 },
      { kind: 'patchEmitter', id: 'e', patch: { name: 'Drip' } },
      { kind: 'moveEmitter', id: 'e', x: 2, y: 2 },
    ];
    for (const op of seq) mixed = foldSceneOps(mixed, [op]);
    expect(mixed).toHaveLength(3);
    expect(mixed!.map((o) => o.kind)).toEqual(['moveEmitter', 'patchEmitter', 'moveEmitter']);
  });
});

describe('applySceneOps — the pitch range is one rule in the reducer', () => {
  it('case 6: raising pitchMin past pitchMax pushes pitchMax; an unknown id is a no-op', () => {
    const scene: SceneDraft = {
      zones: [zone('A', 0, 0, 100, 100)],
      emitters: [emitter('e', 50, 50, 'A', { pitchMin: 0.9, pitchMax: 1.1 })],
    };
    const next = applySceneOps(scene, [{ kind: 'patchEmitter', id: 'e', patch: { pitchMin: 1.5 } }]);
    expect(next.emitters[0].pitchMin).toBe(1.5);
    expect(next.emitters[0].pitchMax).toBe(1.5);

    const before = structuredClone(scene);
    const same = applySceneOps(scene, [{ kind: 'patchEmitter', id: 'ghost', patch: { pitchMin: 1.5 } }]);
    expect(same).toEqual(before);
    expect(scene).toEqual(before);
  });
});
