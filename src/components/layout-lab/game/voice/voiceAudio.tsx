'use client';

/**
 * A take / preview player: the native `<audio controls>` (stock controls are the right controls here), plus
 * a visible reason when the source fails, instead of a dead player that looks merely silent (registry
 * `media-playback`: sources fail routinely, the response is designed, not discovered).
 */
import { useState } from 'react';
import type { LabTheme } from '@/components/layout-lab/theme';

const MEDIA_ERROR: Record<number, string> = {
  1: 'playback aborted',
  2: 'network error',
  3: 'the file could not be decoded',
  4: 'the server has no playable file for it',
};

export function VoiceAudio({ t, src, label }: { t: LabTheme; src: string; label: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <>
      <audio controls preload="none" src={src} style={{ width: '100%' }} aria-label={label}
        onError={(e) => setFailed(MEDIA_ERROR[e.currentTarget.error?.code ?? 0] ?? 'unknown media error')}
        onCanPlay={() => setFailed(null)} />
      {failed && (
        <span role="alert" data-testid="voice-audio-error" style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>
          Audio did not load: {failed}. Nothing was judged; generate a fresh take if the file is gone.
        </span>
      )}
    </>
  );
}
