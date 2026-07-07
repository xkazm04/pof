'use client';

/**
 * /status — the pipeline health map, Blueprint-themed (lab tokens). One swimlane per
 * catalog pipeline, one cell per step: the cell NAMES THE ENGINE powering the step
 * (Claude / Tripo / Leonardo / UE Python / …) and its background encodes the STRICT
 * grade ladder — green is reserved for gate-proven output (L3/L4); an L0–L2 pass is
 * only "trusted" for engines that scale to quality without a gate (LLM text, code,
 * human selection) and shows as UNGATED (amber) for generative 3D/audio/2D.
 */
import { useEffect, useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { buildSwimlane, sortLanes, type Swimlane, type CellGrade } from '@/lib/status/statusModel';
import { StatusCell, GRADE_VAR } from './StatusCell';

const LEGEND: Array<{ grade: CellGrade; text: string }> = [
  { grade: 'verified', text: 'verified — a real gate passed (L3 runtime / L4 visual)' },
  { grade: 'trusted', text: 'trusted — L0–L2 pass, engine scales without a gate (LLM / code / human)' },
  { grade: 'ungated', text: 'ungated — output exists, professional quality NOT provable yet' },
  { grade: 'unpowered', text: 'unpowered — checker passed but NO wired engine can produce the claimed deliverable (audited)' },
  { grade: 'deferred', text: 'deferred — gate declared, not run' },
  { grade: 'attention', text: 'failing' },
  { grade: 'pending', text: 'pending' },
  { grade: 'unwired', text: 'unwired — never produced (mocked / skipped)' },
];

export function StatusDashboard() {
  const [lanes, setLanes] = useState<Swimlane[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const pipelines = allCatalogPipelines();
      const results = await Promise.all(
        pipelines.map(async (p) => {
          const artifacts: PipelineArtifact[] = await fetchArtifacts(p.catalogId);
          const metas = p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine }));
          return buildSwimlane(p.catalogId, p.catalogId, metas, artifacts);
        }),
      );
      if (alive) setLanes(sortLanes(results));
    })();
    return () => { alive = false; };
  }, []);

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
      <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', maxWidth: 880, marginBottom: 'var(--lab-s4)' }}>
        One row per pipeline, one cell per step — each cell names the engine powering it; the color is the honest grade.
        Green is reserved for gate-proven output. Dark cells were never produced — the bottlenecks.
      </p>

      <div role="list" aria-label="legend" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s4)', marginBottom: 'var(--lab-s5)', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-text)' }}>
        {LEGEND.map((l) => (
          <span key={l.grade} role="listitem" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s1)' }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, border: '1px solid var(--lab-line)', background: l.grade === 'unwired' ? 'transparent' : `color-mix(in srgb, ${GRADE_VAR[l.grade]} 38%, transparent)` }} />
            {l.text}
          </span>
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
              style={{ width: 176, flexShrink: 0, fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {lane.label}
            </a>
            <span style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: lane.verifiedPct > 0 ? 'var(--lab-ok)' : 'var(--lab-muted)' }} title="gate-verified steps">
              {lane.verifiedPct}%
            </span>
            <div style={{ display: 'flex', gap: 'var(--lab-s1)' }}>
              {lane.cells.map((cell) => (
                <StatusCell key={cell.label} cell={cell} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
