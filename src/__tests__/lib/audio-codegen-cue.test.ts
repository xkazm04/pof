import { describe, it, expect } from 'vitest';
import {
  generateAudioCode,
  resolveEmitterCue,
  type AudioAssetBindings,
} from '@/lib/audio-codegen';
import type { AudioSceneDocument, SoundEmitter } from '@/types/audio-scene';

/**
 * Codegen used to emit `em.soundCueRef || '/Game/Audio/SC_<PascalCase(name)>'`:
 * a blank box produced a path with no relation to anything that exists, written
 * into the C++ exactly like a real asset reference. These tests pin the honest
 * contract — the bound set's REAL imported path when there is one, and a path
 * that is LABELLED a placeholder when there is not.
 */

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e1', name: 'Cave Drip', type: 'ambient', x: 2, y: 3, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}

function doc(emitters: SoundEmitter[]): AudioSceneDocument {
  return {
    id: 1, name: 'Cavern', description: '', zones: [], emitters,
    globalReverbPreset: 'none', soundPoolSize: 32, maxConcurrentSounds: 16,
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
  };
}

const BINDINGS: AudioAssetBindings = {
  'set-imported': { setName: 'Cave Drips', cuePath: '/Game/Audio/CaveDrips/SC_CaveDrips' },
  'set-fresh': { setName: 'Wind Gusts', cuePath: null },
};

/** The emitter block of the generated spawner .cpp. */
function spawnerCpp(d: AudioSceneDocument, bindings?: AudioAssetBindings): string {
  const result = generateAudioCode(d, 'MyProject', 'MYPROJECT_API', bindings);
  const file = result.files.find((f) => f.filename === 'SceneEmitterSpawner.cpp');
  expect(file).toBeTruthy();
  return file!.content;
}

describe('resolveEmitterCue', () => {
  it('uses the bound set’s recorded import path and names the set', () => {
    const cue = resolveEmitterCue(emitter({ assetSetId: 'set-imported' }), BINDINGS);
    expect(cue.provenance).toBe('imported');
    expect(cue.cuePath).toBe('/Game/Audio/CaveDrips/SC_CaveDrips');
    expect(cue.comment).toContain('Cave Drips');
    expect(cue.comment).toContain('recorded UE import');
  });

  it('prefers the real import over a stale hand-typed path', () => {
    const cue = resolveEmitterCue(
      emitter({ assetSetId: 'set-imported', soundCueRef: '/Game/Audio/SC_TypedByHand' }),
      BINDINGS,
    );
    expect(cue.cuePath).toBe('/Game/Audio/CaveDrips/SC_CaveDrips');
  });

  it('says a bound-but-never-imported set has no import, and labels the placeholder', () => {
    const cue = resolveEmitterCue(emitter({ assetSetId: 'set-fresh' }), BINDINGS);
    expect(cue.provenance).toBe('placeholder');
    expect(cue.cuePath).toBe('/Game/Audio/SC_CaveDrip');
    expect(cue.comment).toContain('PLACEHOLDER');
    expect(cue.comment).toContain('Wind Gusts');
    expect(cue.comment).toContain('NO recorded UE import');
  });

  it('reports a binding whose set has been deleted rather than silently guessing', () => {
    const cue = resolveEmitterCue(emitter({ assetSetId: 'set-gone' }), BINDINGS);
    expect(cue.provenance).toBe('placeholder');
    expect(cue.comment).toContain('no longer exists');
  });

  it('keeps the manual path as an unverified override', () => {
    const cue = resolveEmitterCue(emitter({ soundCueRef: '/Game/Audio/SC_Manual' }), BINDINGS);
    expect(cue.provenance).toBe('manual');
    expect(cue.cuePath).toBe('/Game/Audio/SC_Manual');
    expect(cue.comment).toContain('NOT verified');
  });

  it('labels the unbound, unfilled case instead of presenting the guess as real', () => {
    const cue = resolveEmitterCue(emitter(), {});
    expect(cue.provenance).toBe('placeholder');
    expect(cue.cuePath).toBe('/Game/Audio/SC_CaveDrip'); // ← was emitted with no caveat at all
    expect(cue.comment).toContain('PLACEHOLDER');
    expect(cue.comment).toContain('nothing is bound');
  });
});

describe('generateAudioCode — emitted cue paths', () => {
  it('writes the real imported path into the spawner', () => {
    const cpp = spawnerCpp(doc([emitter({ assetSetId: 'set-imported' })]), BINDINGS);
    expect(cpp).toContain('FSoftObjectPath(TEXT("/Game/Audio/CaveDrips/SC_CaveDrips"))');
    expect(cpp).toContain('// Cue path from the recorded UE import of audio set "Cave Drips".');
    expect(cpp).not.toContain('PLACEHOLDER');
  });

  it('writes the honest fallback comment adjacent to the placeholder path', () => {
    const cpp = spawnerCpp(doc([emitter({ assetSetId: 'set-fresh' })]), BINDINGS);
    const lines = cpp.split('\n');
    const pathLine = lines.findIndex((l) => l.includes('FSoftObjectPath'));
    expect(lines[pathLine - 1]).toContain('PLACEHOLDER');
    expect(lines[pathLine - 1]).toContain('Wind Gusts');
    expect(lines[pathLine]).toContain('/Game/Audio/SC_CaveDrip');
  });

  it('still generates unchanged output for callers that resolve no bindings', () => {
    const cpp = spawnerCpp(doc([emitter({ soundCueRef: '/Game/Audio/SC_Legacy' })]));
    expect(cpp).toContain('FSoftObjectPath(TEXT("/Game/Audio/SC_Legacy"))');
    expect(cpp).toContain('NOT verified against a UE import');
  });
});
