'use client';

/**
 * /status — the pipeline health map, Blueprint-themed (lab tokens). One swimlane per
 * catalog pipeline, one cell per step: the cell NAMES THE ENGINE powering the step
 * (Claude / Tripo / Leonardo / UE Python / …), the background encodes the STRICT
 * grade ladder (green reserved for gate-proven / judge-proven output) and the left
 * stripe encodes the acceptance TIER (L0–L4).
 *
 * Two clickable highlight bars replace the static legend: TIER chips and ENGINE
 * chips. Clicking one highlights matching cells and demotes everything else to low
 * opacity; clicking again (or another chip) clears/moves the filter.
 */
import { useEffect, useMemo, useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import { tryApiFetch } from '@/lib/api-utils';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { buildSwimlane, sortLanes, type Swimlane, type StepCell } from '@/lib/status/statusModel';
import { StatusCell, TIER_VAR } from './StatusCell';

const TIERS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

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

export function StatusDashboard() {
  const [lanes, setLanes] = useState<Swimlane[] | null>(null);
  const [highlight, setHighlight] = useState<Highlight>(null);

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

  return (
    <div
      data-theme="blueprint"
      style={{
        minHeight: '100vh',
        background: 'var(--lab-bg)',
        backgroundImage: 'var(--lab-grid-image)',
        backgroundSize: 'var(--lab-grid-size)',
        color: 'var(--lab-text)',
        fontFamily: 'var(--lab-font-body)',
        padding: 'var(--lab-s6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--lab-s2)' }}>
        <h1 style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: 'var(--lab-ink-deep)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Pipeline Status
        </h1>
        <a href="/layout" className="focus-ring" style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-ink)', textDecoration: 'none' }}>← Blueprint</a>
      </div>
      <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', maxWidth: 880, marginBottom: 'var(--lab-s3)' }}>
        One row per pipeline, one cell per step — the cell names its engine, the background is the honest grade
        (green = gate/judge-proven), the left stripe is the acceptance tier. Click a tier or engine chip to highlight.
      </p>

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

      {!lanes && <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)' }}>Loading pipeline truth…</div>}

      <div style={{ overflowX: 'auto' }}>
        {lanes?.map((lane) => (
          <div key={lane.catalogId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)', minWidth: 'max-content' }}>
            <a
              href={`/layout?catalog=${lane.catalogId}`}
              className="focus-ring"
              title={`${lane.catalogId} — verified ${lane.verifiedPct}% · credible ${lane.credibleGePct}% · wired ${lane.wiredPct}%`}
              style={{ width: 200, flexShrink: 0, fontSize: 'calc(var(--lab-fs-xs) + 3px)', fontWeight: 700, fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {lane.label}
            </a>
            <span style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: lane.verifiedPct > 0 ? 'var(--lab-ok)' : 'var(--lab-muted)' }} title="gate-verified steps">
              {lane.verifiedPct}%
            </span>
            <div style={{ display: 'flex', gap: 'var(--lab-s1)' }}>
              {lane.cells.map((cell) => (
                <StatusCell key={cell.label} cell={cell} dimmed={!cellMatches(cell, highlight)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
