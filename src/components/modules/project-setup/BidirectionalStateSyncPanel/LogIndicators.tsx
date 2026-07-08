import { ArrowUp, ArrowDown, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_ORANGE,
  OPACITY_15,
} from '@/lib/chart-colors';
import type { SyncDirection, LogLevel } from './types';

// ── Direction badge ────────────────────────────────────────────────────────

export function DirectionBadge({ direction }: { direction: SyncDirection }) {
  const isOut = direction === 'outbound';
  return (
    <span
      className="flex items-center gap-0.5 px-1 py-0.5 rounded text-2xs font-bold"
      style={{
        color: isOut ? ACCENT_ORANGE : ACCENT_CYAN,
        backgroundColor: `${isOut ? ACCENT_ORANGE : ACCENT_CYAN}${OPACITY_15}`,
      }}
    >
      {isOut ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {isOut ? 'OUT' : 'IN'}
    </span>
  );
}

// ── Level indicator ─────────────────────────────────────────────────────

export function LevelIndicator({ level }: { level: LogLevel }) {
  const conf: Record<LogLevel, { color: string; Icon: React.ComponentType<{ className?: string }> }> = {
    info: { color: ACCENT_CYAN, Icon: CheckCircle },
    warn: { color: STATUS_WARNING, Icon: AlertTriangle },
    conflict: { color: STATUS_ERROR, Icon: AlertTriangle },
  };
  const c = conf[level];
  return (
    <span className="flex-shrink-0" style={{ color: c.color }}>
      <c.Icon className="w-3 h-3" />
    </span>
  );
}
