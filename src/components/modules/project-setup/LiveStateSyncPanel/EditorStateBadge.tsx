import { Eye, Play, Pause, Square, Layers } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
  OPACITY_15,
} from '@/lib/chart-colors';

// ── Editor state badge ────────────────────────────────────────────────────

export function EditorStateBadge({ state }: { state: string }) {
  const config: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
    Editing: { color: ACCENT_CYAN, icon: Layers },
    PIE: { color: STATUS_SUCCESS, icon: Play },
    SIE: { color: ACCENT_VIOLET, icon: Eye },
    Paused: { color: ACCENT_ORANGE, icon: Pause },
  };
  const c = config[state] ?? { color: STATUS_NEUTRAL, icon: Square };
  const Icon = c.icon;
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
      role="status"
      aria-label={`Editor state: ${state}`}
      style={{ color: c.color, backgroundColor: `${c.color}${OPACITY_15}` }}
    >
      <Icon className="w-3 h-3" />
      {state}
    </span>
  );
}
