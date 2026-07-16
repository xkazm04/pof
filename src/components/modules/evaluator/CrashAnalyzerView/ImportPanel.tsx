'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import { CRASH_TYPE_LABELS } from './constants';

export function ImportPanel() {
  const [rawLog, setRawLog] = useState('');
  const importCrashLog = useCrashAnalyzerStore((s) => s.importCrashLog);
  const isLoading = useCrashAnalyzerStore((s) => s.isLoading);
  const storeError = useCrashAnalyzerStore((s) => s.error);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    if (!rawLog.trim()) return;
    setImportError(null);
    try {
      const report = await importCrashLog(rawLog);
      if (report) {
        setImportResult(`Imported crash ${report.id} — ${CRASH_TYPE_LABELS[report.crashType]} (${report.severity})`);
        setImportError(null);
        setRawLog(''); // only clear the paste on success
      } else {
        // importCrashLog returned null → parse/API failure captured in store.error
        setImportResult(null);
        setImportError('Could not analyze that log — check the format and try again.');
      }
    } catch (err) {
      setImportResult(null);
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
          Paste a UE5 crash log (from Saved/Logs/ or CrashReportClient output) to analyze it.
        </p>
        <textarea
          value={rawLog}
          onChange={(e) => setRawLog(e.target.value)}
          placeholder={`Paste crash log here...\n\nExample:\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: [Callstack]\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: UnrealEditor-MyGame!MyFunction() [MyFile.cpp:123]`}
          className="w-full h-40 p-3 rounded-md border border-border bg-surface text-xs text-text font-mono placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-status-red-strong resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={handleImport}
            disabled={isLoading || !rawLog.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-status-red-subtle text-red-400 hover:bg-status-red-medium transition-colors disabled:opacity-40"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import & Analyze
          </button>
          {importResult && (
            <span className="text-2xs text-emerald-400">{importResult}</span>
          )}
          {(importError || storeError) && !importResult && (
            <span className="text-2xs text-red-400">{importError ?? storeError}</span>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
