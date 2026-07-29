'use client';

import '@/lib/catalog/pipelines/registry.generated';
import { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useCachedArtifacts, retryArtifacts } from './labArtifactCache';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { useLabPipelineStore } from './labPipelineStore';
import { useLabDetail } from './useLabCatalogData';
import { resolveCatalogSteps } from './catalogManifest';
import { buildMatrixRows } from './matrixRows';
import { useCatalogJudgeVerdicts } from './hooks/useStepJudgeVerdicts';
import { MatrixBatchDrain } from './MatrixBatchDrain';
import { useBatchDrain } from './hooks/useBatchDrain';
import { MatrixSkeleton } from './MatrixSkeleton';
import { STATUS_GLYPH, STATUS_WORD, statusColor, UNPRODUCED_GLYPH, UNPRODUCED_WORD, type LabDisplayStatus } from './statusLanguage';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from './theme';
import type { LabGroup } from './useLabCatalogData';

const pad2 = (n: number) => String(n).padStart(2, '0');

interface Props {
  t: LabTheme;
  groups: LabGroup[];
  catalogId: string;
  /** Write-through: the dropdown selects a catalog by updating LayoutLab's single-source catalogId. */
  onSelectCatalog: (id: string) => void;
  onOpenStep: (catalogId: string, entityId: string, stepIdx: number) => void;
}

/**
 * Catalog-wide pipeline status matrix: every entity in a catalog (rows) × every
 * pipeline step (columns), each cell colored by its derived Acceptance status. Status
 * is derived through the SAME `deriveEntityArtifacts` path the rail uses (via
 * `buildMatrixRows`), so the matrix and the rail can never disagree about a step. A
 * per-entity strip shows "X of N steps complete" and flags blockers (failed gates).
 * Click any cell to jump straight to that entity's step; pick a catalog from the selector.
 */
export function CatalogMatrix({ t, groups, catalogId, onSelectCatalog, onOpenStep }: Props) {
  // Controlled by LayoutLab's single-source catalogId — the dropdown writes through
  // `onSelectCatalog` instead of forking a private `selected`, so switching catalog here
  // and then opening the Catalogs tab lands on the SAME catalog (no stale fork).
  const reduce = useReducedMotion();
  const detail = useLabDetail(catalogId);

  // Same manifest step-source Baseline uses, so the matrix columns and the rail can
  // never disagree about a catalog's step list (incl. bespoke Items, which renders
  // its curated fine steps rather than its same-id registry pipeline labels).
  const steps = useMemo(() => resolveCatalogSteps(catalogId), [catalogId]);

  // Server is the source of truth for status — it carries the runner's L3/L4 overlay.
  // The shared cache (keyed by `catalogId`) is deduped with Baseline's fetch and
  // exposes an honest LOADING state instead of an all-pending flash on catalog switch.
  // Three states, not one: LOADING (skeleton) · EMPTY (grid of unproduced cells) ·
  // ERROR (the GET failed — the grid would show every cell as "never produced", which
  // is a lie, so the error takes the surface and names its reason).
  const { arts, loading, error } = useCachedArtifacts(catalogId);
  const showSkeleton = loading && arts.length === 0;

  const byEntity = useMemo(() => {
    const m = new Map<string, Map<string, PipelineArtifact>>();
    for (const a of arts) {
      const row = m.get(a.entityId) ?? new Map<string, PipelineArtifact>();
      row.set(a.step, a);
      m.set(a.entityId, row);
    }
    return m;
  }, [arts]);

  // Local produced steps overlay server truth add-only (local wins), exactly as the
  // rail hydrates the open entity — so the matrix reflects the same reconciled status.
  const localByEntity = useLabPipelineStore((s) => s.byEntity);

  // Same judge bridge the rail and the step banner apply — one cached fetch per catalog.
  const verdicts = useCatalogJudgeVerdicts(catalogId);

  const rows = useMemo(
    () => buildMatrixRows(catalogId, detail?.entities ?? [], byEntity, localByEntity, steps, verdicts),
    [catalogId, detail?.entities, byEntity, localByEntity, steps, verdicts],
  );

  const completeCount = rows.filter((r) => r.rollup.configComplete).length;
  const blockedCount = rows.filter((r) => r.blockers.length > 0).length;

  // Batch drain: every entity with ≥1 deferred gate, drained serially (single-lease UE
  // runner). The hook owns the loop/cancel/lease logic; the header owns the UI. As each
  // entity's result lands the cache is invalidated → this matrix refetches and updates live.
  const deferredEntities = useMemo(
    () => rows.filter((r) => r.rollup.deferred > 0).map((r) => ({ id: r.id, name: r.name })),
    [rows],
  );
  const { state: drainState, start: startDrain, cancel: cancelDrain, reset: dismissDrain } = useBatchDrain(catalogId);

  // Memoize cell styles per status (only ~5 distinct statuses) instead of
  // allocating a fresh CSSProperties object for every cell on every render — the
  // grid is entities × steps cells, so this was O(rows·cols) object churn.
  const cellStyleFor = useMemo(() => {
    const cache = new Map<LabDisplayStatus, React.CSSProperties>();
    return (status: LabDisplayStatus): React.CSSProperties => {
      const hit = cache.get(status);
      if (hit) return hit;
      const filled = status === 'pass' || status === 'fail';
      // `unproduced` is the faintest cell: a dotted line border, dimmed — a distinct,
      // colorblind-safe "nothing produced here yet" cue vs pending's solid hollow ring.
      const unproduced = status === 'unproduced';
      const borderWidthStyle = status === 'deferred' ? '2px dashed' : unproduced ? '1px dotted' : '1px solid';
      const style: React.CSSProperties = {
        width: 30, height: 30, padding: 0, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: filled ? statusColor(status, t) : 'transparent',
        border: `${borderWidthStyle} ${filled ? statusColor(status, t) : status === 'pending' || unproduced ? t.line : statusColor(status, t)}`,
        color: filled ? t.onAccent : status === 'pending' || unproduced ? t.muted : statusColor(status, t),
        opacity: unproduced ? 0.55 : 1,
        fontSize: 14, fontWeight: 700, lineHeight: 1, borderRadius: t.glass ? 5 : 0,
        transition: 'background-color 160ms ease-out, border-color 160ms ease-out',
      };
      cache.set(status, style);
      return style;
    };
  }, [t]);

  // Glyph + spoken word for a display status (STATUS_* only knows the 4 server statuses).
  const glyphOf = (s: LabDisplayStatus) => (s === 'unproduced' ? UNPRODUCED_GLYPH : STATUS_GLYPH[s]);
  const wordOf = (s: LabDisplayStatus) => (s === 'unproduced' ? UNPRODUCED_WORD : STATUS_WORD[s]);

  const th = useMemo<React.CSSProperties>(() => ({
    position: 'sticky', top: 0, zIndex: 2, background: t.bg,
    padding: '8px 6px', borderBottom: `2px solid ${t.line}`, color: t.muted,
    fontSize: 12, fontWeight: 600, textAlign: 'center',
  }), [t]);
  const stickyLeft = useMemo<React.CSSProperties>(() => ({
    position: 'sticky', left: 0, zIndex: 1, background: t.bg, textAlign: 'left',
    borderRight: `1px solid ${t.line}`, minWidth: 200, maxWidth: 280,
  }), [t]);
  // Per-cell <td> styles, hoisted out of the row loop (one object per theme,
  // not one per cell).
  const stepTd = useMemo<React.CSSProperties>(() => ({
    padding: 2, textAlign: 'center', borderBottom: `1px solid ${t.line}`,
  }), [t]);
  const nameTd = useMemo<React.CSSProperties>(() => ({
    ...stickyLeft, padding: '6px 12px 6px 4px', borderBottom: `1px solid ${t.line}`,
  }), [stickyLeft, t]);

  return (
    <div data-testid="catalog-matrix" className={t.fontBody}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: t.bg, color: t.text }}>
      {/* ── Header strip: catalog picker + catalog-wide summary ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '16px 28px', borderBottom: `1px solid ${t.line}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="matrix-catalog" className={t.fontMono} style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.muted }}>Catalog</label>
          <select id="matrix-catalog" value={catalogId} onChange={(e) => onSelectCatalog(e.target.value)} className={t.fontMono}
            style={{ fontSize: 15, padding: '6px 10px', background: t.panel, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, cursor: 'pointer' }}>
            {groups.map((g) => (
              <optgroup key={g.category} label={g.category}>
                {g.catalogs.map((c) => <option key={c.catalogId} value={c.catalogId}>{c.label} ({c.total})</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className={t.fontMono} style={{ fontSize: 14, color: t.muted, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span title="Entities whose every step is pass (or deferred at L3/L4)"><strong style={{ color: t.ok }} data-testid="matrix-complete-count">{completeCount}</strong> / {rows.length} config-complete</span>
          <span title="Entities with at least one failed gate">
            <strong style={{ color: blockedCount ? t.bad : t.muted }} data-testid="matrix-blocked-count">{blockedCount}</strong> blocked
          </span>
          <span>{steps.length} steps</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <MatrixBatchDrain t={t} deferredEntities={deferredEntities} state={drainState}
            onStart={() => startDrain(deferredEntities)} onCancel={cancelDrain} onDismiss={dismissDrain} />
        </div>
      </div>

      {/* ── Numbered legend so the column numbers decode to step names ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 28px', borderBottom: `1px solid ${t.line}` }}>
        {steps.map((s, i) => (
          <span key={s} className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>
            <span style={{ color: t.ink, fontWeight: 600 }}>{pad2(i + 1)}</span> {s}{i < steps.length - 1 ? ' ·' : ''}
          </span>
        ))}
      </div>

      {/* ── The grid ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 28px 28px' }} aria-busy={showSkeleton || undefined}>
        {error ? (
          <div data-testid="matrix-load-error" style={{ padding: '24px 0', maxWidth: 640 }}>
            <InlineErrorRetry
              message={`Couldn't load this catalog's status: ${error}`}
              onRetry={() => retryArtifacts(catalogId)}
            />
            <p style={{ fontSize: 13, color: t.muted, margin: '10px 0 0' }}>
              Statuses are unknown until this loads — steps may already be produced on the server.
            </p>
          </div>
        ) : showSkeleton ? (
          <MatrixSkeleton t={t} rows={Math.max(1, (detail?.entities ?? []).length)} cols={steps.length} reduce={!!reduce} />
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 15, color: t.muted, padding: '24px 0' }}>No entities in this catalog yet.</p>
        ) : (
          <table className={t.fontMono} style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th, ...stickyLeft, zIndex: 3 }}>Entity · progress</th>
                {steps.map((s, i) => (
                  <th key={s} style={th} title={s}>{pad2(i + 1)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-draining={drainState.activeEntityIds.has(r.id) || undefined}>
                  <td style={drainState.activeEntityIds.has(r.id) ? { ...nameTd, borderLeft: `3px solid ${t.warn}` } : nameTd}>
                    <button onClick={() => onOpenStep(catalogId, r.id, 0)} className={t.fontBody}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', color: t.text }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.inkDeep, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                      <span data-testid={`matrix-progress-${r.id}`} style={{ fontSize: 12, color: t.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: r.rollup.configComplete ? t.ok : t.muted }}>{r.rollup.done}/{r.rollup.total} done</span>
                        {r.rollup.configComplete && <span style={{ color: t.ok }} title="Every step pass / L3-L4 deferred">✓ complete</span>}
                        {r.blockers.length > 0 && (
                          <span data-testid={`matrix-blocker-${r.id}`} style={{ color: t.bad, fontWeight: 600 }}
                            title={`Blocked: ${r.blockers.map((b) => `${b.step} — ${b.reason}`).join('; ')}`}>
                            ⚠ {r.blockers.length} blocker{r.blockers.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {drainState.activeEntityIds.has(r.id) && (
                          <span data-testid={`matrix-draining-${r.id}`} style={{ color: t.warn, fontWeight: 600 }}>· draining…</span>
                        )}
                      </span>
                    </button>
                  </td>
                  {steps.map((s, i) => {
                    const status = r.statusByStep(s);
                    return (
                      <td key={s} style={stepTd}>
                        <button onClick={() => onOpenStep(catalogId, r.id, i)}
                          data-cell={`${r.id}::${s}`} data-status={status}
                          aria-label={`${r.name} · ${s}: ${wordOf(status)}`}
                          title={`${r.name} · ${s}: ${wordOf(status)}`}
                          style={cellStyleFor(status)}>
                          {glyphOf(status)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
