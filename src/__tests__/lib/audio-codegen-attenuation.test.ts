import { describe, it, expect } from 'vitest';
import { generateAudioCode } from '@/lib/audio-codegen';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';

/**
 * The per-zone attenuation the painter edits must reach the generated C++.
 * `generateAttenuationCpp` used to build one block per zone and never write it,
 * so `ZoneAttenuations` stayed empty and `GetAttenuationForZone` always returned
 * nullptr — and nothing owned or initialised the asset anyway.
 */

function zone(over: Partial<AudioZone>): AudioZone {
  return {
    id: 'z', name: 'Z', shape: 'circle', x: 0, y: 0, width: 100, height: 100,
    soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1, reverbDiffusion: 0.5,
    reverbWetDry: 0.3, attenuationRadius: 1000, occlusionMode: 'none', priority: 5, color: 'var(--accent)',
    ...over,
  };
}

const DOC: AudioSceneDocument = {
  id: 1, name: 'Crypt', description: '', globalReverbPreset: 'cave',
  soundPoolSize: 32, maxConcurrentSounds: 16, lastGeneratedAt: null, createdAt: '', updatedAt: '',
  zones: [
    zone({ id: 'a', name: 'Nave', attenuationRadius: 2000 }),
    zone({ id: 'b', name: 'Crypt Door', attenuationRadius: 120 }),
    zone({ id: 'c', name: 'Bell Tower', attenuationRadius: 4500 }),
  ],
  emitters: [],
};

const file = (name: string) => {
  const f = generateAudioCode(DOC, 'PoF', 'POF_API').files.find((x) => x.filename === name);
  expect(f, name).toBeDefined();
  return f!.content;
};

describe('zone attenuation reaches the generated C++', () => {
  it('declares InitializeZones on UAudioZoneAttenuation', () => {
    expect(file('AudioZoneAttenuation.h')).toMatch(/void InitializeZones\(\);/);
  });

  it('emits one ZoneAttenuations.Add per zone, with the edited radius and the derived inner radius', () => {
    const cpp = file('AudioZoneAttenuation.cpp');
    expect(cpp).toMatch(/void UAudioZoneAttenuation::InitializeZones\(\)/);
    expect(cpp.match(/ZoneAttenuations\.Add\(/g)?.length).toBe(3);
    // inner = max(30% of radius, 50uu floor); falloff = the zone's attenuationRadius
    expect(cpp).toContain('CreateAttenuationAsset(this, FName(TEXT("Nave")), 600.f, 2000.f)');
    expect(cpp).toContain('CreateAttenuationAsset(this, FName(TEXT("Crypt_Door")), 50.f, 120.f)');
    expect(cpp).toContain('CreateAttenuationAsset(this, FName(TEXT("Bell_Tower")), 1350.f, 4500.f)');
  });

  it('the scene manager owns the attenuation asset and initialises it', () => {
    expect(file('AudioSceneManager.h')).toMatch(/TObjectPtr<UAudioZoneAttenuation> ZoneAttenuation;/);
    const cpp = file('AudioSceneManager.cpp');
    expect(cpp).toContain('ZoneAttenuation = NewObject<UAudioZoneAttenuation>(this);');
    expect(cpp).toContain('ZoneAttenuation->InitializeZones();');
  });
});

describe('a missing asset in the generated runtime is logged, not silent', () => {
  const doc: AudioSceneDocument = {
    ...DOC,
    zones: [zone({ id: 'a', name: 'Nave', soundscapeDescription: 'dripping water' })],
    emitters: [{
      id: 'e', name: 'Torch', type: 'loop', x: 0, y: 0, soundCueRef: '', attenuationRadius: 300,
      volumeMultiplier: 1, pitchMin: 1, pitchMax: 1, spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    }],
  };
  const get = (name: string) => generateAudioCode(doc, 'PoF', 'POF_API').files.find((f) => f.filename === name)!.content;

  it('ActivateLayer warns when the zone has no MetaSoundSource', () => {
    expect(get('ProceduralAmbientLayer.cpp')).toMatch(/if \(!Source\)\s*\{\s*UE_LOG\(LogTemp, Warning,[^;]*MetaSoundSource[^;]*;\s*return;\s*\}/);
  });

  it('each generated layer config says its MetaSoundSource must be assigned', () => {
    expect(get('ProceduralAmbientLayer.cpp')).toContain('// MetaSoundSource is not authored in PoF');
  });

  it('SpawnEmitter warns when the Sound Cue does not load', () => {
    expect(get('SceneEmitterSpawner.cpp')).toMatch(/if \(!Cue\)\s*\{\s*UE_LOG\(LogTemp, Warning,[^;]*;\s*return;\s*\}/);
  });
});
