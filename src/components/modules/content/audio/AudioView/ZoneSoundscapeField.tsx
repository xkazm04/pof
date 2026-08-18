'use client';
import { useCallback, useEffect, useRef } from 'react';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { AudioZone } from '@/types/audio-scene';
import { useDebouncedCommit } from './useDebouncedCommit';

interface ZoneSoundscapeFieldProps {
  zone: AudioZone;
  /** Every zone in the scene — the commit rewrites the whole array. */
  zones: AudioZone[];
  commitZones: (zones: AudioZone[]) => Promise<void>;
}

/**
 * One zone's soundscape textarea. Typing used to PUT the ENTIRE scene (and refetch
 * every scene) per keystroke; now the text lives locally and is written once per
 * typing pause. Mounted with `key={zone.id}` so the local draft belongs to exactly
 * one zone.
 */
export function ZoneSoundscapeField({ zone, zones, commitZones }: ZoneSoundscapeFieldProps) {
  // Read the zone list at COMMIT time, not at keystroke time — a sibling zone may
  // have been saved while this field's debounce was still counting down.
  const zonesRef = useRef(zones);
  useEffect(() => { zonesRef.current = zones; });

  const commit = useCallback(
    (text: string) => commitZones(
      zonesRef.current.map((z) => (z.id === zone.id ? { ...z, soundscapeDescription: text } : z)),
    ),
    [commitZones, zone.id],
  );

  const field = useDebouncedCommit(zone.soundscapeDescription, commit);

  return (
    <>
      <textarea
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        aria-label={`Soundscape description for ${zone.name}`}
        placeholder={`Describe the soundscape for "${zone.name}"...\ne.g., 'dripping water echoing off stone walls, distant machinery hum'`}
        className="w-full px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed font-mono"
        rows={3}
      />
      {field.error && (
        <div className="mt-1.5">
          <InlineErrorRetry
            message={`${field.error} — your text is still here.`}
            onRetry={field.retry}
            onDismiss={field.dismissError}
            dismissLabel="Dismiss save error"
            dense
          />
        </div>
      )}
    </>
  );
}
