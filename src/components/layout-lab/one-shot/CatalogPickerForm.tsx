'use client';

import { useEffect, useState } from 'react';
import type { LabTheme } from '../theme';
import { tryApiFetch } from '@/lib/api-utils';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { gapTargetAction, type CatalogGapRanking, type GapTarget } from '@/lib/catalog/gap-analysis/rankGaps';

interface Props {
  t: LabTheme;
  catalogInput: string;
  onCatalogChange: (v: string) => void;
  /** Analyze the selected catalog only (stops at `analyzed`; no LLM run). */
  onStart: () => void;
  /** A ranked gap was clicked: analyze its catalog, then propose aimed at it. */
  onPickGap: (target: GapTarget) => void;
}

type GapsState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; ranking: CatalogGapRanking };

/** GET /api/one-shot/gaps once per mount — cheap (no LLM), so the idle panel opens on it. */
function useRankedGaps(): GapsState {
  const [state, setState] = useState<GapsState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void tryApiFetch<CatalogGapRanking>('/api/one-shot/gaps').then((r) => {
      if (!live) return;
      setState(r.ok ? { status: 'ready', ranking: r.data } : { status: 'error', error: r.error });
    });
    return () => { live = false; };
  }, []);
  return state;
}

/**
 * Idle phase, gap-first: the ranked gaps the app already computed across every catalog, each a
 * one-click proposal target — then a catalog select (never free text, so no typo analyzes an
 * empty catalog) for "no gap, just this catalog". The direction/hint is asked AFTER analysis,
 * when the distribution it should react to is on screen.
 */
export function CatalogPickerForm({ t, catalogInput, onCatalogChange, onStart, onPickGap }: Props) {
  const gaps = useRankedGaps();
  const caption: React.CSSProperties = { display: 'block', fontSize: 12, color: t.muted, marginBottom: 6 };

  return (
    <div>
      <div className={t.fontMono} style={{ ...caption, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Ranked gaps · all catalogs
      </div>
      {gaps.status === 'loading' && (
        <div className={t.fontMono} style={{ fontSize: 12, color: t.muted, marginBottom: 12 }}>Measuring every catalog…</div>
      )}
      {gaps.status === 'error' && (
        <div className={t.fontMono} style={{ fontSize: 12, color: t.bad, marginBottom: 12 }}>
          Could not rank gaps: {gaps.error}
        </div>
      )}
      {gaps.status === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {gaps.ranking.targets.length === 0 && (
            <div className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>No measured gap in any catalog.</div>
          )}
          {gaps.ranking.targets.map((g) => (
            <button
              key={`${g.catalogId}:${g.attribute}=${g.value}`}
              type="button"
              data-testid="one-shot-gap-target"
              onClick={() => onPickGap(g)}
              className={t.fontMono}
              style={{
                textAlign: 'left', fontSize: 12, padding: '7px 10px', cursor: 'pointer',
                background: 'transparent', color: t.text, border: `1px solid ${t.warn}`,
              }}
            >
              {gapTargetAction(g)}
              <span style={{ color: t.warn }}> · short {g.deficit}</span>
            </button>
          ))}
          {gaps.ranking.unmeasured.length > 0 && (
            <div className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>
              Unmeasured (no expected share — not a finding of balance): {gaps.ranking.unmeasured.join(', ')}
            </div>
          )}
        </div>
      )}

      <label htmlFor="oneshot-catalog" className={t.fontMono} style={caption}>
        Or analyze one catalog
      </label>
      <select
        id="oneshot-catalog"
        value={catalogInput}
        onChange={(e) => onCatalogChange(e.target.value)}
        aria-label="catalog"
        style={{
          width: '100%', fontSize: 14, padding: '7px 10px', marginBottom: 12, boxSizing: 'border-box',
          background: t.panel, color: t.text, border: `1px solid ${t.line}`, outline: 'none',
        }}
      >
        {CATALOG_SECTIONS.map((s) => (
          <option key={s.catalogId} value={s.catalogId}>{s.label}</option>
        ))}
      </select>
      <button
        onClick={onStart}
        className={t.fontMono}
        style={{
          width: '100%', fontSize: 14, padding: '8px 16px', cursor: 'pointer',
          background: t.ink, color: t.onAccent, border: `1px solid ${t.ink}`, fontWeight: 600,
        }}
      >
        Analyze
      </button>
    </div>
  );
}
