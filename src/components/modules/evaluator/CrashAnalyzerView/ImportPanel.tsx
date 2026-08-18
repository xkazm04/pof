'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import { CRASH_TYPE_LABELS } from './constants';

/** What the import ACTUALLY produced — parse result and diagnosis lookup, separately. */
interface ImportOutcome {
  id: string;
  typeLabel: string;
  severity: string;
  /** True only when a diagnosis was actually attached to this crash. */
  diagnosed: boolean;
  /**
   * Set when the attached analysis was written for a DIFFERENT crash and reached
   * this one by signature matching — the sentence must say so, and say how strong
   * the match was, rather than reporting a transfer as a hit.
   */
  matchedFrom: { sourceCrashId: string; similarity: number; strength: string } | null;
  /**
   * The persisted sighting record, when the crash was stored. `occurrences > 1`
   * is the answer to "have I seen this before?" — the question the analyzer
   * could not answer at all before crash history existed.
   */
  history: { occurrences: number; firstSeenAt: string } | null;
}

export function ImportPanel() {
  const [rawLog, setRawLog] = useState('');
  const importCrashLog = useCrashAnalyzerStore((s) => s.importCrashLog);
  const isLoading = useCrashAnalyzerStore((s) => s.isLoading);
  const storeError = useCrashAnalyzerStore((s) => s.error);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    if (!rawLog.trim()) return;
    setImportError(null);
    try {
      const report = await importCrashLog(rawLog);
      if (report) {
        // The import PARSES, then matches the crash's signature against the
        // crashes PoF holds analyses for. Read what actually landed instead of
        // reporting success as though an analysis had been written here.
        const attached = useCrashAnalyzerStore
          .getState()
          .diagnoses.find((d) => d.crashId === report.id);
        setOutcome({
          id: report.id,
          typeLabel: CRASH_TYPE_LABELS[report.crashType],
          severity: report.severity,
          diagnosed: Boolean(attached),
          matchedFrom: attached?.match
            ? {
                sourceCrashId: attached.match.sourceCrashId,
                similarity: attached.match.similarity,
                strength: attached.match.strength,
              }
            : null,
          history: report.history
            ? { occurrences: report.history.occurrences, firstSeenAt: report.history.firstSeenAt }
            : null,
        });
        setImportError(null);
        setRawLog(''); // only clear the paste on success
      } else {
        // importCrashLog returned null → parse/API failure captured in store.error
        setOutcome(null);
        setImportError('Could not parse that log — check the format and try again.');
      }
    } catch (err) {
      setOutcome(null);
      setImportError(err instanceof Error ? err.message : 'Import failed — please try again.');
    }
  }, [rawLog, importCrashLog]);

  return (
    <div className="space-y-3">
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-red-400" />
          Import Crash Log
        </h3>
        <p className="text-2xs text-text-muted mb-3">
          Paste a UE5 crash log (from Saved/Logs/ or CrashReportClient output) to parse its
          callstack and attribute it to a module. Its shape — failure class, culprit function
          and file, module, engine terms — is then compared against the crashes PoF holds
          analyses for; a close enough match attaches that crash&rsquo;s analysis, labelled as
          borrowed.
        </p>
        <textarea
          value={rawLog}
          onChange={(e) => setRawLog(e.target.value)}
          placeholder={`Paste crash log here...\n\nExample:\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: [Callstack]\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: UnrealEditor-MyGame!MyFunction() [MyFile.cpp:123]`}
          className="w-full h-40 p-3 rounded-md border border-border bg-surface text-xs text-text font-mono placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-status-red-strong resize-none"
        />
        <div className="flex items-start justify-between gap-3 mt-2">
          <button
            onClick={handleImport}
            disabled={isLoading || !rawLog.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-status-red-subtle text-red-400 hover:bg-status-red-medium transition-colors disabled:opacity-40 shrink-0"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Parse & Import
          </button>
          {outcome && (
            <div className="text-right" data-testid="import-result">
              <p className="text-2xs text-emerald-400">
                Parsed crash {outcome.id} — {outcome.typeLabel} ({outcome.severity})
              </p>
              {/* "Seen before?" reported as a separate fact from the parse and
                  from the diagnosis, because it is a separate fact — and it is
                  the one that only became answerable once history persisted. */}
              {outcome.history && (
                <MicroLabel tone="muted" as="p" className="mt-0.5">
                  {outcome.history.occurrences > 1
                    ? `Seen before — sighting #${outcome.history.occurrences}, first seen ${new Date(outcome.history.firstSeenAt).toLocaleString()}.`
                    : 'First time PoF has seen this crash — saved to crash history.'}
                </MicroLabel>
              )}
              {/* Stated separately from the parse result, because it is a separate
                  thing that either happened or did not. */}
              <MicroLabel tone="muted" as="p" className="mt-0.5">
                {outcome.matchedFrom
                  ? `${outcome.matchedFrom.strength === 'strong' ? 'Matched' : 'Weakly matched'} ${outcome.matchedFrom.sourceCrashId} by signature (${outcome.matchedFrom.similarity.toFixed(2)}) — that crash's analysis was attached, not written for this one.`
                  : outcome.diagnosed
                    ? 'Matched a known crash — diagnosis attached.'
                    : 'No diagnosis matched — general guidance for the crash type is shown instead.'}
              </MicroLabel>
            </div>
          )}
          {(importError || storeError) && !outcome && (
            <span className="text-2xs text-red-400">{importError ?? storeError}</span>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
