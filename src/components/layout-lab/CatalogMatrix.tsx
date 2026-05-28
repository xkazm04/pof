'use client';

import '@/lib/catalog/pipelines/registry.generated';
import { useState, useEffect, useMemo } from 'react';
import { fetchArtifacts } from './labArtifactClient';
import { resolveAccept } from './labAcceptance';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import { useLabDetail } from './useLabCatalogData';
import { labPipelineSteps } from './labPipelines';
import { STATUS_GLYPH, STATUS_WORD } from './statusLanguage';
import type { AcceptanceStatus } from '@/lib/catalog/acceptance/types';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from './theme';
import type { LabGroup } from './useLabCatalogData';

const COLOR = (t: LabTheme, s: AcceptanceStatus) =>
  s === 'pass' ? t.ok : s === 'fail' ? t.bad : s === 'deferred' ? t.muted : t.warn;
const pad2 = (n: number) => String(n).padStart(2, '0');

interface Blocker { step: string; reason: string }
interface MatrixRow { id: string; name: string; statusByStep: (s: string) => AcceptanceStatus; rollup: EntityRollup; blockers: Blocker[] }

interface Props {
  t: LabTheme;
  groups: LabGroup[];
  catalogId: string;
  onOpenStep: (catalogId: string, entityId: string, stepIdx: number) => void;
}

/**
 * Catalog-wide pipeline status matrix: every entity in a catalog (rows) × every
 * pipeline step (columns), each cell colored by its derived Acceptance status
 * (the server-stored verdict, computed by the same accept() functions). A per-
 * entity strip shows "X of N steps complete" via summarizeEntity and flags
 * blockers (failed gates, e.g. price/power outliers). Click any cell to jump
 * straight to that entity's step. Pick a different catalog from the selector.
 */
export function CatalogMatrix({ t, groups, catalogId, onOpenStep }: Props) {
  const [selected, setSelected] = useState(catalogId);
  // Fetched artifacts stamped with their catalog, so a stale in-flight response is ignored
  // and we never need a synchronous reset (which would trigger a cascading render).
  const [artState, setArtState] = useState<{ catalogId: string; arts: PipelineArtifact[] }>({ catalogId: selected, arts: [] });
  const detail = useLabDetail(selected);

  // Same hybrid step source Baseline uses, so columns align with produced artifacts.
  const steps = useMemo(() => {
    const pipeline = getCatalogPipeline(selected);
    return pipeline ? pipeline.steps.map((s) => s.label) : (detail?.steps ?? labPipelineSteps(selected));
  }, [selected, detail?.steps]);

  // Server is the source of truth for status — it carries the runner's L3/L4 overlay.
  useEffect(() => {
    let cancelled = false;
    fetchArtifacts(selected).then((a) => { if (!cancelled) setArtState({ catalogId: selected, arts: a }); });
    return () => { cancelled = true; };
  }, [selected]);

  const byEntity = useMemo(() => {
    const m = new Map<string, Map<string, PipelineArtifact>>();
    // Until this catalog's fetch resolves, show no artifacts (every step reads as pending).
    const arts = artState.catalogId === selected ? artState.arts : [];
    for (const a of arts) {
      const row = m.get(a.entityId) ?? new Map<string, PipelineArtifact>();
      row.set(a.step, a);
      m.set(a.entityId, row);
    }
    return m;
  }, [artState, selected]);

  const rows: MatrixRow[] = useMemo(() => (detail?.entities ?? []).map((e) => {
    const row = byEntity.get(e.id);
    const present = steps.filter((s) => row?.has(s)).map((s) => row!.get(s)!);
    const blockers: Blocker[] = present.filter((a) => a.status === 'fail').map((a) => {
      const accept = resolveAccept(selected, a.step);
      const res = accept ? accept(a.data) : null; // reuse the accept() fn for a human reason
      return { step: a.step, reason: res?.reason ?? res?.detail ?? a.reason ?? 'failed acceptance' };
    });
    return {
      id: e.id, name: e.name,
      statusByStep: (s: string) => row?.get(s)?.status ?? 'pending',
      rollup: summarizeEntity(present, steps.length),
      blockers,
    };
  }), [detail?.entities, byEntity, steps, selected]);

  const completeCount = rows.filter((r) => r.rollup.configComplete).length;
  const blockedCount = rows.filter((r) => r.blockers.length > 0).length;

  const cellStyle = (status: AcceptanceStatus, isHeader = false): React.CSSProperties => {
    const filled = status === 'pass' || status === 'fail';
    return {
      width: isHeader ? undefined : 30, height: 30, padding: 0, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: filled ? COLOR(t, status) : 'transparent',
      border: `${status === 'deferred' ? '2px dashed' : '1px solid'} ${filled ? COLOR(t, status) : status === 'pending' ? t.line : COLOR(t, status)}`,
      color: filled ? t.onAccent : status === 'pending' ? t.muted : COLOR(t, status),
      fontSize: 14, fontWeight: 700, lineHeight: 1, borderRadius: t.glass ? 5 : 0,
      transition: 'background-color 160ms ease-out, border-color 160ms ease-out',
    };
  };

  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2, background: t.bg,
    padding: '8px 6px', borderBottom: `2px solid ${t.line}`, color: t.muted,
    fontSize: 12, fontWeight: 600, textAlign: 'center',
  };
  const stickyLeft: React.CSSProperties = {
    position: 'sticky', left: 0, zIndex: 1, background: t.bg, textAlign: 'left',
    borderRight: `1px solid ${t.line}`, minWidth: 200, maxWidth: 280,
  };

  return (
    <div data-testid="catalog-matrix" className={t.fontBody}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: t.bg, color: t.text }}>
      {/* ── Header strip: catalog picker + catalog-wide summary ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '16px 28px', borderBottom: `1px solid ${t.line}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="matrix-catalog" className={t.fontMono} style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.muted }}>Catalog</label>
          <select id="matrix-catalog" value={selected} onChange={(e) => setSelected(e.target.value)} className={t.fontMono}
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 28px 28px' }}>
        {rows.length === 0 ? (
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
                <tr key={r.id}>
                  <td style={{ ...stickyLeft, padding: '6px 12px 6px 4px', borderBottom: `1px solid ${t.line}` }}>
                    <button onClick={() => onOpenStep(selected, r.id, 0)} className={t.fontBody}
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
                      </span>
                    </button>
                  </td>
                  {steps.map((s, i) => {
                    const status = r.statusByStep(s);
                    return (
                      <td key={s} style={{ padding: 2, textAlign: 'center', borderBottom: `1px solid ${t.line}` }}>
                        <button onClick={() => onOpenStep(selected, r.id, i)}
                          data-cell={`${r.id}::${s}`} data-status={status}
                          aria-label={`${r.name} · ${s}: ${STATUS_WORD[status]}`}
                          title={`${r.name} · ${s}: ${STATUS_WORD[status]}`}
                          style={cellStyle(status)}>
                          {STATUS_GLYPH[status]}
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
