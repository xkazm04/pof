'use client';

import { useState } from 'react';
import type { LabTheme } from '../../theme';
import { type GenBatch, type GenHistory, allCandidates } from './genHistory';

/**
 * Shared "Gallery2D" candidate browser (CLAUDE.md → Shared Component Manifest).
 *
 * Renders a generative step's full {@link GenHistory}: every re-roll batch (newest
 * first), each stamped with its direction + an expandable full prompt, over a grid
 * of candidate thumbnails. The selected candidate is highlighted with a ✓ (not color
 * alone). Clicking any candidate re-selects it — so an artist can A/B-compare across
 * re-rolls and recover the winning art direction. Presentational only: persistence +
 * payload projection happen in the calling step via `historyData`.
 */
export interface CandidateGalleryProps {
  t: LabTheme;
  history: GenHistory;
  /** Re-select a candidate (the caller persists the new selection). */
  onSelect: (candidateId: string) => void;
  /** Shown when no candidates have been generated yet. */
  emptyHint?: string;
  /** Thumbnail grid columns (default 2). */
  columns?: number;
}

export function CandidateGallery({ t, history, onSelect, emptyHint, columns = 2 }: CandidateGalleryProps) {
  const total = allCandidates(history).length;
  if (total === 0) {
    return (
      <span data-testid="candidate-gallery-empty" style={{ fontSize: 14, color: t.muted }}>
        {emptyHint ?? 'No candidates yet — run Produce to generate a batch.'}
      </span>
    );
  }
  // Newest re-roll first (browse-history order); keep each batch's chronological number.
  const ordered = history.batches.map((b, i) => ({ b, n: i + 1 })).reverse();
  const rerolls = history.batches.length;
  return (
    <div data-testid="candidate-gallery" style={{ display: 'grid', gap: 16 }}>
      <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>
        {total} candidate{total === 1 ? '' : 's'} · {rerolls} re-roll{rerolls === 1 ? '' : 's'} kept
      </span>
      {ordered.map(({ b, n }, idx) => (
        <BatchBlock
          key={b.id}
          t={t}
          batch={b}
          n={n}
          latest={n === rerolls}
          divider={idx > 0}
          selectedId={history.selectedId}
          onSelect={onSelect}
          columns={columns}
        />
      ))}
    </div>
  );
}

function BatchBlock({ t, batch, n, latest, divider, selectedId, onSelect, columns }: {
  t: LabTheme; batch: GenBatch; n: number; latest: boolean; divider: boolean;
  selectedId: string | null; onSelect: (id: string) => void; columns: number;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const time = batch.at.slice(11, 19); // HH:MM:SS from the ISO stamp (pure, TZ-stable)
  return (
    <div style={{ display: 'grid', gap: 8, paddingTop: divider ? 12 : 0, borderTop: divider ? `1px solid ${t.line}` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className={t.fontMono} style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
          Batch {n}{latest ? ' · latest' : ''}
        </span>
        <span className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>{time}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: t.text }}>
          {batch.direction
            ? batch.direction
            : <em style={{ color: t.muted }}>no direction given</em>}
        </span>
        <button
          onClick={() => setShowPrompt((v) => !v)}
          className={t.fontMono}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: t.muted, textDecoration: 'underline' }}
        >
          {showPrompt ? 'hide prompt' : 'view prompt'}
        </button>
      </div>
      {showPrompt && (
        <pre data-testid={`batch-prompt-${batch.id}`} className={t.fontMono}
          style={{ fontSize: 13, color: t.muted, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.55, padding: 10, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0 }}>
          {batch.prompt}
        </pre>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10 }}>
        {batch.candidates.map((c, i) => {
          const sel = c.id === selectedId;
          return (
            <button
              key={c.id}
              data-testid={`candidate-${c.id}`}
              onClick={() => onSelect(c.id)}
              aria-pressed={sel}
              aria-label={`Batch ${n} candidate ${i + 1}${sel ? ' (selected)' : ''}${batch.direction ? ` — ${batch.direction}` : ''}`}
              title={batch.direction || batch.prompt}
              style={{ display: 'grid', gap: 4, cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, textAlign: 'left' }}
            >
              <span style={{ display: 'block', width: '100%', aspectRatio: '1', borderRadius: t.glass ? 10 : 2, background: c.swatch, border: sel ? `3px solid ${t.ink}` : `1px solid ${t.line}`, boxShadow: sel ? `0 0 0 3px ${t.accentBg}` : 'none', position: 'relative' }}>
                {sel && (
                  <span aria-hidden="true" style={{ position: 'absolute', top: 4, right: 6, width: 18, height: 18, borderRadius: 999, background: t.ink, color: t.onAccent, fontSize: 13, fontWeight: 700, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                )}
              </span>
              {c.caption && (
                <span className={t.fontMono} style={{ fontSize: 13, textAlign: 'center', color: sel ? t.inkDeep : t.muted }}>{c.caption}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
