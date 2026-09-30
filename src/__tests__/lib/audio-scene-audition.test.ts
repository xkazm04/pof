import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { generateAudioCode } from '@/lib/audio-codegen';
import { auditionMix, type AuditionLibrary } from '@/lib/audio-scene-audition';
import { REVERB_PARAMS, OCCLUSION_VALUES } from '@/lib/audio-scene-acoustics';
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

describe('acoustics tables — one authority', () => {
  it('[guard] case 8: generateAudioCode output is byte-identical across the table move', () => {
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
    const out = generateAudioCode(doc, 'Did', 'DID_API').files
      .map((f) => `${f.filename}\n${f.content}`).join('\n----\n');
    expect(createHash('sha256').update(out).digest('hex')).toBe('56cd40d076a544b106a0222f72b06417f92706f6c131ab0bf11b98ac209d80a1');
  });
});
