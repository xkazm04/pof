import type { Dispatch, SetStateAction } from 'react';
import {
  Play, Pause, RotateCcw, StepForward, FlaskConical,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_15, OPACITY_20,
  withOpacity, OPACITY_12, OPACITY_25,
} from '@/lib/chart-colors';
import type { SimSnapshot } from './types';
import { SIM_MAX_TIME } from './constants';

export function ControlsBar({
  runSim,
  isPlaying, setIsPlaying,
  playbackIdx, setPlaybackIdx,
  snapshots,
  simDuration, setSimDuration,
  currentSnap, currentTime,
  accent,
}: {
  runSim: () => void;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  playbackIdx: number | null;
  setPlaybackIdx: Dispatch<SetStateAction<number | null>>;
  snapshots: SimSnapshot[];
  simDuration: number;
  setSimDuration: Dispatch<SetStateAction<number>>;
  currentSnap: SimSnapshot | undefined;
  currentTime: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={runSim}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
        style={{ backgroundColor: `${withOpacity(STATUS_SUCCESS, OPACITY_12)}`, color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}` }}
      >
        <FlaskConical className="w-3.5 h-3.5" /> Run Simulation
      </button>

      <div className="flex items-center gap-1 border border-border/40 rounded-lg overflow-hidden">
        <button
          onClick={() => {
            if (isPlaying) {
              setIsPlaying(false);
            } else {
              if (playbackIdx != null && playbackIdx >= snapshots.length - 1) {
                setPlaybackIdx(0);
              }
              setIsPlaying(true);
            }
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium hover:bg-white/5 transition-colors"
          style={{ color: isPlaying ? STATUS_WARNING : accent }}
          disabled={snapshots.length === 0}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => setPlaybackIdx(prev => Math.min((prev ?? 0) + 1, snapshots.length - 1))}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-muted hover:bg-white/5 transition-colors border-l border-border/40"
          disabled={snapshots.length === 0}
        >
          <StepForward className="w-3.5 h-3.5" /> Step
        </button>
        <button
          onClick={() => { setPlaybackIdx(null); setIsPlaying(false); }}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-muted hover:bg-white/5 transition-colors border-l border-border/40"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 ml-auto text-2xs font-mono text-text-muted">
        <span>Duration</span>
        <input
          type="number" value={simDuration} min={1} max={SIM_MAX_TIME} step={1}
          onChange={(e) => setSimDuration(Math.max(1, Math.min(SIM_MAX_TIME, Number(e.target.value))))}
          className="w-12 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-text focus:outline-none text-center"
        />
        <span>sec</span>
      </div>

      {currentSnap && (
        <div className="text-xs font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: `${accent}${OPACITY_15}`, color: accent, border: `1px solid ${accent}${OPACITY_20}` }}>
          t = {currentTime.toFixed(2)}s
        </div>
      )}
    </div>
  );
}
