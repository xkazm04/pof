import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import { type ReplayFrame } from '@/lib/crash-analyzer/crash-replay';
import { frameToken } from './helpers';

export function FrameDetail({ frame }: { frame: ReplayFrame }) {
  const token = frameToken(frame);
  return (
    <div
      data-testid="time-machine-frame-detail"
      className="rounded-md border p-2"
      style={{ backgroundColor: token.bg, borderColor: token.border }}
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        <span className="text-2xs font-mono font-medium" style={{ color: token.color }}>
          {frame.functionName}
        </span>
        {frame.isCrashOrigin ? (
          <span className="text-2xs px-1 rounded font-medium" style={{ color: SEVERITY_TOKENS.critical.color, backgroundColor: SEVERITY_TOKENS.critical.bg }}>
            crash origin
          </span>
        ) : (
          <span className="text-2xs px-1 rounded text-text-muted bg-surface-2">
            {frame.isGameCode ? 'game code' : 'engine'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-text-muted font-mono">
        {frame.sourceFile && (
          <span>
            {frame.sourceFile}
            {frame.lineNumber != null && `:${frame.lineNumber}`}
          </span>
        )}
        <span className="truncate">{frame.moduleName}</span>
        <span className="text-text-muted/70">{frame.address}</span>
      </div>
    </div>
  );
}
