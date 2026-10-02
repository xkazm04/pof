'use client';
import type { AudioZone } from '@/types/audio-scene';
import { useSceneZone, type SceneBuffer } from './useSceneBuffer';

interface ZoneSoundscapeFieldProps {
  zone: AudioZone;
  /** The AudioView session's scene buffer — the same one the painter writes. */
  buffer: SceneBuffer;
}

/**
 * One zone's soundscape textarea. Its text is a `patchZone` op in the session's
 * scene buffer, replayed onto the newest server copy at write time, so a typing
 * burst in two zones — or one after an unconfirmed painter drag — lands in one
 * write that keeps all of it. (It used to rewrite the WHOLE zones array from
 * `activeDoc`, reverting whatever that copy did not have yet.) A failed write is
 * the buffer's one banner, rendered by the tab.
 */
export function ZoneSoundscapeField({ zone, buffer }: ZoneSoundscapeFieldProps) {
  const record = useSceneZone(buffer, zone.id);

  return (
    <textarea
      value={record?.value.soundscapeDescription ?? zone.soundscapeDescription}
      onChange={(e) => record?.edit('soundscapeDescription', e.target.value)}
      aria-label={`Soundscape description for ${zone.name}`}
      placeholder={`Describe the soundscape for "${zone.name}"...\ne.g., 'dripping water echoing off stone walls, distant machinery hum'`}
      className="w-full px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed font-mono"
      rows={3}
    />
  );
}
