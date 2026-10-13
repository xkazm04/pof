import { describe, it, expect } from 'vitest';
import { generateAudioCode } from '@/lib/audio-codegen';
import type { AudioSceneDocument, AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * One rule - "user text never leaves its C++ literal or comment" - had two
 * implementations: the soundscape description escaped `"`, the hand-typed cue path
 * and every name interpolated into a comment escaped nothing. A backslash also
 * defeated the one escape that existed. These pin the single rule at every site.
 */

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z1', name: 'Cave', shape: 'rect', x: 0, y: 0, width: 100, height: 100,
    soundscapeDescription: 'drips', reverbPreset: 'cave', reverbDecayTime: 2, reverbDiffusion: 0.5,
    reverbWetDry: 0.3, attenuationRadius: 500, occlusionMode: 'low', priority: 5, color: 'x',
    ...over,
  };
}
function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e1', name: 'Drip', type: 'ambient', x: 1, y: 1, soundCueRef: '', attenuationRadius: 60,
    volumeMultiplier: 1, pitchMin: 1, pitchMax: 1, spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}
function doc(over: Partial<AudioSceneDocument>): AudioSceneDocument {
  return {
    id: 1, name: 'Scene', description: '', zones: [], emitters: [], globalReverbPreset: 'none',
    soundPoolSize: 32, maxConcurrentSounds: 16, lastGeneratedAt: null, createdAt: '', updatedAt: '',
    ...over,
  };
}
function file(d: AudioSceneDocument, name: string): string {
  const f = generateAudioCode(d, 'MyProject', 'MYPROJECT_API').files.find((x) => x.filename === name);
  expect(f, name).toBeTruthy();
  return f!.content;
}

describe('generated C++ keeps user text inside its literal / comment', () => {
  it('escapes backslash and quote in a hand-typed cue path', () => {
    const cpp = file(doc({ emitters: [emitter({ soundCueRef: '/Game/A"B\\C' })] }), 'SceneEmitterSpawner.cpp');
    expect(cpp).toContain('TEXT("/Game/A\\"B\\\\C")');
  });

  it('escapes a trailing backslash so it cannot eat the closing quote (soundscape description)', () => {
    const cpp = file(doc({ zones: [zone({ soundscapeDescription: 'say "hi"\\\nnext' })] }), 'ProceduralAmbientLayer.cpp');
    expect(cpp).toContain('TEXT("say \\"hi\\"\\\\ next")');
  });

  it('a zone name cannot start a new statement after its // comment or close its /* */ block', () => {
    const evil = 'Z\nint injected = 1;/* x */';
    const d = doc({ zones: [zone({ name: evil })] });
    for (const name of ['AudioZoneAttenuation.cpp', 'AudioSceneVolumes.cpp', 'AudioSceneVolumes.h']) {
      const f = generateAudioCode(d, 'MyProject', 'MYPROJECT_API').files.find((x) => x.filename === name);
      if (!f) continue;
      expect(f.content, name).not.toMatch(/^int injected/m);
    }
    const all = generateAudioCode(d, 'MyProject', 'MYPROJECT_API').files.map((f) => f.content).join('\n');
    expect(all).not.toMatch(/^int injected/m);
    expect(all).not.toContain('x */ ');
  });

  it('a scene name with a newline stays on its header comment line', () => {
    const all = generateAudioCode(doc({ name: 'S\nint injected = 2;' }), 'MyProject', 'MYPROJECT_API')
      .files.map((f) => f.content).join('\n');
    expect(all).not.toMatch(/^int injected/m);
  });
});
