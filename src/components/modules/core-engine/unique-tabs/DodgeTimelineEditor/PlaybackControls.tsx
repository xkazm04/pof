'use client';

import { Play, Pause, RotateCcw } from 'lucide-react';
import { ACCENT_CYAN, ACCENT_EMERALD,
  withOpacity, OPACITY_25, OPACITY_8,
} from '@/lib/chart-colors';

export function PlaybackControls({
  isPlaying,
  playhead,
  staminaCost,
  onPlay,
  onPause,
  onReset,
}: {
  isPlaying: boolean;
  playhead: number;
  staminaCost: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors"
        style={{ borderColor: `${withOpacity(ACCENT_CYAN, OPACITY_25)}`, backgroundColor: `${withOpacity(ACCENT_CYAN, OPACITY_8)}`, color: ACCENT_CYAN }}
      >
        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        onClick={onReset}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-border/30 text-text-muted hover:text-text transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        Reset
      </button>
      <div className="ml-auto flex items-center gap-3 text-xs font-mono text-text-muted">
        <span>Playhead: <span className="font-bold text-text">{playhead.toFixed(3)}s</span></span>
        <span>Stamina: <span className="font-bold" style={{ color: ACCENT_EMERALD, textShadow: `0 0 12px ${withOpacity(ACCENT_EMERALD, OPACITY_25)}` }}>-{staminaCost}</span></span>
      </div>
    </div>
  );
}
