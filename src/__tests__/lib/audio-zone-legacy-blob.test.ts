import { describe, it, expect } from 'vitest';
import {
  createAudioScene,
  updateAudioScene,
  getAudioScene,
  deleteAudioScene,
} from '@/lib/audio-scene-db';
import { generateSpatialAudio } from '@/lib/spatial-audio-generator';
import type { AudioZone } from '@/types/audio-scene';
import type { RoomNode } from '@/types/level-design';

/**
 * `AudioZone.linkedFiles` was deleted from the type (2026-08-19) — it was
 * written by the painter and the spatial-audio generator and read by nothing;
 * `SoundEmitter.assetSetId` is the real asset↔scene edge.
 *
 * `zones` is a JSON blob column, so scenes already on disk still carry the key.
 * Deleting a field from a TS interface is only safe if those rows keep reading,
 * so this exercises a REAL `audio_scenes` row whose blob carries `linkedFiles`
 * (plus the `[]` the two retired writers used to emit) and asserts the document
 * comes back whole: extra keys ride along in the parsed object and are simply
 * not part of the type — nothing throws, nothing is dropped.
 */

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z1', name: 'Cavern', shape: 'rect', x: 0, y: 0, width: 100, height: 100,
    soundscapeDescription: 'dripping water', reverbPreset: 'cave', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: 'var(--accent)',
    ...over,
  };
}

/** A zone blob exactly as a pre-deletion scene stored it. */
function legacyZone(linkedFiles: string[]): AudioZone {
  return { ...zone(), linkedFiles } as unknown as AudioZone;
}

describe('audio_scenes — a legacy zone blob carrying linkedFiles still reads', () => {
  it('reads back every live field of a zone written with the retired key', () => {
    const scene = createAudioScene({ name: `legacy-linkedfiles-${Date.now()}` });
    try {
      updateAudioScene({
        id: scene.id,
        zones: [
          legacyZone(['/Game/Audio/Old_Cue.uasset', '/Game/Audio/Older_Cue.uasset']),
          legacyZone([]), // the `[]` both retired writers emitted
        ],
      });

      const read = getAudioScene(scene.id);
      expect(read).toBeTruthy();
      expect(read!.zones).toHaveLength(2);

      const [withFiles, empty] = read!.zones;
      // Every field the type still declares survives the round trip.
      expect(withFiles.name).toBe('Cavern');
      expect(withFiles.reverbPreset).toBe('cave');
      expect(withFiles.attenuationRadius).toBe(200);
      expect(withFiles.occlusionMode).toBe('medium');
      expect(withFiles.priority).toBe(5);
      expect(withFiles.color).toBe('var(--accent)');
      expect(empty.soundscapeDescription).toBe('dripping water');

      // The retired key is not typed any more — it is neither required nor
      // coerced away by the parse; it simply isn't part of the contract.
      const raw = withFiles as unknown as Record<string, unknown>;
      expect(Array.isArray(raw.linkedFiles)).toBe(true);
    } finally {
      deleteAudioScene(scene.id);
    }
  });

  it('the spatial generator no longer copies the level rooms linkedFiles onto its zones', () => {
    const room: RoomNode = {
      id: 'r1', name: 'Great Hall', type: 'combat', description: 'a torchlit hall',
      encounterDesign: 'two waves', difficulty: 3, pacing: 'rising', x: 0, y: 0,
      // The level doc DOES track linked C++ files — that edge is real and stays.
      linkedFiles: ['Combat/GreatHall.cpp', 'Combat/GreatHall.h'],
      spawnEntries: [], tags: [],
    };

    const { zones } = generateSpatialAudio({ rooms: [room], connections: [], levelName: 'L1' });

    expect(zones).toHaveLength(1);
    // The audio zone used to inherit the room's file list and then never use it.
    expect('linkedFiles' in (zones[0] as unknown as Record<string, unknown>)).toBe(false);
    // ...while the room itself is untouched (the level-design field is not retired).
    expect(room.linkedFiles).toHaveLength(2);
  });

  it('a zone written by todays painter/generator carries no linkedFiles at all', () => {
    const scene = createAudioScene({ name: `no-linkedfiles-${Date.now()}` });
    try {
      updateAudioScene({ id: scene.id, zones: [zone({ id: 'z-new' })] });
      const read = getAudioScene(scene.id);
      const raw = read!.zones[0] as unknown as Record<string, unknown>;
      expect('linkedFiles' in raw).toBe(false);
      expect(read!.zones[0].id).toBe('z-new');
    } finally {
      deleteAudioScene(scene.id);
    }
  });
});
