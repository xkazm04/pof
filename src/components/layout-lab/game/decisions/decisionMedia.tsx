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

/** A text frame (a lane's TTK table, a log): read on first open, shown monospace in a scrolling box. */
function TextFrame({ t, url, name }: { t: LabTheme; url: string; name: string }) {
  const [body, setBody] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = (open: boolean) => {
    if (!open || body !== null) return;
    fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBody).catch((e: unknown) => setErr(e instanceof Error ? e.message : 'the file did not load'));
  };
  return (
    <details onToggle={(e) => load(e.currentTarget.open)} style={{ border: `1px solid ${t.line}`, padding: 'var(--lab-s2)', minWidth: 0 }}>
      <summary style={{ cursor: 'pointer', fontSize: 'var(--lab-fs-xs)', color: t.text }}>Read {name}</summary>
      {err ? <div role="note" style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>{name}: {err}</div>
        : <pre data-testid="decision-text" style={{ margin: 'var(--lab-s2) 0 0', maxHeight: 280, overflow: 'auto', fontSize: 'var(--lab-fs-xs)', color: t.text, background: 'var(--lab-panel)', padding: 'var(--lab-s2)' }}>{body ?? 'Loading…'}</pre>}
    </details>
  );
}

export function DecisionMediaItem({ t, media }: { t: LabTheme; media: DecisionMedia }) {
  const [failed, setFailed] = useState(false);
  const why = media.unservable ?? (failed ? 'the file did not load' : null);
  return (
    <figure data-testid="decision-media" data-kind={media.kind} style={{ margin: 0, display: 'grid', gap: 'var(--lab-s1)', minWidth: 0 }}>
      {why || !media.url ? (
        <div role="note" style={{ padding: 'var(--lab-s2)', border: `1px dashed ${t.line}`, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
          {media.name}: {why ?? 'no file'}
        </div>
      ) : media.kind === 'text' ? (
        <TextFrame t={t} url={media.url} name={media.name} />
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
