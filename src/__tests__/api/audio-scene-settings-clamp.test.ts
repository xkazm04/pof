import { describe, it, expect } from 'vitest';
import { createAudioScene, updateAudioScene, deleteAudioScene } from '@/lib/audio-scene-db';

/** soundPoolSize / maxConcurrentSounds are emitted as int32; the server must clamp them itself. */
describe('updateAudioScene - settings clamp', () => {
  it('stores whole in-range values for out-of-range input', () => {
    const scene = createAudioScene({ name: `clamp-${Date.now()}` });
    try {
      const out = updateAudioScene({ id: scene.id, soundPoolSize: 2.5, maxConcurrentSounds: 999 });
      expect(out?.soundPoolSize).toBe(2);
      expect(out?.maxConcurrentSounds).toBe(128);
      const hi = updateAudioScene({ id: scene.id, soundPoolSize: 99999, maxConcurrentSounds: -3 });
      expect(hi?.soundPoolSize).toBe(256);
      expect(hi?.maxConcurrentSounds).toBe(1);
    } finally {
      deleteAudioScene(scene.id);
    }
  });

  it('leaves in-range values and omitted fields alone', () => {
    const scene = createAudioScene({ name: `clamp-ok-${Date.now()}` });
    try {
      const out = updateAudioScene({ id: scene.id, soundPoolSize: 64 });
      expect(out?.soundPoolSize).toBe(64);
      expect(out?.maxConcurrentSounds).toBe(scene.maxConcurrentSounds);
    } finally {
      deleteAudioScene(scene.id);
    }
  });
});
