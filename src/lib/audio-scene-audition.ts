import type { ReverbPreset } from '@/types/audio-scene';
import { resolveMembership, zoneContains, type SceneDraft } from '@/lib/audio-scene-ops';
import { REVERB_PARAMS, OCCLUSION_VALUES } from '@/lib/audio-scene-acoustics';

/**
 * The painter's LISTEN mode, pure half: what a listener standing at a point
 * hears from a scene. Per emitter it yields a gain, a lowpass cutoff, a stereo
 * pan and the clip to loop — or the REASON it is silent (never silently
 * dropped). The live Web Audio graph (`useSceneAudition`) only applies this.
 *
 * Numbers:
 *   - distance: flat inside `innerRadius = max(20, 0.2 * attenuationRadius)`,
 *     then gain falls linearly and the cutoff sweeps 20 kHz -> 500 Hz across
 *     inner..radius; at the radius the emitter is out of range.
 *   - occlusion: an emitter inside a zone the listener is NOT inside takes that
 *     zone's occlusion row (volume AND cutoff), from the codegen's own table.
 *   - reverb: the listener's highest-priority containing zone
 *     (`resolveMembership`), its preset row from the codegen's table; a `custom`
 *     zone auditions its own decay/wet sliders.
 */

/** One generated clip of a set, as the library read returns it. */
export interface AuditionClip { relPath: string; favorite: boolean }
/** setId -> its clips. A set with no clips maps to `[]`; a missing key means the set is gone. */
export type AuditionLibrary = Readonly<Record<string, readonly AuditionClip[]>>;
export interface ListenerPoint { x: number; y: number }

export interface HeardEmitter {
  clipUrl: string;
  /** Linear gain (0..2): volumeMultiplier x distance x occlusion. */
  gain: number;
  lowpassHz: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
}

export type NotHeardReason = 'unbound' | 'no-clips' | 'set-missing' | 'out-of-range';

export interface AuditionReverb {
  preset: ReverbPreset;
  decayTime: number;
  wetDry: number;
  /** `custom`: the zone's own sliders; codegen ships the table's custom row instead. */
  fromZoneSliders: boolean;
}

export interface AuditionMix {
  heard: Record<string, HeardEmitter>;
  notHeard: Record<string, NotHeardReason>;
  activeZone: string | null;
  reverb: AuditionReverb;
}

export const MAX_LOWPASS_HZ = 20000;
const MIN_LOWPASS_HZ = 500;

export function innerRadiusOf(radius: number): number {
  return Math.max(20, 0.2 * radius);
}

export function clipUrlOf(relPath: string): string {
  return `/api/audio-asset?relPath=${encodeURIComponent(relPath)}`;
}

/** Linear gain -> whole dB (silence reads as -Infinity). */
export function gainToDb(gain: number): number {
  return gain > 0 ? Math.round(20 * Math.log10(gain)) : -Infinity;
}

export function auditionMix(scene: SceneDraft, listener: ListenerPoint, library: AuditionLibrary): AuditionMix {
  const heard: Record<string, HeardEmitter> = {};
  const notHeard: Record<string, NotHeardReason> = {};
  const zoneById = new Map(scene.zones.map((z) => [z.id, z]));

  for (const em of scene.emitters) {
    if (!em.assetSetId) { notHeard[em.id] = 'unbound'; continue; }
    const clips = library[em.assetSetId];
    if (!clips) { notHeard[em.id] = 'set-missing'; continue; }
    const clip = clips.find((c) => c.favorite) ?? clips[0];
    if (!clip) { notHeard[em.id] = 'no-clips'; continue; }

    const r = em.attenuationRadius;
    const d = Math.hypot(em.x - listener.x, em.y - listener.y);
    if (d >= r) { notHeard[em.id] = 'out-of-range'; continue; }
    const inner = innerRadiusOf(r);
    const t = d <= inner ? 0 : (d - inner) / (r - inner);
    let gain = em.volumeMultiplier * (1 - t);
    let lowpassHz = MAX_LOWPASS_HZ * Math.pow(MIN_LOWPASS_HZ / MAX_LOWPASS_HZ, t);

    const home = zoneById.get(resolveMembership(em.x, em.y, scene.zones) ?? '');
    if (home && !zoneContains(home, listener.x, listener.y)) {
      const occ = OCCLUSION_VALUES[home.occlusionMode];
      gain *= occ.volume;
      lowpassHz = Math.min(lowpassHz, occ.lpf);
    }
    const pan = Math.max(-1, Math.min(1, (em.x - listener.x) / r));
    heard[em.id] = { clipUrl: clipUrlOf(clip.relPath), gain, lowpassHz, pan };
  }

  const activeZone = resolveMembership(listener.x, listener.y, scene.zones);
  const zone = activeZone ? zoneById.get(activeZone) : undefined;
  const preset: ReverbPreset = zone?.reverbPreset ?? 'none';
  const fromZoneSliders = preset === 'custom' && !!zone;
  const reverb: AuditionReverb = fromZoneSliders && zone
    ? { preset, decayTime: zone.reverbDecayTime, wetDry: zone.reverbWetDry, fromZoneSliders }
    : { preset, decayTime: REVERB_PARAMS[preset].decayTime, wetDry: REVERB_PARAMS[preset].wetDry, fromZoneSliders };

  return { heard, notHeard, activeZone, reverb };
}
