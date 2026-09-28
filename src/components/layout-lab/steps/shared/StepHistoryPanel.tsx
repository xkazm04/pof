'use client';

import { useCallback, useState } from 'react';
import { tryApiFetch, apiFetch } from '@/lib/api-utils';
import { StatusTag } from '@/components/ui/StatusTag';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { readProduceDirection } from '@/lib/catalog/produceDirection';
import type { ArtifactRevision } from '@/lib/pipeline-artifacts-db';
import { useLabStep } from '../../labPipelineStore';
import { diffRevision } from './revisionDiff';
import { RevisionCompare, levelOf, wouldGradeWord, type RevisionDryRun } from './RevisionCompare';
import type { LabTheme } from '../../theme';

/** ISO → readable stamp. Derived from the row, never from a render-time clock. */
function stamp(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

const REVISIONS_URL = '/api/pipeline-artifacts/revisions';
const postJson = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/**
 * Previous versions of ONE step, with a restore.
 *
 * `pipeline_artifacts` is keyed (catalog, entity, step) and upserted, so until the server
 * kept revisions every re-produce destroyed what the step held before. Gallery steps were
 * fine — their candidate batches live inside `data.genHistory` — but a static step's prior
 * output was simply gone, which makes "try a different direction" a one-way door.
 *
 * Loaded on demand: this is a recovery affordance, not something every step should fetch on
 * mount across a 342-step map. A restore re-grades server-side, so the panel reports when
 * the restored verdict differs from the one the archived version carried rather than
 * letting a stale `pass` reappear as if it had been re-proven.
 *
 * Compare before restore: per row, a field-level diff against the output on screen (the
 * lab store's current artifact) plus the server's dry-run re-grade (`dryRun: true` — no
 * write, no archived version, no spent history slot), so a restore is a decision made
 * with the content and the verdict in view rather than a try-then-undo.
 */
export function StepHistoryPanel({ t, catalogId, entityId, step, onRestored }: {
  t: LabTheme;
  catalogId: string;
  entityId: string;
  step: string;
  /** Called after a successful restore so the caller can re-read server truth. */
  onRestored?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<ArtifactRevision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [comparing, setComparing] = useState<number | null>(null);
  const [dryRuns, setDryRuns] = useState<Record<number, RevisionDryRun>>({});
  const [compareError, setCompareError] = useState<string | null>(null);
  const current = useLabStep(entityId, step);

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams({ catalogId, entityId, step });
    const res = await tryApiFetch<ArtifactRevision[]>(`/api/pipeline-artifacts/revisions?${qs}`);
    if (res.ok) setRevisions(res.data);
    else { setRevisions(null); setError(res.error); }
  }, [catalogId, entityId, step]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && revisions === null) void load();
  }

  async function compare(rev: ArtifactRevision) {
    if (comparing === rev.id) { setComparing(null); return; }
    setComparing(rev.id);
    setCompareError(null);
    if (dryRuns[rev.id]) return;
    const res = await tryApiFetch<RevisionDryRun>(REVISIONS_URL, postJson({ revisionId: rev.id, dryRun: true }));
    if (res.ok) setDryRuns((d) => ({ ...d, [rev.id]: res.data }));
    else setCompareError(res.error);
  }

  async function restore(rev: ArtifactRevision) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiFetch<{ artifact: { status: string }; regraded: boolean; archivedStatus: string }>(
        REVISIONS_URL, postJson({ revisionId: rev.id }),
      );
      // A restore brings back CONTENT, not a verdict — say so whenever the two differ.
      setNotice(
        res.regraded && res.artifact.status !== res.archivedStatus
          ? `Restored. Re-graded to “${res.artifact.status}” — this version was archived as “${res.archivedStatus}”.`
          : `Restored version from ${stamp(rev.updatedAt)}.`,
      );
      // The on-screen output changed, so every earlier comparison is stale.
      setComparing(null);
      setDryRuns({});
      await load();
      onRestored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="step-history" style={{ marginTop: 12 }}>
      <button
        type="button" onClick={toggle} aria-expanded={open} data-testid="step-history-toggle"
        className={`focus-ring ${t.fontMono}`}
        style={{
          fontSize: 13, padding: '5px 10px', cursor: 'pointer', color: t.text,
          border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, background: 'transparent',
        }}
      >
        {open ? '▴' : '▾'} Previous versions{revisions ? ` · ${revisions.length}` : ''}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <InlineErrorRetry dense message={`Couldn’t load previous versions: ${error}`} onRetry={() => void load()} />}
          {notice && (
            <span data-testid="step-history-notice" className={t.fontMono} style={{ fontSize: 13, color: t.warn }}>
              {notice}
            </span>
          )}
          {revisions?.length === 0 && (
            <span data-testid="step-history-empty" className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>
              No previous versions — this step has only ever been produced once.
            </span>
          )}
          {revisions?.map((r) => {
            const dir = readProduceDirection(r.data);
            const dry = dryRuns[r.id];
            const btn = {
              fontSize: 13, padding: '4px 10px', cursor: busy ? 'wait' : 'pointer', color: t.text,
              border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, background: 'transparent',
            } as const;
            return (
              <div
                key={r.id} data-testid="step-history-row" data-revision={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '8px 10px', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0,
                }}
              >
                <StatusTag level={levelOf(r.status)} word={r.status.toUpperCase()} />
                <span className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>{stamp(r.updatedAt)}</span>
                <span style={{ fontSize: 13, color: t.muted, minWidth: 0, flex: 1 }}>
                  {dir?.direction ? `“${dir.direction}”` : 'no direction recorded'}
                </span>
                <button
                  type="button" onClick={() => void compare(r)} disabled={busy}
                  data-testid="step-history-compare" aria-expanded={comparing === r.id}
                  aria-label={`Compare the version from ${stamp(r.updatedAt)} with the current output`}
                  className={`focus-ring ${t.fontMono}`} style={btn}
                >
                  ⇄ Compare
                </button>
                <button
                  type="button" onClick={() => void restore(r)} disabled={busy}
                  data-testid="step-history-restore"
                  aria-label={`Restore the version from ${stamp(r.updatedAt)}${dry ? ` (${wouldGradeWord(dry).toLowerCase()})` : ''}`}
                  className={`focus-ring ${t.fontMono}`} style={btn}
                >
                  ↺ Restore
                </button>
                {comparing === r.id && compareError && (
                  <InlineErrorRetry dense message={`Couldn’t compare this version: ${compareError}`} onRetry={() => { setComparing(null); void compare(r); }} />
                )}
                {comparing === r.id && dry && (
                  <RevisionCompare
                    t={t} dry={dry} hasCurrent={!!current}
                    rows={diffRevision({ data: current?.data, ueAssets: current?.ueAssets }, { data: r.data, ueAssets: r.ueAssets })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
