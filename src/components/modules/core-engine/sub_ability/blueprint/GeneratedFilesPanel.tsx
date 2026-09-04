'use client';

import { FileCode, FolderOpen, AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, ACCENT_CYAN } from '@/lib/chart-colors';
import { StatusTag } from '@/components/ui/StatusTag';
import type { CodegenReport } from '@/lib/ability/spec';

/**
 * The files that ACTUALLY exist in the UE project, from the last
 * `generate-gas-effects` run's server-derived {@link CodegenReport}.
 *
 * Fidelity ladder (ai-registry `game-production/visual-script-to-code-transpilation`):
 * the preview above this panel is at the *parsed* rung — a rendering of the
 * design that touches no disk. This panel reports the *declared-and-defined*
 * rung (files written) and, only when `buildOk`, the *compiles* rung. With no
 * report it says nothing has been generated: it never lets the preview read as
 * a file on disk.
 */
export function GeneratedFilesPanel({ report }: { report: CodegenReport | null }) {
  if (!report) {
    return (
      <div className="mt-3 rounded border border-border p-2.5 text-2xs text-text-muted space-y-1">
        <div className="flex items-center gap-1.5 text-text">
          <FolderOpen className="w-3.5 h-3.5" />
          Nothing has been generated into the UE project for this ability.
        </div>
        <div>
          The code above is a preview of the design. Run “Generate GAS effects” to have
          the agent produce the C++; the files it reports back are listed here.
        </div>
      </div>
    );
  }

  const rung = report.buildOk ? 'compiles' : 'declared-and-defined';

  return (
    <div className="mt-3 rounded border border-border p-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-2xs font-medium text-text">
          <FileCode className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
          In the UE project: {report.filesWritten.length} files
        </span>
        <StatusTag level={report.buildOk ? 'ok' : 'warn'} word={report.buildOk ? 'PoF module compiles' : 'PoF module did not build'} />
        <span className="text-2xs font-mono text-text-muted">rung: {rung}</span>
      </div>

      <ul className="space-y-0.5">
        {report.filesWritten.map((f) => (
          <li key={f} className="text-2xs font-mono text-text-muted break-all">{f}</li>
        ))}
      </ul>

      <div className="text-2xs text-text-muted">
        {report.seedRan
          ? `Seeder ran — ${report.dataTableRows ?? 'an unreported number of'} rows in DT_GeneratedAbilities.`
          : 'The data-table seeder did not run, so nothing is registered in DT_GeneratedAbilities.'}
      </div>

      {report.missingTags.length > 0 && (
        <div className="flex items-start gap-1.5 text-2xs" style={{ color: STATUS_WARNING }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>Tags referenced but not declared in ARPGGameplayTags.h: {report.missingTags.join(', ')}</span>
        </div>
      )}

      {report.status === 'failed' && (
        <div className="text-2xs" style={{ color: STATUS_WARNING }}>
          {report.reason ?? 'Codegen failed for an unreported reason.'}
        </div>
      )}

      <div className="text-2xs" style={{ color: report.buildOk ? STATUS_SUCCESS : STATUS_WARNING }}>
        Reported {report.reportedAt}.
      </div>
    </div>
  );
}
