'use client';

import { useState } from 'react';
import {
  Bug, ChevronDown, ChevronRight, XCircle,
  Layers, Clock, Cpu, Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import type { CrashReport, CrashDiagnosis } from '@/types/crash-analyzer';
import { SeverityBadge } from './SeverityBadge';
import { PlainCrashSummary } from './PlainCrashSummary';
import { CallstackCard } from './CallstackCard';
import { AiDiagnosisCard } from './AiDiagnosisCard';
import { NoDiagnosisNotice } from './NoDiagnosisNotice';
import { RawLogBlock, RawLogDisclosure } from './RawLog';

export function CrashDetailPanel({
  report,
  diagnosis,
  onClose,
  plainMode,
}: {
  report: CrashReport;
  diagnosis: CrashDiagnosis | null;
  onClose: () => void;
  plainMode: boolean;
}) {
  // In Plain English mode the dense developer sections (callstack, AI root cause,
  // raw log) collapse behind one disclosure so the humanized story leads. Default
  // closed there; in Technical mode they're always shown.
  const [showTech, setShowTech] = useState(false);

  return (
    <div className="space-y-3 pl-4">
      {/* Header */}
      <SurfaceCard>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4" style={{ color: SEVERITY_TOKENS[report.severity].color }} />
            <span className="text-xs font-semibold text-text">{report.id}</span>
            <SeverityBadge severity={report.severity} />
          </div>
          <button
            onClick={onClose}
            aria-label={`Close details for crash ${report.id}`}
            className="focus-ring rounded text-text-muted hover:text-text"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-text mb-2">
          <DecoratedCrashText text={report.errorMessage} />
        </p>
        <div className="flex flex-wrap gap-2 text-2xs text-text-muted">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(report.timestamp).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{report.machineState.engineVersion} {report.machineState.buildConfig}</span>
          {/* An unattributed crash SAYS so. Module attribution is scored (path over
              symbol) and reports unknown when the evidence is thin or two subsystems
              tie — silently omitting the chip would read as "no module involved". */}
          <span className="flex items-center gap-1" data-testid="crash-module">
            <Layers className="w-3 h-3" />
            {report.mappedModule ?? <span className="italic">module not determined</span>}
          </span>
        </div>
        {/* Provenance + sighting record. A built-in sample says it is one and
            carries NO history — it was never observed, so any "seen N times"
            here would be invented. An imported crash reports the real count and
            the date PoF first saw it. */}
        <div className="mt-2" data-testid="crash-provenance">
          {report.source === 'imported' ? (
            <MicroLabel tone="muted" as="p">
              Imported from this project ·{' '}
              {report.history
                ? `seen ${report.history.occurrences} ${report.history.occurrences === 1 ? 'time' : 'times'}, first seen ${new Date(report.history.firstSeenAt).toLocaleString()}`
                : 'not yet recorded in crash history'}
              {report.history?.rawLogTruncated
                ? ` · raw log stored truncated (${report.history.rawLogChars.toLocaleString()} chars originally)`
                : ''}
            </MicroLabel>
          ) : (
            <MicroLabel tone="muted" as="p">
              Built-in sample crash — demo data, not observed in this project.
            </MicroLabel>
          )}
        </div>
      </SurfaceCard>

      {plainMode ? (
        <>
          {/* Humanized "what happened / what to do" */}
          <PlainCrashSummary report={report} diagnosis={diagnosis} />

          {/* All developer detail tucked behind one disclosure */}
          <button
            onClick={() => setShowTech((v) => !v)}
            data-testid="show-tech-toggle"
            aria-expanded={showTech}
            className="focus-ring rounded flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors"
          >
            <Terminal className="w-3 h-3" />
            {showTech ? 'Hide' : 'Show'} technical details
            {showTech ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <AnimatePresence>
            {showTech && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3">
                  <CallstackCard report={report} />
                  {diagnosis && <AiDiagnosisCard diagnosis={diagnosis} />}
                  <RawLogBlock rawLog={report.rawLog} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          {/* Technical mode — dense developer view. The AI-analysis slot is never
              left silently empty: with no diagnosis it carries the explicit notice
              (+ clearly-labelled category guidance), so an expert reader sees the
              same honesty a Plain-mode reader gets. */}
          <CallstackCard report={report} />
          {diagnosis ? <AiDiagnosisCard diagnosis={diagnosis} /> : <NoDiagnosisNotice report={report} />}
          <RawLogDisclosure rawLog={report.rawLog} />
        </>
      )}
    </div>
  );
}
