'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Download, ExternalLink, History } from 'lucide-react';
import type { HarnessRunOption } from '@/lib/game-director/harness-import';
import type { UseGameDirectorResult, HarnessRunPreviewResult } from '@/hooks/useGameDirector';
import { HarnessImportError } from '@/hooks/useGameDirector';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { OPACITY_8, OPACITY_20, STATUS_WARNING } from '@/lib/chart-colors';
import { ACCENT } from './constants';

type HarnessApi = Pick<UseGameDirectorResult, 'listHarnessRuns' | 'previewHarnessRun' | 'ingestHarnessRun'>;

interface HarnessRunImportProps extends HarnessApi {
  projectPath: string | null;
  /** Open a session's detail — the one just imported, or the one a run already became. */
  onOpenSession: (sessionId: string) => void;
}

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; preview: HarnessRunPreviewResult }
  | { kind: 'refused'; reason: string };

function OpenSessionButton({ sessionId, onOpen }: { sessionId: string; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(sessionId)} className="focus-ring inline-flex items-center gap-1 text-xs font-medium underline" style={{ color: ACCENT }}>
      <ExternalLink className="w-3 h-3" aria-hidden="true" /> Open session {sessionId}
    </button>
  );
}

/**
 * Pick a stored harness run of the active project, see exactly what the session
 * will contain (the import's own mapping, nothing written), then import it in
 * one click. A run that is already a session links to it instead of importing.
 */
export function HarnessRunImport({ projectPath, listHarnessRuns, previewHarnessRun, ingestHarnessRun, onOpenSession }: HarnessRunImportProps) {
  const [runs, setRuns] = useState<HarnessRunOption[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<{ message: string; existing: string | null } | null>(null);
  const previewSeq = useRef(0);

  const loadRuns = useCallback(async () => {
    if (!projectPath) return;
    setListError(null);
    try {
      setRuns(await listHarnessRuns(projectPath));
    } catch (e) {
      setRuns([]);
      setListError(e instanceof Error ? e.message : 'Could not list harness runs.');
    }
  }, [projectPath, listHarnessRuns]);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const select = async (runId: string) => {
    setSelected(runId);
    setImportError(null);
    setPreview({ kind: 'loading' });
    const seq = ++previewSeq.current;
    try {
      const p = await previewHarnessRun(runId, projectPath ?? undefined);
      if (seq === previewSeq.current) setPreview({ kind: 'ready', preview: p });
    } catch (e) {
      if (seq === previewSeq.current) setPreview({ kind: 'refused', reason: e instanceof Error ? e.message : String(e) });
    }
  };

  const doImport = async () => {
    if (!selected) return;
    setImporting(true);
    setImportError(null);
    try {
      onOpenSession(await ingestHarnessRun(selected, projectPath ?? undefined));
    } catch (e) {
      const existing = e instanceof HarnessImportError ? e.existingSessionId : null;
      setImportError({ message: e instanceof Error ? e.message : String(e), existing });
      if (existing) void loadRuns();
    } finally {
      setImporting(false);
    }
  };

  if (!projectPath) {
    return <p className="text-sm text-text-muted">No active project — harness runs are listed per project, so there is nothing to import yet.</p>;
  }
  if (runs === null) {
    return <p className="text-sm text-text-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading harness runs…</p>;
  }

  return (
    <div className="space-y-4">
      {listError && <InlineErrorRetry message={listError} onRetry={() => { void loadRuns(); }} />}
      {runs.length === 0 && !listError && (
        <p className="text-sm text-text-muted">
          No harness run is stored for this project yet. A run appears here once the harness orchestrator has run against it;
          an on-disk state dir can still be ingested with <code className="font-mono text-xs">node scripts/game-director/ingest-run.mjs</code>.
        </p>
      )}
      {runs.length > 0 && (
        <ul className="space-y-1.5" aria-label="Stored harness runs">
          {runs.map((r) => {
            const active = r.runId === selected;
            return (
              <li key={r.runId} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => { void select(r.runId); }}
                  className="focus-ring flex-1 flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-colors border-border bg-surface-deep hover:border-border-bright"
                  style={active ? { borderColor: `${ACCENT}${OPACITY_20}`, backgroundColor: `${ACCENT}${OPACITY_8}` } : undefined}
                >
                  <History className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
                  <span className="font-mono text-xs text-text truncate">{r.runId}</span>
                  <span className="text-xs text-text-muted">{new Date(r.startedAt).toLocaleString()} · iter {r.iteration} · {Math.round(r.passRate)}% pass · {r.status}</span>
                </button>
                {r.ingestedSessionId && <OpenSessionButton sessionId={r.ingestedSessionId} onOpen={onOpenSession} />}
              </li>
            );
          })}
        </ul>
      )}

      {preview.kind === 'loading' && <p className="text-sm text-text-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Mapping the run…</p>}
      {preview.kind === 'refused' && (
        <p role="alert" className="text-sm" style={{ color: STATUS_WARNING }}>This run cannot become a session: {preview.reason}</p>
      )}
      {preview.kind === 'ready' && (
        <section aria-label="Import preview" className="rounded-lg border border-border bg-surface p-4 space-y-2 text-sm">
          <h3 className="font-semibold text-text">{preview.preview.sessionName}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-text-muted">Build</dt><dd className="font-mono text-text">{preview.preview.contract.buildId}</dd>
            <dt className="text-text-muted">Findings to write</dt><dd className="text-text">{preview.preview.findingsCount}</dd>
            <dt className="text-text-muted">Unrouted (no category owns the module)</dt><dd className="text-text">{preview.preview.unrouted.length}</dd>
            <dt className="text-text-muted">Refused (no evidence pointer)</dt><dd className="text-text">{preview.preview.rejected.length}</dd>
            <dt className="text-text-muted">Score (planned features passing)</dt><dd className="text-text">{preview.preview.overallScore}</dd>
          </dl>
          {preview.preview.ingestedSessionId ? (
            <p className="text-xs text-text-muted">Already imported — a second import would count this run twice. <OpenSessionButton sessionId={preview.preview.ingestedSessionId} onOpen={onOpenSession} /></p>
          ) : (
            <button
              type="button"
              onClick={() => { void doImport(); }}
              disabled={importing}
              className="focus-ring flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: `${ACCENT}${OPACITY_8}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_20}` }}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
              {importing ? 'Importing…' : 'Import as session'}
            </button>
          )}
          {importError && (
            <div role="alert" className="text-xs space-y-1" style={{ color: STATUS_WARNING }}>
              <p>{importError.message}</p>
              {importError.existing && <OpenSessionButton sessionId={importError.existing} onOpen={onOpenSession} />}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
