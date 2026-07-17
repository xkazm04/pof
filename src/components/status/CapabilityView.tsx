'use client';

/**
 * Capability tab — the DEFAULT /status landing. One row per capability class grading
 * our generation TECHNIQUE ("which parts of any game project can our stack generate at
 * pro quality, where are the gaps"), pooled across every project instance. Read-only
 * lens over the same judge verdicts the Pipelines map fetches (see capabilityModel.ts);
 * it never touches grading or any gate.
 *
 * Clicking a row drops into the Pipelines map FILTERED to that class's steps.
 */
import { useEffect, useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import { tryApiFetch } from '@/lib/api-utils';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { buildCapabilityRows, type CapabilityRow, type CapabilityGradeLevel } from '@/lib/status/capabilityModel';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { StatusLevel } from '@/lib/status-token';

/** Grade → colorblind-safe ramp level (word carries the exact grade; glyph+hue the tier). */
const GRADE_LEVEL: Record<CapabilityGradeLevel, StatusLevel> = {
  proven: 'ok',
  strong: 'ok',
  capped: 'warn',
  unproven: 'bad',
};

const mono = 'var(--lab-font-mono)';

/** Provenance sub-label: which project-derived evidence stream fed the grade. */
const STREAM_LABEL: Record<CapabilityRow['stream'], string> = {
  'llm-panel': 'llm-panel',
  vlm: 'vlm',
  gates: 'gates',
  human: 'human',
  mixed: 'llm-panel + vlm',
  none: 'no stream',
};

function EvidenceLabel({ row }: { row: CapabilityRow }) {
  // Gate-judged rows report N/M gates pass instead of a score median.
  if (row.stream === 'gates') {
    return (
      <MicroLabel mono>
        {row.gatesDeclared ? `${row.gatesPassed}/${row.gatesDeclared} gates pass` : 'no declared gates'}
      </MicroLabel>
    );
  }
  if (row.median === null) {
    return <MicroLabel mono>no {row.judgeClass} evidence{row.excluded ? ` · ${row.excluded} excluded` : ''}</MicroLabel>;
  }
  return (
    <MicroLabel mono>
      median {row.median} · {row.n} cell{row.n === 1 ? '' : 's'}
      {row.excluded ? ` · ${row.excluded} excluded as project-data` : ''}
    </MicroLabel>
  );
}

function Row({ row, onFilter }: { row: CapabilityRow; onFilter: (klass: string) => void }) {
  return (
    <button
      type="button"
      className="focus-ring"
      onClick={() => onFilter(row.klass)}
      title={`Open the Pipelines map filtered to ${row.label} steps`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(150px, 1.2fr) minmax(120px, 1fr) auto',
        gap: 'var(--lab-s3)',
        alignItems: 'start',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--lab-s3)',
        marginBottom: 'var(--lab-s2)',
        background: 'var(--lab-panel)',
        border: '1px solid var(--lab-line)',
        borderRadius: 'var(--lab-r-sm)',
        cursor: 'pointer',
        color: 'var(--lab-text)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 'calc(var(--lab-fs-xs) + 2px)', color: 'var(--lab-ink-deep)' }}>
          {row.label}
        </div>
        <MicroLabel mono uppercase style={{ display: 'block', marginTop: 2 }}>
          {row.techniqueStack.join(' · ')} · judge: {row.judgeClass}
        </MicroLabel>
        <MicroLabel style={{ display: 'block', marginTop: 4 }}>
          {row.provenance === 'derived-from-project-instances' ? 'derived from project instances' : 'neutral benchmark'} ({STREAM_LABEL[row.stream]})
        </MicroLabel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <StatusTag level={GRADE_LEVEL[row.grade]} word={row.grade} />
        <EvidenceLabel row={row} />
        {row.cappedByTechnique && <MicroLabel mono tone="muted">⚑ documented technique wall</MicroLabel>}
      </div>

      <div style={{ maxWidth: 420, fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', lineHeight: 1.4 }}>
        {row.gapStatement}
      </div>
    </button>
  );
}

export function CapabilityView({ onFilterClass }: { onFilterClass: (klass: string) => void }) {
  const [rows, setRows] = useState<CapabilityRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Verdicts (all judges: llm-panel + vlm + human) feed the score/human streams; the
      // L3/L4 gate artifacts (fetched per catalog, same source the Pipelines map uses) feed
      // the gate-judged classes. buildCapabilityRows routes each class to its own stream.
      const res = await tryApiFetch<JudgeVerdict[]>('/api/judge-verdicts');
      const verdicts = res.ok ? res.data : [];
      const perCatalog = await Promise.all(allCatalogPipelines().map((p) => fetchArtifacts(p.catalogId)));
      const artifacts: PipelineArtifact[] = perCatalog.flat();
      if (alive) setRows(buildCapabilityRows(verdicts, artifacts));
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', maxWidth: 880, marginBottom: 'var(--lab-s3)' }}>
        What our <strong>stack</strong> can generate at pro quality, per capability class — pooled across every project
        instance. Each class is graded by the evidence its steps&apos; audited judge demands: score-judged classes
        (<strong>llm-panel / vlm</strong>) by a median ladder, runtime classes by their <strong>L3/L4 gate</strong>{' '}
        pass-rate, human/none classes only when human review exists. Grade reads by <strong>word + glyph</strong>, not hue
        alone. project-data (locked seeds, canon collisions) and checker-forced numbers are excluded so the median measures
        TECHNIQUE, not this project&apos;s data. Click a class to drill into the pipeline steps that build it.
      </p>
      {!rows && <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)' }}>Loading capability truth…</div>}
      {rows?.map((row) => (
        <Row key={row.klass} row={row} onFilter={onFilterClass} />
      ))}
    </div>
  );
}
