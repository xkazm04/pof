'use client';

/**
 * One frame or clip of a decision option. Images are `<img>` (click to open full size), clips are native
 * `<video controls>`; a source that fails to load, or a path the server could not serve, says why instead of
 * leaving a blank box. The owner is comparing options side by side, so each item is captioned.
 */
import { useState } from 'react';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { DecisionMedia } from '@/lib/games/decisions/decisionTypes';

const BOX = { width: '100%', maxHeight: 240, objectFit: 'contain', background: 'var(--lab-panel)', display: 'block' } as const;

export function DecisionMediaItem({ t, media }: { t: LabTheme; media: DecisionMedia }) {
  const [failed, setFailed] = useState(false);
  const why = media.unservable ?? (failed ? 'the file did not load' : null);
  return (
    <figure data-testid="decision-media" data-kind={media.kind} style={{ margin: 0, display: 'grid', gap: 'var(--lab-s1)', minWidth: 0 }}>
      {why || !media.url ? (
        <div role="note" style={{ padding: 'var(--lab-s2)', border: `1px dashed ${t.line}`, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
          {media.name}: {why ?? 'no file'}
        </div>
      ) : media.kind === 'video' ? (
        <video controls preload="metadata" src={media.url} aria-label={media.name} style={BOX} onError={() => setFailed(true)} />
      ) : (
        <a href={media.url} target="_blank" rel="noreferrer" aria-label={`Open ${media.name} full size`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a served local file, size unknown */}
          <img src={media.url} alt={media.name} loading="lazy" style={BOX} onError={() => setFailed(true)} />
        </a>
      )}
      <figcaption style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{media.name}</figcaption>
    </figure>
  );
}
