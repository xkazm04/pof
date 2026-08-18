import { describe, it, expect } from 'vitest';
import {
  createAudioScene,
  updateAudioScene,
  getAudioScene,
  deleteAudioScene,
} from '@/lib/audio-scene-db';
import type { SoundEmitter } from '@/types/audio-scene';

/**
 * `SoundEmitter.assetSetId` is additive on a JSON blob column, so no migration
 * runs and no table changes. This proves the two halves of that claim against
 * the real SQLite: a binding survives the write/read round trip, and an emitter
 * written WITHOUT the field still reads back fine (existing scenes unchanged).
 */

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e1', name: 'Drip', type: 'ambient', x: 1, y: 2, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}

describe('audio scene persistence — emitter asset binding', () => {
  it('round-trips assetSetId, and reads a legacy emitter without it', () => {
    const scene = createAudioScene({ name: `binding-roundtrip-${Date.now()}` });
    try {
      const legacy = emitter({ id: 'e-legacy', name: 'Legacy' });
      delete (legacy as Partial<SoundEmitter>).assetSetId;

      updateAudioScene({
        id: scene.id,
        emitters: [emitter({ assetSetId: 'set-a' }), legacy],
      });

      const read = getAudioScene(scene.id);
      expect(read).toBeTruthy();
      expect(read!.emitters).toHaveLength(2);
      expect(read!.emitters[0].assetSetId).toBe('set-a');
      // Absent, not coerced into an empty string that would read as a binding.
      expect(read!.emitters[1].assetSetId).toBeUndefined();
    } finally {
      deleteAudioScene(scene.id);
    }
  });

  it('persists an unbind as null rather than dropping the field', () => {
    const scene = createAudioScene({ name: `binding-unbind-${Date.now()}` });
    try {
      updateAudioScene({ id: scene.id, emitters: [emitter({ assetSetId: 'set-a' })] });
      updateAudioScene({ id: scene.id, emitters: [emitter({ assetSetId: null })] });
      expect(getAudioScene(scene.id)!.emitters[0].assetSetId).toBeNull();
    } finally {
      deleteAudioScene(scene.id);
    }
  });
});
