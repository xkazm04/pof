'use client';

/**
 * The Game home's "Lanes control room": every lane runner root of the game (`night.mjs --root`), each lane as a
 * card (id, model, state, sessions, cost, last commit, last journal line), then the selected lane's detail
 * (REPORT.md, frames, build evidence choice). Server-read and polled (`gameHomeLanesData.ts`); nothing here
 * writes to a root. Every state says what it is: loading, a failed read (retry), no runners, an unreadable root.
 */
import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { LanesBoard, RunnerRootView } from '@/lib/games/runners/runnerTypes';
import { LaneCard } from './gameHomeLaneCard';
import { LaneDetail } from './gameHomeLaneDetail';
import { useLanesBoard } from './gameHomeLanesData';

const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

/** "BUILD · freeze 17:00 · report 17:30 · deadline 18:00" — or why the clock is unknown. Exported for tests. */
export function scheduleText(r: RunnerRootView): string {
  if (!r.schedule || !r.phase) return 'schedule unknown';
  return `${r.phase} · freeze ${hhmm(r.schedule.freeze)} · report ${hhmm(r.schedule.report)} · deadline ${hhmm(r.schedule.until)}${r.schedule.source === 'default' ? ' (runner defaults: no launch.cmd)' : ''}`;
}

function RootSection({ root, readAt, selected, onSelect, t }: {
  root: RunnerRootView; readAt: string; selected: string | null; onSelect: (id: string) => void; t: LabTheme;
}) {
  return (
    <section data-testid={`runner-root-${root.name}`} aria-label={`Runner root ${root.name}`} style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
      <span style={{ display: 'flex', gap: 'var(--lab-s3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h4 style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-ink-deep)' }}>{root.name}</h4>
        {root.ok && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{scheduleText(root)}</span>}
        {root.billing && <span data-testid={`runner-billing-${root.name}`} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{root.billing.line}</span>}
      </span>
      {!root.ok && (
        <span data-testid={`runner-root-error-${root.name}`} style={{ display: 'inline-flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusTag level="warn" word="unreadable" />
          <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{root.error}</span>
        </span>
      )}
      {root.ok && root.lanes.length === 0 && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>night.json lists no lanes.</span>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 'var(--lab-s3)' }}>
        {root.lanes.map((l) => <LaneCard key={l.id} lane={l} readAt={readAt} selected={selected === l.id} onSelect={() => onSelect(l.id)} t={t} />)}
      </div>
    </section>
  );
}

function Board({ board, t, evidenceLane, onPickEvidence }: {
  board: LanesBoard; t: LabTheme; evidenceLane: string | null; onPickEvidence: (id: string | null) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const lanes = board.roots.flatMap((r) => r.lanes);
  const selected = lanes.find((l) => l.id === picked) ?? null;
  if (!board.configured) {
    return <span data-testid="lanes-unconfigured" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{board.reason}</span>;
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--lab-s4)' }}>
      {board.roots.map((r) => <RootSection key={r.root} root={r} readAt={board.readAt} selected={picked} onSelect={(id) => setPicked(picked === id ? null : id)} t={t} />)}
      {selected && <LaneDetail lane={selected} readAt={board.readAt} t={t} evidenceLane={evidenceLane} onPickEvidence={onPickEvidence} />}
      {!selected && lanes.length > 0 && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Select a lane for its REPORT.md, frames and build evidence.</span>}
    </div>
  );
}

export function GameHomeLanes({ t, gameId, evidenceLane, onPickEvidence }: {
  t: LabTheme; gameId: string; evidenceLane: string | null; onPickEvidence: (id: string | null) => void;
}) {
  const { read, reread } = useLanesBoard(gameId);
  return (
    <section data-testid="game-home-lanes" aria-labelledby="game-home-lanes-title" style={{ display: 'grid', gap: 'var(--lab-s3)' }}>
      <span style={{ display: 'inline-flex', gap: 'var(--lab-s3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h3 id="game-home-lanes-title" style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-ink-deep)' }}>Lanes control room</h3>
        <MicroLabel mono tone="muted">read-only · re-read every {UI_TIMEOUTS.lanesPoll / 1000} s</MicroLabel>
        {read.kind === 'ok' && <button type="button" className="focus-ring" data-testid="lanes-reread" onClick={reread} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, textDecoration: 'underline' }}>Re-read</button>}
      </span>
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading the lane runners…" />}
      {read.kind === 'error' && <InlineErrorRetry dense message={`lanes unavailable (${read.message})`} onRetry={reread} />}
      {read.kind === 'ok' && read.staleError && <InlineErrorRetry dense message={`last re-read failed (${read.staleError}); showing the board from ${hhmm(read.data.readAt)}`} onRetry={reread} />}
      {read.kind === 'ok' && <Board board={read.data} t={t} evidenceLane={evidenceLane} onPickEvidence={onPickEvidence} />}
    </section>
  );
}
