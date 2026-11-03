'use client';

/**
 * One lane of the lanes control room as a selectable card: id, state (glyph + word, never hue alone), model,
 * iterations and cost, last commit and last journal line. A card is a button so it is keyboard-reachable;
 * `aria-pressed` carries the selection. Every empty field says what is empty.
 */
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { StatusLevel } from '@/lib/status-token';
import { ageText } from '@/lib/games/godot/buildHealthTypes';
import { costText, laneStateWord, type LaneState, type LaneView } from '@/lib/games/runners/runnerTypes';

/** Lane state as a colorblind-safe tag level. Exported for tests. */
export const LANE_LEVEL: Record<LaneState, StatusLevel> = {
  running: 'ok', building: 'ok', done: 'ok', freeze: 'warn', report: 'warn', pending: 'warn', blocked: 'bad',
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function commitLine(lane: LaneView, readAt: string): string {
  const c = lane.lastCommit;
  if (!c) return lane.cwdExists ? 'no commit read' : 'worktree missing';
  const age = ageText(c.at, readAt);
  return `${c.sha.slice(0, 7)} ${clip(c.subject, 72)}${age ? ` · ${age}` : ''}`;
}

export function LaneCard({ lane, readAt, selected, onSelect, t }: {
  lane: LaneView; readAt: string; selected: boolean; onSelect: () => void; t: LabTheme;
}) {
  return (
    <button type="button" className="focus-ring" aria-pressed={selected} onClick={onSelect}
      data-testid={`lane-card-${lane.id}`} data-state={lane.state}
      style={{
        textAlign: 'left', display: 'grid', gap: 'var(--lab-s2)', padding: 'var(--lab-s3)', minWidth: 0,
        background: selected ? 'var(--lab-accent-bg)' : 'var(--lab-panel)',
        border: `1px solid ${selected ? 'var(--lab-ink)' : 'var(--lab-line)'}`, borderRadius: 'var(--lab-r2, 6px)',
      }}>
      <span style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-ink-deep)', overflowWrap: 'anywhere' }}>{lane.id}</span>
        <StatusTag level={LANE_LEVEL[lane.state]} word={laneStateWord(lane.state)} />
      </span>
      <MicroLabel mono tone="muted">{lane.model}{lane.effort ? ` · ${lane.effort}` : ''}{lane.phase ? ` · ${lane.phase}` : ''}</MicroLabel>
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-ink-deep)' }}>
        {lane.iterations} {lane.iterations === 1 ? 'session' : 'sessions'} · {costText(lane.costUsd, lane.apiCostUsd, lane.iterations)}
      </span>
      <span data-testid={`lane-commit-${lane.id}`} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{commitLine(lane, readAt)}</span>
      <span data-testid={`lane-journal-${lane.id}`} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>
        {lane.lastJournalLine ? clip(lane.lastJournalLine, 140) : 'no JOURNAL.md line yet'}
      </span>
    </button>
  );
}
