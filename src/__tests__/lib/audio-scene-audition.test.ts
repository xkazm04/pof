import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateAudioCode } from '@/lib/audio-codegen';
import { auditionMix, type AuditionLibrary } from '@/lib/audio-scene-audition';
import { REVERB_PARAMS, OCCLUSION_VALUES, resolveZoneReverb } from '@/lib/audio-scene-acoustics';
import type {
  AudioSceneDocument, AudioZone, SoundEmitter, ReverbPreset, OcclusionMode,
} from '@/types/audio-scene';

/**
 * The painter's LISTEN mode: `auditionMix` is the pure half — per emitter, what a
 * listener at a point hears (gain, lowpass, clip) or why it hears nothing, plus
 * the active zone's reverb row. The numbers come from the SAME acoustics tables
 * the UE codegen ships (`lib/audio-scene-acoustics.ts`).
 */

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e', name: 'Torch', type: 'loop', x: 100, y: 100, soundCueRef: '',
    assetSetId: 'S', attenuationRadius: 200, volumeMultiplier: 0.8,
    pitchMin: 1, pitchMax: 1, spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'Z', name: 'Zone', shape: 'rect', x: 0, y: 0, width: 1000, height: 1000,
    soundscapeDescription: '', reverbPreset: 'none', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'none', priority: 5, color: '',
    ...over,
  };
}

const LIB: AuditionLibrary = {
  S: [
    { relPath: 'sets/S/a.mp3', favorite: false },
    { relPath: 'sets/S/b.mp3', favorite: true },
    { relPath: 'sets/S/c.mp3', favorite: false },
  ],
  EMPTY: [],
};

/** Listener `d` units right of the emitter at (100,100). */
const at = (d: number) => ({ x: 100 + d, y: 100 });

describe('auditionMix — distance', () => {
  it('case 1: listener on the emitter hears volumeMultiplier, unfiltered', () => {
    const mix = auditionMix({ zones: [], emitters: [emitter()] }, at(0), LIB);
    expect(mix.heard.e.gain).toBeCloseTo(0.8, 6);
    expect(mix.heard.e.lowpassHz).toBe(20000);
  });

  it('case 2: inner radius max(20, 0.2r) is flat; the curve falls to out-of-range at r', () => {
    const scene = { zones: [], emitters: [emitter()] };
    expect(auditionMix(scene, at(30), LIB).heard.e.gain).toBeCloseTo(0.8, 6);
    const mid = auditionMix(scene, at(120), LIB).heard.e;
    expect(mid.gain).toBeGreaterThan(0);
    expect(mid.gain).toBeLessThan(0.8);
    expect(mid.lowpassHz).toBeGreaterThan(500);
    expect(mid.lowpassHz).toBeLessThan(20000);
    const edge = auditionMix(scene, at(200), LIB);
    expect(edge.heard.e).toBeUndefined();
    expect(edge.notHeard.e).toBe('out-of-range');

    const gains = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]
      .map((d) => auditionMix(scene, at(d), LIB).heard.e?.gain ?? 0);
    for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeLessThanOrEqual(gains[i - 1]);
  });
});

describe('auditionMix — zones', () => {
  it('case 3: the highest-priority containing zone sets the reverb row; custom uses its own values', () => {
    const A = zone({ id: 'A', priority: 3, reverbPreset: 'cave' });
    const B = zone({ id: 'B', priority: 7, reverbPreset: 'small-room', x: 50, y: 50, width: 200, height: 200 });
    const mix = auditionMix({ zones: [A, B], emitters: [emitter()] }, at(0), LIB);
    expect(mix.activeZone).toBe('B');
    expect(mix.reverb.decayTime).toBe(0.8);
    expect(mix.reverb.wetDry).toBe(0.3);

    const C = zone({ id: 'C', reverbPreset: 'custom', reverbDecayTime: 1.7, reverbWetDry: 0.45 });
    const custom = auditionMix({ zones: [C], emitters: [emitter()] }, at(0), LIB);
    expect(custom.reverb.decayTime).toBe(1.7);
    expect(custom.reverb.wetDry).toBe(0.45);
    expect(custom.reverb.decayTime).not.toBe(REVERB_PARAMS.custom.decayTime);
  });

  it('case 4: an emitter in an occluding zone the listener is outside of is attenuated and filtered', () => {
    const C = zone({ id: 'C', occlusionMode: 'high', x: 50, y: 50, width: 100, height: 100 });
    const open = auditionMix({ zones: [], emitters: [emitter()] }, at(90), LIB).heard.e;
    const occluded = auditionMix({ zones: [C], emitters: [emitter()] }, at(90), LIB).heard.e;
    expect(occluded.gain).toBeCloseTo(open.gain * OCCLUSION_VALUES.high.volume, 6);
    expect(OCCLUSION_VALUES.high.volume).toBe(0.35);
    expect(occluded.lowpassHz).toBeLessThanOrEqual(2000);

    const inside = auditionMix({ zones: [C], emitters: [emitter()] }, at(40), LIB).heard.e;
    const insideOpen = auditionMix({ zones: [], emitters: [emitter()] }, at(40), LIB).heard.e;
    expect(inside.gain).toBeCloseTo(insideOpen.gain, 6);
    expect(inside.lowpassHz).toBe(insideOpen.lowpassHz);
  });
});

describe('auditionMix — clip resolution', () => {
  it('case 5: favorite clip, else a named reason — never silently dropped', () => {
    const mix = auditionMix({
      zones: [],
      emitters: [
        emitter(),
        emitter({ id: 'empty', assetSetId: 'EMPTY' }),
        emitter({ id: 'manual', assetSetId: null, soundCueRef: '/Game/Audio/SC_Torch' }),
        emitter({ id: 'gone', assetSetId: 'deleted-set' }),
      ],
    }, at(0), LIB);
    expect(mix.heard.e.clipUrl).toBe(`/api/audio-asset?relPath=${encodeURIComponent('sets/S/b.mp3')}`);
    expect(mix.notHeard.empty).toBe('no-clips');
    expect(mix.notHeard.manual).toBe('unbound');
    expect(mix.notHeard.gone).toBe('set-missing');
    expect(Object.keys(mix.heard).length + Object.keys(mix.notHeard).length).toBe(4);
  });
});

describe('auditionMix — one zone-reverb resolver', () => {
  it('case 5: for every preset the audition plays resolveZoneReverb(zone), not an inline copy', () => {
    const presets: ReverbPreset[] = ['none', 'small-room', 'large-hall', 'cave', 'outdoor',
      'underwater', 'metal-corridor', 'stone-chamber', 'forest', 'custom'];
    for (const p of presets) {
      const z = zone({ reverbPreset: p, reverbDecayTime: 6.3, reverbDiffusion: 0.15, reverbWetDry: 0.85 });
      const mix = auditionMix({ zones: [z], emitters: [emitter()] }, at(0), LIB);
      const r = resolveZoneReverb(z);
      expect(mix.activeZone).toBe('Z');
      expect(mix.reverb.decayTime).toBe(r.decayTime);
      expect(mix.reverb.wetDry).toBe(r.wetDry);
      expect(mix.reverb.fromZoneSliders).toBe(r.fromZoneSliders);
    }
    const src = readFileSync(join(process.cwd(), 'src/lib/audio-scene-audition.ts'), 'utf8');
    expect(src).toContain('resolveZoneReverb(');
    expect(src).not.toMatch(/reverbDecayTime|reverbWetDry|REVERB_PARAMS\[/);
  });
});

/** Per-file sha256 of the case-8 fixture output, taken on the base BEFORE the resolver. */
const BASE_FILE_SHA: Record<string, string> = {
  'AudioReverbPresets.h': '1f55f4386662581dd923528799bccfa672b893a110e257ea3f35745a088e6dfd',
  'AudioReverbPresets.cpp': '8226e98178cb01ce3f5bba231b3d190303b3866fe5844f118f183ce25f849051',
  'AudioZoneAttenuation.h': 'c137953add3560ea80404db404a69b9d6d44441f9c2c7b0fb6249fd7c4407705',
  'AudioZoneAttenuation.cpp': '1a47e8d5eeca0a2ef587edccc23dde6de322c28713639967cd811fb2a01f30e1',
  'SceneEmitterSpawner.h': '480a2efd7148b77e2789b788b72989b223cc3118a6b46618e8bb615b58338e94',
  'SceneEmitterSpawner.cpp': 'f6d193ddb472f32ed2fa925d487bbd50d93e171e23a12d235426af5695553848',
  'AudioSceneManager.h': '331664005c704c2c5e134602bed423ee5765d95bf8e8d092d5249ed5d6ec0a4d',
  'AudioSceneManager.cpp': '5d5742292112854a65312d356a497834ff7bfb0fd0266294ca65ba31904862cd',
};
/** The only generated files the zone-reverb resolver may change. */
const RESOLVER_FILES = ['SceneAudioVolume.h', 'SceneAudioVolume.cpp', 'ProceduralAmbientLayer.cpp'];

describe('acoustics tables — one authority', () => {
  it('[guard] case 8: every generated file outside the resolver\'s three is byte-identical to base; then the whole output', () => {
    const presets: ReverbPreset[] = ['none', 'small-room', 'large-hall', 'cave', 'outdoor',
      'underwater', 'metal-corridor', 'stone-chamber', 'forest', 'custom'];
    const modes: OcclusionMode[] = ['none', 'low', 'medium', 'high', 'full'];
    const doc: AudioSceneDocument = {
      id: 1, name: 'Fixture', description: '', globalReverbPreset: 'cave',
      soundPoolSize: 32, maxConcurrentSounds: 16, lastGeneratedAt: null, createdAt: '', updatedAt: '',
      zones: presets.map((p, i) => zone({
        id: `z${i}`, name: `Zone ${p}`, reverbPreset: p, occlusionMode: modes[i % modes.length],
        x: i * 50, priority: i,
      })),
      emitters: [emitter({ assetSetId: null, soundCueRef: '/Game/Audio/SC_Torch' })],
    };
    const files = generateAudioCode(doc, 'Did', 'DID_API').files;
    const sha = (s: string) => createHash('sha256').update(s).digest('hex');
    const outside = files.filter((f) => !RESOLVER_FILES.includes(f.filename));
    expect(Object.fromEntries(outside.map((f) => [f.filename, sha(f.content)]))).toEqual(BASE_FILE_SHA);

    const out = files.map((f) => `${f.filename}\n${f.content}`).join('\n----\n');
    expect(sha(out)).toBe('2e60116d6ec3410a4ac945a58552e0f9fc9b7abb8bc435031e12269a66100ad0');
  });
});
