'use client';

import { Terminal } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import type { CrashReport, CallstackFrame } from '@/types/crash-analyzer';
import { CrashTimeMachine } from '../CrashTimeMachine';

export function CallstackCard({ report }: { report: CrashReport }) {
  // The Time Machine reimagines the raw frame list as a scrubable replay that
  // walks execution from engine entry into game code and stops on the glowing
  // culprit; the static list below stays as the full, copy-friendly reference.
  return (
    <SurfaceCard>
      <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
        <Terminal className="w-3.5 h-3.5 text-red-400" />
        Callstack ({report.callstack.length} frames)
      </h3>
      <CrashTimeMachine key={report.id} report={report} />
      <div className="mt-3 pt-3 border-t border-border space-y-0.5 max-h-48 overflow-y-auto">
        {report.callstack.map((frame) => (
          <FrameRow key={frame.index} frame={frame} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function FrameRow({ frame }: { frame: CallstackFrame }) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded text-xs leading-relaxed ${
        frame.isCrashOrigin ? 'border' : frame.isGameCode ? 'bg-surface-2/50' : ''
      }`}
      style={frame.isCrashOrigin
        ? { backgroundColor: SEVERITY_TOKENS.critical.bg, borderColor: SEVERITY_TOKENS.critical.border }
        : undefined}
    >
      <span className="text-text-muted w-4 text-right shrink-0">#{frame.index}</span>
      <span className={`font-mono truncate ${frame.isGameCode ? 'text-text' : 'text-text-muted'}`}>
        {frame.functionName}
      </span>
      {frame.sourceFile && (
        <span className="text-text-muted shrink-0">
          {frame.sourceFile}:{frame.lineNumber}
        </span>
      )}
      {frame.isCrashOrigin && (
        <Badge variant="error">crash</Badge>
      )}
    </div>
  );
}
