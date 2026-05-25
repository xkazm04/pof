'use client';

import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';
import type { CLISessionState } from '@/components/cli/store/cliPanelStore';

interface Props {
  session: CLISessionState;
  onSelect: (id: string) => void;
}

/** Format a millisecond ago timestamp as a short relative label. */
function shortRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'now';
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}

/**
 * One row in the CLI Rail's SessionList. Status indicator (running spinner,
 * success check, failure cross, or idle dot) + label + last-activity tag.
 */
export function SessionRow({ session, onSelect }: Props) {
  const status = session.isRunning
    ? 'running'
    : session.lastTaskSuccess === true
      ? 'succeeded'
      : session.lastTaskSuccess === false
        ? 'failed'
        : 'idle';

  return (
    <button
      onClick={() => onSelect(session.id)}
      className="focus-ring w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left text-text hover:bg-surface/40 transition-colors"
      aria-label={session.label}
    >
      <span aria-label={status} className="shrink-0">
        {status === 'running' && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
        {status === 'succeeded' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        {status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
        {status === 'idle' && <Circle className="w-3.5 h-3.5 text-text-muted" />}
      </span>
      <span className="flex-1 truncate text-xs text-text">{session.label}</span>
      <span className="text-2xs text-text-muted/70 shrink-0">
        {shortRelative(session.lastActivityAt)}
      </span>
    </button>
  );
}
