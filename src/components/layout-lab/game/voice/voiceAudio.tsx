'use client';

/**
 * A take / preview player: the native `<audio controls>` (stock controls are the right controls here), plus
 * a visible reason when the source fails, instead of a dead player that looks merely silent (registry
 * `media-playback`: sources fail routinely, the response is designed, not discovered), and `onHeard` once the
 * listener has played it through (`HEARD_FRACTION`).
 */
import { useState } from 'react';
import type { LabTheme } from '@/components/layout-lab/theme';

const MEDIA_ERROR: Record<number, string> = {
  1: 'playback aborted',
  2: 'network error',
  3: 'the file could not be decoded',
  4: 'the server has no playable file for it',
};

/** Played this far through counts as heard (the last words of a line may trail into silence). */
export const HEARD_FRACTION = 0.8;

/** `fallbackSrc`: played instead when `src` fails (once), with `fallbackNote` saying what the owner now hears. */
export function VoiceAudio({ t, src, label, onHeard, fallbackSrc, fallbackNote }: {
  t: LabTheme; src: string; label: string; onHeard?: () => void; fallbackSrc?: string; fallbackNote?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const playing = fellBack && fallbackSrc ? fallbackSrc : src;
  return (
    <>
      <audio controls preload="none" src={playing} style={{ width: '100%' }} aria-label={label}
        onError={(e) => {
          if (fallbackSrc && !fellBack) { setFellBack(true); return; }
          setFailed(MEDIA_ERROR[e.currentTarget.error?.code ?? 0] ?? 'unknown media error');
        }}
        onCanPlay={() => setFailed(null)}
        onTimeUpdate={(e) => { const a = e.currentTarget; if (onHeard && a.duration > 0 && a.currentTime / a.duration >= HEARD_FRACTION) onHeard(); }}
        onEnded={() => onHeard?.()} />
      {fellBack && fallbackNote && !failed && (
        <span role="status" data-testid="voice-audio-fallback" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{fallbackNote}</span>
      )}
      {failed && (
        <span role="alert" data-testid="voice-audio-error" style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>
          Audio did not load: {failed}. Nothing was judged; generate a fresh take if the file is gone.
        </span>
      )}
    </>
  );
}
