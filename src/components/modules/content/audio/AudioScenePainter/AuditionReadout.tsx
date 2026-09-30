'use client';

import { useMemo } from 'react';
import { Play, Square } from 'lucide-react';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import {
  auditionMix, gainToDb, MAX_LOWPASS_HZ,
  type ListenerPoint, type NotHeardReason,
} from '@/lib/audio-scene-audition';
import { useAudioSetLibrary } from '@/components/modules/content/audio/AudioPropertyPanel/useAudioSetLibrary';
import { useSceneAudition } from './useSceneAudition';

const REASON_HINT: Record<NotHeardReason, string> = {
  'unbound': 'no audio set bound',
  'no-clips': 'bound set has no clips',
  'set-missing': 'bound set no longer exists',
  'out-of-range': 'beyond its attenuation radius',
};

/**
 * LISTEN mode's panel: owns the audition (library read, mix, Web Audio graph),
 * so leaving LISTEN unmounts it and the audio stops with it. Lists every
 * emitter — heard with its level, or silent with the reason; clicking a row
 * selects that emitter so its binding is one click away in the property panel.
 * Nothing plays until Play is clicked.
 */
export function AuditionReadout({ zones, emitters, listener, onSelectEmitter, accentColor }: {
  zones: AudioZone[];
  emitters: SoundEmitter[];
  listener: ListenerPoint | null;
  onSelectEmitter: (id: string) => void;
  accentColor: string;
}) {
  const library = useAudioSetLibrary(true);
  const mix = useMemo(
    () => (listener && !library.isLoading && !library.error ? auditionMix({ zones, emitters }, listener, library.clipsBySet) : null),
    [zones, emitters, listener, library.isLoading, library.error, library.clipsBySet],
  );
  const { playing, error, play, stop } = useSceneAudition(mix);
  const zone = mix?.activeZone ? zones.find((z) => z.id === mix.activeZone) : undefined;

  return (
    <div className="absolute top-20 left-4 z-10 w-72 max-h-[60%] overflow-y-auto bg-surface border border-border rounded-xl p-3 text-xs backdrop-blur-md space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-widest text-2xs text-text-muted">Audition</span>
        <button
          type="button"
          onClick={playing ? stop : () => void play()}
          disabled={!mix}
          aria-label={playing ? 'Stop' : 'Play'}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-text disabled:opacity-40 focus-ring"
          style={{ color: accentColor }}
        >
          {playing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? 'Stop' : 'Play'}
        </button>
      </div>

      {library.error && <p style={{ color: STATUS_ERROR }}>{library.error}</p>}
      {error && <p style={{ color: STATUS_WARNING }}>{error}</p>}
      {!listener ? (
        <p className="text-text-muted">Click the canvas to place the listener.</p>
      ) : !mix ? (
        <p className="text-text-muted">Reading the audio library…</p>
      ) : (
        <>
          <p className="text-text-muted">
            {zone ? zone.name : 'No zone'} · reverb {mix.reverb.preset} {mix.reverb.decayTime.toFixed(1)}s /{' '}
            {Math.round(mix.reverb.wetDry * 100)}% wet
            {mix.reverb.fromZoneSliders && ' (zone sliders; UE codegen ships them as the volume\'s CustomReverb)'}
          </p>
          <ul className="space-y-0.5">
            {emitters.filter((em) => mix.heard[em.id]).map((em) => {
              const h = mix.heard[em.id];
              return (
                <li key={em.id} data-testid={`audition-heard-${em.id}`} className="flex justify-between gap-2 text-text">
                  <span className="truncate">{em.name}</span>
                  <span className="font-mono tabular-nums">
                    {gainToDb(h.gain)} dB{h.lowpassHz < MAX_LOWPASS_HZ ? ` · LPF ${(h.lowpassHz / 1000).toFixed(1)}k` : ''}
                  </span>
                </li>
              );
            })}
            {emitters.filter((em) => mix.notHeard[em.id]).map((em) => (
              <li key={em.id}>
                <button
                  type="button"
                  data-testid={`audition-silent-${em.id}`}
                  onClick={() => onSelectEmitter(em.id)}
                  title={REASON_HINT[mix.notHeard[em.id]]}
                  className="w-full text-left text-text-muted hover:text-text truncate"
                >
                  {em.name}: not heard ({mix.notHeard[em.id]})
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
