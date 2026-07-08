'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { Tooltip } from '@/components/ui/Tooltip';
import type { SessionRecord } from '@/types/session-analytics';
import { STATUS_SUCCESS, STATUS_ERROR, OPACITY_10 } from '@/lib/chart-colors';

export function RecentSessionRow({ session }: { session: SessionRecord }) {
  const durationStr = session.durationMs > 60000
    ? `${Math.round(session.durationMs / 60000)}m`
    : `${Math.round(session.durationMs / 1000)}s`;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-surface-hover transition-colors">
      {session.success ? (
        <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-label="Session succeeded" />
      ) : (
        <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} aria-label="Session failed" />
      )}
      <TruncateWithTooltip className="text-xs text-text-muted-hover w-28 truncate flex-shrink-0">{session.moduleId}</TruncateWithTooltip>
      <TruncateWithTooltip className="text-xs text-text-muted-hover flex-1 min-w-0 truncate">{session.promptPreview}</TruncateWithTooltip>
      <span className="text-2xs text-text-muted flex-shrink-0">{durationStr}</span>
      {session.hadProjectContext && (
        <Tooltip content="Used project context">
          <span
            tabIndex={0}
            className="text-2xs px-1 py-0.5 rounded flex-shrink-0 cursor-default focus-ring"
            style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}
          >context</span>
        </Tooltip>
      )}
    </div>
  );
}
