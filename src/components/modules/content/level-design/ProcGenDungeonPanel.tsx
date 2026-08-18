'use client';

import { useState } from 'react';
import { Boxes, Loader2, Dice5 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { validateSeed, SEED_ROLL_MAX } from '@/lib/level-design/run-params';
import { RunHistoryList } from './RunHistoryList';
import { useRunHistory } from './useRunHistory';
import type { ProcgenRun } from '@/types/procgen';

// Re-exported so the panel's existing named import surface is unchanged; the
// rule itself is single-sourced (it was duplicated in BiomeScatterPanel).
export { validateSeed };

interface ProcGenDungeonPanelProps {
  /** Dispatch a generation run with the chosen params. */
  onGenerate: (roomCount: number, seed: number) => void;
  /** True while a generation task is running. */
  isGenerating: boolean;
}

export const ROOMS_MIN = 2;
export const ROOMS_MAX = 20;

/**
 * Pure validator for the room-count field. Returns an error string when the raw
 * input is empty, non-numeric (NaN), non-integer, or outside
 * [ROOMS_MIN, ROOMS_MAX]; null when acceptable. Pure so it can be unit-tested.
 */
export function validateRoomCount(raw: string): string | null {
  if (raw.trim() === '') return 'Enter a room count';
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Room count must be a number';
  if (!Number.isInteger(n)) return 'Room count must be a whole number';
  if (n < ROOMS_MIN || n > ROOMS_MAX) return `Room count must be between ${ROOMS_MIN} and ${ROOMS_MAX}`;
  return null;
}

export function ProcGenDungeonPanel({ onGenerate, isGenerating }: ProcGenDungeonPanelProps) {
  // Inputs are kept as raw strings so cleared (NaN) / out-of-range values can be
  // validated and surfaced inline, rather than silently clamped at generate time.
  const [roomsInput, setRoomsInput] = useState('6');
  const [seedInput, setSeedInput] = useState('1337');

  // The history is refetched on mount and whenever a generation finishes
  // (isGenerating true -> false); its newest row IS the "last run" line.
  const { runs, error: fetchError } = useRunHistory<ProcgenRun>('/api/level-design/procgen-result', isGenerating);
  const lastRun = runs[0] ?? null;

  const roomsErr = validateRoomCount(roomsInput);
  const seedErr = validateSeed(seedInput);
  const inputsValid = !roomsErr && !seedErr;

  const handleGenerate = () => {
    if (!inputsValid) return; // button is disabled too — guard for safety
    onGenerate(Number(roomsInput), Number(seedInput));
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 space-y-6 bg-[#03030a] text-violet-100 font-mono">
      <div className="flex items-center gap-3 border-b border-violet-900/30 pb-4">
        <div className="w-11 h-11 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase">Procedural Dungeon (UE)</h3>
          <p className="text-xs text-violet-400/60 uppercase tracking-wider mt-0.5">Drive ARPGLevelGenerator → /Game/Maps/ProcGenDungeon</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Room count</span>
          <input
            type="number" min={ROOMS_MIN} max={ROOMS_MAX} step={1} value={roomsInput}
            onChange={(e) => setRoomsInput(e.target.value)}
            data-testid="dungeon-rooms-input"
            aria-label="Room count"
            aria-invalid={!!roomsErr}
            aria-describedby="dungeon-rooms-help"
            className={`w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border text-violet-100 outline-none focus:border-violet-500/70 ${roomsErr ? 'border-red-500/60' : 'border-violet-900/50'}`}
          />
          <span
            id="dungeon-rooms-help"
            data-testid="dungeon-rooms-help"
            role={roomsErr ? 'alert' : undefined}
            className={`block text-[11px] ${roomsErr ? 'text-red-400' : 'text-violet-500/70'}`}
          >
            {roomsErr ?? `Range ${ROOMS_MIN}–${ROOMS_MAX}`}
          </span>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Seed</span>
          <div className="flex gap-2">
            <input
              type="number" min={0} step={1} value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              data-testid="dungeon-seed-input"
              aria-label="Seed"
              aria-invalid={!!seedErr}
              aria-describedby="dungeon-seed-help"
              className={`w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border text-violet-100 outline-none focus:border-violet-500/70 ${seedErr ? 'border-red-500/60' : 'border-violet-900/50'}`}
            />
            <button
              type="button"
              // Re-rolling is safe because the previous seed is still a row in
              // the history below — that list IS the undo.
              onClick={() => setSeedInput(String(Math.floor(Math.random() * SEED_ROLL_MAX)))}
              title="Randomize seed"
              aria-label="Randomize seed"
              className="px-3 rounded-lg border border-violet-900/50 text-violet-400 hover:text-violet-200 focus-ring"
            >
              <Dice5 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <span
            id="dungeon-seed-help"
            data-testid="dungeon-seed-help"
            role={seedErr ? 'alert' : undefined}
            className={`block text-[11px] ${seedErr ? 'text-red-400' : 'text-violet-500/70'}`}
          >
            {seedErr ?? 'Whole number ≥ 0'}
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || !inputsValid}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 focus-ring"
        style={{
          backgroundColor: `${MODULE_COLORS.content}20`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}60`,
        }}
      >
        {isGenerating ? (
          <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Generating…</>
        ) : (
          <><Boxes className="w-5 h-5" aria-hidden="true" /> Generate Dungeon (UE)</>
        )}
      </button>

      {fetchError ? (
        <div
          role="alert"
          data-testid="dungeon-fetch-error"
          className="text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
        >
          Could not load last run: {fetchError}
        </div>
      ) : (
        <>
          <div className="text-xs px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20">
            {/* A failed latest run must not read as "0 rooms generated". */}
            {lastRun
              ? lastRun.success
                ? `Last run: ${lastRun.roomCount} rooms (seed ${lastRun.seed}) at ${lastRun.createdAt}`
                : `Last run FAILED (seed ${lastRun.seed}) at ${lastRun.createdAt}: ${lastRun.failureReason || 'no reason reported'}`
              : 'No runs yet. Set params and generate — the dungeon is baked into /Game/Maps/ProcGenDungeon.'}
          </div>

          <RunHistoryList
            runs={runs}
            describe={(run) => `${run.roomCount} rooms`}
            onReuseSeed={(seed) => setSeedInput(String(seed))}
            emptyText="No runs recorded yet. Every run — including a failed one — lands here with its seed."
            testIdPrefix="dungeon-history"
          />
        </>
      )}
    </div>
  );
}
