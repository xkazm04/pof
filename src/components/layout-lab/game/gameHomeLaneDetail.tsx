'use client';

/**
 * The selected lane's detail: facts (`DataTable`), the REPORT.md excerpt once written, the frames from the lane's
 * frames.json as thumbnails (served by the frame route, which reads only files a frames.json lists), and the choice
 * to point the build-health panel at this lane's worktree evidence.
 */
import { DataTable } from '@/components/layout-lab/steps/shared/DataTable';
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { LabTheme } from '@/components/layout-lab/theme';
import { ageText } from '@/lib/games/godot/buildHealthTypes';
import { costText, type LaneFrame, type LaneView } from '@/lib/games/runners/runnerTypes';

const COLUMNS = [
  { key: 'state', label: 'State' }, { key: 'branch', label: 'Branch' }, { key: 'worktree', label: 'Worktree' },
  { key: 'sessions', label: 'Sessions' }, { key: 'cost', label: 'Cost' }, { key: 'last', label: 'Last session' }, { key: 'report', label: 'REPORT.md' },
];

export function laneFacts(lane: LaneView, readAt: string): Record<string, unknown> {
  const li = lane.lastIteration;
  return {
    state: lane.stateNote ? `${lane.state} · ${lane.stateNote}` : lane.state,
    branch: lane.branch ?? null,
    worktree: lane.cwdExists ? lane.cwd : `${lane.cwd} (missing)`,
    sessions: lane.iterations,
    cost: costText(lane.costUsd, lane.apiCostUsd, lane.iterations),
    last: li ? `#${li.n} ${li.phase} · ${li.timedOut ? 'stopped at cap' : `exit ${li.code}`} · ${li.billing}${li.limited ? ' · usage limit' : ''}${li.drained ? ' · key drained' : ''}${ageText(li.start, readAt) ? ` · started ${ageText(li.start, readAt)}` : ''}` : null,
    report: lane.report ? `${(lane.report.bytes / 1024).toFixed(1)} KB, written ${ageText(lane.report.mtime, readAt)}` : 'not written yet',
  };
}

function Thumb({ f, laneId }: { f: LaneFrame; laneId: string }) {
  return (
    <figure data-testid={`lane-frame-${laneId}-${f.file}`} style={{ margin: 0, display: 'grid', gap: 4, minWidth: 0 }}>
      <a href={f.url} target="_blank" rel="noreferrer" className="focus-ring" aria-label={`Open ${f.title} full size`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a server-served frame of unknown size; next/image would need a loader for the API route */}
        <img src={f.url} alt={f.title} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', border: '1px solid var(--lab-line)', background: 'var(--lab-panel)' }} />
      </a>
      <figcaption style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-ink-deep)', overflowWrap: 'anywhere' }}>
        {f.title}{f.source ? ` · ${f.source}` : ''}
        {f.note && <span style={{ display: 'block', color: 'var(--lab-muted)' }}>{f.note}</span>}
      </figcaption>
    </figure>
  );
}

export function LaneDetail({ lane, readAt, t, evidenceLane, onPickEvidence }: {
  lane: LaneView; readAt: string; t: LabTheme; evidenceLane: string | null; onPickEvidence: (id: string | null) => void;
}) {
  const showing = evidenceLane === lane.id;
  return (
    <div data-testid={`lane-detail-${lane.id}`} style={{ display: 'grid', gap: 'var(--lab-s3)', padding: 'var(--lab-s3)', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r2, 6px)' }}>
      <MicroLabel mono uppercase tone="muted">Lane {lane.id} · {lane.rootName}</MicroLabel>
      <DataTable t={t} columns={COLUMNS} values={laneFacts(lane, readAt)} missingText="not read" testId={`lane-facts-${lane.id}`} />
      <span style={{ display: 'inline-flex', gap: 'var(--lab-s3)', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
        {lane.hasEvidence ? (
          <button type="button" className="focus-ring" data-testid={`lane-evidence-${lane.id}`} aria-pressed={showing}
            onClick={() => onPickEvidence(showing ? null : lane.id)}
            style={{ color: 'var(--lab-ink-deep)', textDecoration: 'underline' }}>
            {showing ? 'Back to the game root evidence' : 'Show this lane’s build evidence'}
          </button>
        ) : <span>No build/evidence/ folder in this worktree yet.</span>}
      </span>
      {lane.report && (
        <details data-testid={`lane-report-${lane.id}`}>
          <summary className="focus-ring" style={{ cursor: 'pointer', fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-ink-deep)' }}>REPORT.md{lane.report.truncated ? ' (first 6000 characters)' : ''}</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-ink-deep)', maxHeight: 360, overflow: 'auto', margin: 'var(--lab-s2) 0 0' }}>{lane.report.excerpt}</pre>
        </details>
      )}
      <div style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
        <MicroLabel mono uppercase tone="muted">Frames{lane.frames.length ? ` (${lane.frames.length})` : ''}</MicroLabel>
        {lane.frames.length === 0
          ? <span data-testid={`lane-no-frames-${lane.id}`} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>No frames.json for this lane under the masters folder yet.</span>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--lab-s3)' }}>
            {lane.frames.map((f) => <Thumb key={f.file} f={f} laneId={lane.id} />)}
          </div>}
      </div>
    </div>
  );
}
