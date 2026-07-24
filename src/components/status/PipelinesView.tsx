'use client';

/**
 * Pipelines tab — the pipeline-centric health map (one swimlane per catalog, one cell
 * per step; the cell names its engine, the background is the strict grade, the left
 * stripe is the acceptance tier). Extracted verbatim from the original StatusDashboard
 * body so the dashboard shell can host it alongside the Item Focus tab.
 *
 * Click-through: a lane's label (and any of its cells) opens Item Focus on that
 * catalog — the entity-centric complement — via `onFocusCatalog`.
 */
import { useEffect, useMemo, useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import { tryApiFetch } from '@/lib/api-utils';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { buildSwimlane, sortLanes, getStepFact, type Swimlane, type StepCell } from '@/lib/status/statusModel';
import { capabilityClassOf } from '@/lib/status/capabilityModel';
import { StatusCell, TIER_VAR } from './StatusCell';
import { EvidenceModal } from './EvidenceModal';

const TIERS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

/** True when a step belongs to the given capability class (via its audited deliverable). */
function cellInClass(catalogId: string, cell: StepCell, klass: string | null): boolean {
  if (!klass) return true;
  const fact = getStepFact(catalogId, cell.label);
  if (!fact) return false;
  return capabilityClassOf(fact.deliverable, catalogId) === klass;
}

type Highlight = { kind: 'tier' | 'engine'; value: string } | null;

function cellMatches(cell: StepCell, hl: Highlight): boolean {
  if (!hl) return true;
  if (hl.kind === 'tier') return cell.tier === hl.value;
  return cell.engine === hl.value;
}

function Chip({ label, color, active, onClick }: { label: string; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="focus-ring"
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--lab-s1)',
        padding: 'var(--lab-s1) var(--lab-s2)',
        fontSize: 'var(--lab-fs-xs)',
        fontFamily: 'var(--lab-font-mono)',
        color: 'var(--lab-text)',
        background: active ? 'color-mix(in srgb, var(--lab-ink) 22%, transparent)' : 'transparent',
        border: `1px solid ${active ? 'var(--lab-ink)' : 'var(--lab-line)'}`,
        borderRadius: 'var(--lab-r-sm)',
        cursor: 'pointer',
      }}
    >
      {color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: color }} />}
      {label}
    </button>
  );
}

export function PipelinesView({
  onFocusCatalog,
  filterClass = null,
  onClearFilter,
}: {
  onFocusCatalog: (catalogId: string) => void;
  /** Optional capability-class filter (from the Capability tab): only steps whose
   *  deliverable maps to this class render, and lanes with zero matching steps hide. */
  filterClass?: string | null;
  onClearFilter?: () => void;
}) {
  const [lanes, setLanes] = useState<Swimlane[] | null>(null);
  const [highlight, setHighlight] = useState<Highlight>(null);
  // Clicking a cell opens the evidence modal (the stored output the gate evaluated),
  // NOT Item Focus — so a verdict can be audited against its actual proof.
  const [evidence, setEvidence] = useState<{ catalogId: string; step: string; cell: StepCell } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const pipelines = allCatalogPipelines();
      const verdictRes = await tryApiFetch<JudgeVerdict[]>('/api/judge-verdicts');
      const allVerdicts = verdictRes.ok ? verdictRes.data : [];
      const byCatalog = new Map<string, JudgeVerdict[]>();
      for (const v of allVerdicts) {
        const list = byCatalog.get(v.catalogId) ?? [];
        list.push(v);
        byCatalog.set(v.catalogId, list);
      }
      const results = await Promise.all(
        pipelines.map(async (p) => {
          const artifacts: PipelineArtifact[] = await fetchArtifacts(p.catalogId);
          const metas = p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine }));
          return buildSwimlane(p.catalogId, p.catalogId, metas, artifacts, byCatalog.get(p.catalogId) ?? []);
        }),
      );
      if (alive) setLanes(sortLanes(results));
    })();
    return () => { alive = false; };
  }, []);

  /** Engines actually present on the map (stable order), for the engine bar. */
  const engines = useMemo(() => {
    if (!lanes) return [];
    const seen = new Map<string, number>();
    for (const lane of lanes) {
      for (const c of lane.cells) {
        if (c.grade === 'unwired') continue;
        seen.set(c.engine, (seen.get(c.engine) ?? 0) + 1);
      }
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [lanes]);

  const toggle = (kind: 'tier' | 'engine', value: string) =>
    setHighlight((h) => (h && h.kind === kind && h.value === value ? null : { kind, value }));

  /** Lanes with cells restricted to the active capability-class filter (empty lanes hidden). */
  const visibleLanes = useMemo(() => {
    if (!lanes) return null;
    if (!filterClass) return lanes;
    return lanes
      .map((lane) => ({ ...lane, cells: lane.cells.filter((c) => cellInClass(lane.catalogId, c, filterClass)) }))
      .filter((lane) => lane.cells.length > 0);
  }, [lanes, filterClass]);

  return (
    <>
      <div role="toolbar" aria-label="highlight by tier" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)' }}>
        <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', alignSelf: 'center', width: 56 }}>tier</span>
        {TIERS.map((t) => (
          <Chip key={t} label={t} color={TIER_VAR[t]} active={highlight?.kind === 'tier' && highlight.value === t} onClick={() => toggle('tier', t)} />
        ))}
      </div>
      <div role="toolbar" aria-label="highlight by engine" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s5)' }}>
        <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', alignSelf: 'center', width: 56 }}>engine</span>
        {engines.map((e) => (
          <Chip key={e.name} label={`${e.name} (${e.count})`} active={highlight?.kind === 'engine' && highlight.value === e.name} onClick={() => toggle('engine', e.name)} />
        ))}
      </div>

      {filterClass && (
        <div style={{ marginBottom: 'var(--lab-s3)' }}>
          <button
            type="button"
            className="focus-ring"
            onClick={() => onClearFilter?.()}
            aria-label={`Clear ${filterClass} filter`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--lab-s1)',
              padding: 'var(--lab-s1) var(--lab-s2)',
              fontSize: 'var(--lab-fs-xs)',
              fontFamily: 'var(--lab-font-mono)',
              color: 'var(--lab-text)',
              background: 'color-mix(in srgb, var(--lab-ink) 16%, transparent)',
              border: '1px solid var(--lab-ink)',
              borderRadius: 'var(--lab-r-sm)',
              cursor: 'pointer',
            }}
          >
            capability: {filterClass}
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}

      {/* Live region so the load/empty transition is announced, not just drawn. */}
      <div role="status" aria-live="polite" style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)' }}>
        {!lanes && 'Loading pipeline truth…'}
        {lanes && lanes.length === 0 && 'No catalog pipelines are registered yet — nothing to map.'}
        {lanes && lanes.length > 0 && filterClass && visibleLanes?.length === 0 && (
          <>
            No steps match the <strong>{filterClass}</strong> capability class. Clear the filter above to see the whole map.
          </>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        {visibleLanes?.map((lane) => (
          <div key={lane.catalogId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)', minWidth: 'max-content' }}>
            <button
              type="button"
              onClick={() => onFocusCatalog(lane.catalogId)}
              className="focus-ring"
              title={`Focus an entity — ${lane.catalogId} — verified ${lane.verifiedPct}% · credible ${lane.credibleGePct}% · wired ${lane.wiredPct}%`}
              style={{ width: 200, flexShrink: 0, textAlign: 'left', fontSize: 'calc(var(--lab-fs-xs) + 3px)', fontWeight: 700, fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', background: 'transparent', border: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {lane.label}
            </button>
            <span style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: lane.verifiedPct > 0 ? 'var(--lab-ok)' : 'var(--lab-muted)' }} title="gate-verified steps">
              {lane.verifiedPct}%
            </span>
            <div style={{ display: 'flex', gap: 'var(--lab-s1)' }}>
              {lane.cells.map((cell) => (
                <button
                  key={cell.label}
                  type="button"
                  onClick={() => setEvidence({ catalogId: lane.catalogId, step: cell.label, cell })}
                  className="focus-ring"
                  title="Show the stored output this evaluation was based on"
                  style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <StatusCell cell={cell} dimmed={!cellMatches(cell, highlight)} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {evidence && (
        <EvidenceModal key={`${evidence.catalogId}::${evidence.step}`} catalogId={evidence.catalogId} step={evidence.step} cell={evidence.cell} onClose={() => setEvidence(null)} />
      )}
    </>
  );
}
