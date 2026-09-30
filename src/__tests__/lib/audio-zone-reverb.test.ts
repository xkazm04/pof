import { describe, it, expect } from 'vitest';
import { generateAudioCode } from '@/lib/audio-codegen';
import { REVERB_PARAMS, resolveZoneReverb } from '@/lib/audio-scene-acoustics';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';

/**
 * One zone-reverb resolver: `resolveZoneReverb(zone)` is the ONE place a zone's
 * effective reverb is decided. A table preset is its REVERB_PARAMS row (the zone's
 * sliders are ignored — they are hidden in the panel and stale); `custom` is the
 * sliders' decay/diffusion/wet over the custom row's density/delays. The UE
 * codegen, the listen-mode audition and the decay glyph all read it.
 */

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'Z', name: 'Zone', shape: 'rect', x: 0, y: 0, width: 100, height: 100,
    soundscapeDescription: 'dripping water', reverbPreset: 'none', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'none', priority: 5, color: '',
    ...over,
  };
}

function doc(zones: AudioZone[]): AudioSceneDocument {
  return {
    id: 1, name: 'Reverb', description: '', globalReverbPreset: 'none',
    soundPoolSize: 32, maxConcurrentSounds: 16, lastGeneratedAt: null, createdAt: '', updatedAt: '',
    zones, emitters: [],
  };
}

const CRYPT = zone({
  id: 'C', name: 'Crypt', reverbPreset: 'custom',
  reverbDecayTime: 6.3, reverbDiffusion: 0.15, reverbWetDry: 0.85,
});

function fileOf(d: AudioSceneDocument, filename: string): string {
  const f = generateAudioCode(d, 'Did', 'DID_API').files.find((x) => x.filename === filename);
  if (!f) throw new Error(`${filename} not generated`);
  return f.content;
}

describe('resolveZoneReverb', () => {
  it('case 1: a table preset resolves to exactly its REVERB_PARAMS row; stale sliders are ignored', () => {
    const r = resolveZoneReverb(zone({
      reverbPreset: 'cave', reverbDecayTime: 1.5, reverbDiffusion: 0.7, reverbWetDry: 0.5,
    }));
    expect(r).toEqual({ ...REVERB_PARAMS.cave, fromZoneSliders: false });
    expect(r).toEqual({
      decayTime: 3.5, diffusion: 0.5, density: 0.9, wetDry: 0.6,
      earlyDelay: 0.03, lateDelay: 0.06, fromZoneSliders: false,
    });
  });

  it('case 2: custom resolves to the sliders over the custom row density/delays', () => {
    expect(resolveZoneReverb(CRYPT)).toEqual({
      decayTime: 6.3, diffusion: 0.15, wetDry: 0.85,
      density: REVERB_PARAMS.custom.density,
      earlyDelay: REVERB_PARAMS.custom.earlyDelay,
      lateDelay: REVERB_PARAMS.custom.lateDelay,
      fromZoneSliders: true,
    });
  });
});

describe('generateAudioCode reads the resolver', () => {
  it('case 3: a custom zone ships its own sliders to UE through a per-volume override', () => {
    const cpp = fileOf(doc([CRYPT]), 'SceneAudioVolume.cpp');
    const block = cpp.slice(cpp.indexOf(' * Zone: Crypt'));
    expect(block).toContain('Vol_Crypt->bUseCustomReverb = true;');
    expect(block).toContain('Vol_Crypt->CustomReverb.DecayTime = 6.3f;');
    expect(block).toContain('Vol_Crypt->CustomReverb.Diffusion = 0.15f;');
    expect(block).toContain('Vol_Crypt->CustomReverb.WetDryMix = 0.85f;');
    expect(cpp).toContain('bUseCustomReverb ? CustomReverb : PresetAsset->GetPresetConfig(ReverbPreset)');

    const h = fileOf(doc([CRYPT]), 'SceneAudioVolume.h');
    expect(h).toContain('bool bUseCustomReverb = false;');
    expect(h).toContain('FAudioReverbConfig CustomReverb;');

    // A table-preset zone carries no override.
    const cave = fileOf(doc([zone({ name: 'Cave', reverbPreset: 'cave' })]), 'SceneAudioVolume.cpp');
    expect(cave).not.toContain('Vol_Cave->bUseCustomReverb');
  });

  it('case 4: the MetaSound layer takes the resolved decay/wet, not the stale sliders', () => {
    const cpp = fileOf(doc([zone({ id: 'V', name: 'Cave', reverbPreset: 'cave' }), CRYPT]), 'ProceduralAmbientLayer.cpp');
    const cave = cpp.slice(cpp.indexOf('TEXT("Cave")'), cpp.indexOf('TEXT("Crypt")'));
    expect(cave).toContain('Config.CrossfadeDuration = 1.8f;');
    expect(cave).toContain('Config.WetMix = 0.60f;');
    const crypt = cpp.slice(cpp.indexOf('TEXT("Crypt")'));
    expect(crypt).toContain('Config.CrossfadeDuration = 3.1f;');
    expect(crypt).toContain('Config.WetMix = 0.85f;');

    // `none` has no reverb row to fade by: the layer keeps the struct defaults
    // rather than a 0 s fade to 0 volume (which would silence it).
    const none = fileOf(doc([zone({ name: 'Hall', reverbPreset: 'none' })]), 'ProceduralAmbientLayer.cpp');
    expect(none).not.toContain('Config.WetMix = 0.00f;');
    expect(none).not.toMatch(/Config\.CrossfadeDuration = /);
  });
});
