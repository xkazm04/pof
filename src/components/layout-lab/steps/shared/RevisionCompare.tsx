'use client';

import { StatusTag } from '@/components/ui/StatusTag';
import type { RevisionDiffRow } from './revisionDiff';
import type { LabTheme } from '../../theme';

/** What `POST /api/pipeline-artifacts/revisions {dryRun:true}` answers — a restore, unwritten. */
export interface RevisionDryRun {
  regraded: boolean;
  wouldStatus: string;
  wouldTier?: string | null;
  wouldReason?: string | null;
  archivedStatus: string;
}

export const REVISION_LEVEL = { pass: 'ok', deferred: 'warn', pending: 'warn', fail: 'bad' } as const;

export const levelOf = (status: string) => REVISION_LEVEL[status as keyof typeof REVISION_LEVEL] ?? 'warn';

/** "WOULD GRADE FAIL" / "KEEPS PASS" — the word a restore of this version would carry. */
export function wouldGradeWord(dry: RevisionDryRun): string {
  return dry.regraded ? `WOULD GRADE ${dry.wouldStatus.toUpperCase()}` : `KEEPS ${dry.wouldStatus.toUpperCase()}`;
}

function rowText(r: RevisionDiffRow): string {
  if (r.summary) return r.summary;
  if (r.kind === 'added') return 'restoring adds this field';
  if (r.kind === 'removed') return 'restoring drops this field';
  return `${r.from} → ${r.to}`;
}

/**
 * One revision compared with the output on screen, BEFORE a restore: the field-level diff
 * (current → archived) and the server's dry-run re-grade (no write). Rendered inline under
 * its StepHistoryPanel row; purely presentational — the panel owns the fetch.
 */
export function RevisionCompare({ t, rows, dry, hasCurrent }: {
  t: LabTheme;
  rows: RevisionDiffRow[];
  dry: RevisionDryRun;
  /** False when the store holds no current output for this step (everything reads as added). */
  hasCurrent: boolean;
}) {
  const mono = { fontSize: 13 } as const;
  return (
    <div
      data-testid="step-history-compare-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', paddingTop: 6, borderTop: `1px dashed ${t.line}` }}
    >
      <span data-testid="step-history-would-grade" className={t.fontMono} style={{ ...mono, color: t.muted, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusTag level={levelOf(dry.wouldStatus)} word={wouldGradeWord(dry)} />
        <span> — archived as {dry.archivedStatus.toUpperCase()}</span>
      </span>
      {dry.wouldReason && (
        <span className={t.fontMono} style={{ ...mono, color: t.muted }}>{dry.wouldReason}</span>
      )}
      {!hasCurrent && (
        <span className={t.fontMono} style={{ ...mono, color: t.muted }}>No current output on screen — every field reads as added.</span>
      )}
      {rows.length === 0 ? (
        <span data-testid="step-history-diff-empty" className={t.fontMono} style={{ ...mono, color: t.muted }}>
          Identical content — restoring changes nothing but the verdict record.
        </span>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((r) => (
            <li key={r.key} data-testid="step-history-diff-row" data-kind={r.kind} className={t.fontMono} style={{ ...mono, color: t.text, overflowWrap: 'anywhere' }}>
              <span style={{ color: t.muted }}>{r.kind === 'added' ? '+' : r.kind === 'removed' ? '−' : '~'} </span>
              <strong>{r.key}</strong>
              <span style={{ color: t.muted }}> · {rowText(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
