import {
  SEVERITY_TOKENS,
  ACCENT_EMERALD,
  STATUS_LOCKED,
  statusBg,
  statusBorder,
  type SeverityToken,
} from '@/lib/chart-colors';
import { type ReplayFrame } from '@/lib/crash-analyzer/crash-replay';

// ── Frame coloring ───────────────────────────────────────────────────────────
//
// Three legible tiers: dim slate engine frames, emerald "your game code"
// frames, and the red crash-origin culprit. A frame is a `SeverityToken`-shaped
// triple so segments style identically to the rest of the crash UI.

export const GAME_TOKEN: SeverityToken = {
  color: ACCENT_EMERALD,
  bg: statusBg(ACCENT_EMERALD),
  border: statusBorder(ACCENT_EMERALD),
};
export const ENGINE_TOKEN: SeverityToken = {
  color: STATUS_LOCKED,
  bg: statusBg(STATUS_LOCKED),
  border: statusBorder(STATUS_LOCKED),
};

export function frameToken(frame: ReplayFrame): SeverityToken {
  if (frame.isCrashOrigin) return SEVERITY_TOKENS.critical;
  return frame.isGameCode ? GAME_TOKEN : ENGINE_TOKEN;
}

/** Short, human label for a frame (drops the namespace before `::`). */
export function shortName(fn: string): string {
  const parts = fn.split('::');
  return parts[parts.length - 1] || fn;
}
