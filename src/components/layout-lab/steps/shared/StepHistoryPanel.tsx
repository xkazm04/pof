'use client';

import { useCallback, useState } from 'react';
import { tryApiFetch, apiFetch } from '@/lib/api-utils';
import { StatusTag } from '@/components/ui/StatusTag';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { readProduceDirection } from '@/lib/catalog/produceDirection';
import type { ArtifactRevision } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from '../../theme';

/** ISO → readable stamp. Derived from the row, never from a render-time clock. */
function stamp(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

const LEVEL = { pass: 'ok', deferred: 'warn', pending: 'warn', fail: 'bad' } as const;

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

  async function restore(rev: ArtifactRevision) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiFetch<{ artifact: { status: string }; regraded: boolean; archivedStatus: string }>(
        '/api/pipeline-artifacts/revisions',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId: rev.id }) },
      );
      // A restore brings back CONTENT, not a verdict — say so whenever the two differ.
      setNotice(
        res.regraded && res.artifact.status !== res.archivedStatus
          ? `Restored. Re-graded to “${res.artifact.status}” — this version was archived as “${res.archivedStatus}”.`
          : `Restored version from ${stamp(rev.updatedAt)}.`,
      );
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
            return (
              <div
                key={r.id} data-testid="step-history-row" data-revision={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '8px 10px', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0,
                }}
              >
                <StatusTag level={LEVEL[r.status as keyof typeof LEVEL] ?? 'warn'} word={r.status.toUpperCase()} />
                <span className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>{stamp(r.updatedAt)}</span>
                <span style={{ fontSize: 13, color: t.muted, minWidth: 0, flex: 1 }}>
                  {dir?.direction ? `“${dir.direction}”` : 'no direction recorded'}
                </span>
                <button
                  type="button" onClick={() => void restore(r)} disabled={busy}
                  data-testid="step-history-restore"
                  aria-label={`Restore the version from ${stamp(r.updatedAt)}`}
                  className={`focus-ring ${t.fontMono}`}
                  style={{
                    fontSize: 13, padding: '4px 10px', cursor: busy ? 'wait' : 'pointer', color: t.text,
                    border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, background: 'transparent',
                  }}
                >
                  ↺ Restore
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
