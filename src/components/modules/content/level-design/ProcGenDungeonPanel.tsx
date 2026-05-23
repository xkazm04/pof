'use client';

import { useState, useEffect } from 'react';
import { Boxes, Loader2, Dice5 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { tryApiFetch } from '@/lib/api-utils';
import type { ProcgenRun } from '@/types/procgen';

interface ProcGenDungeonPanelProps {
  /** Dispatch a generation run with the chosen params. */
  onGenerate: (roomCount: number, seed: number) => void;
  /** True while a generation task is running. */
  isGenerating: boolean;
}

export function ProcGenDungeonPanel({ onGenerate, isGenerating }: ProcGenDungeonPanelProps) {
  const [roomCount, setRoomCount] = useState(6);
  const [seed, setSeed] = useState(1337);
  const [lastRun, setLastRun] = useState<ProcgenRun | null>(null);

  // Refetch the latest run on mount + whenever a generation finishes
  // (isGenerating true -> false). The fetch is async, so the setState lands
  // after the await — never synchronously within the effect.
  useEffect(() => {
    if (isGenerating) return;
    let cancelled = false;
    void (async () => {
      const r = await tryApiFetch<ProcgenRun | null>('/api/level-design/procgen-result');
      if (!cancelled && r.ok) setLastRun(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isGenerating]);

  const clampedRooms = Math.max(2, Math.min(20, roomCount));

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
            type="number" min={2} max={20} value={roomCount}
            onChange={(e) => setRoomCount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border border-violet-900/50 text-violet-100 outline-none focus:border-violet-500/70"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Seed</span>
          <div className="flex gap-2">
            <input
              type="number" value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border border-violet-900/50 text-violet-100 outline-none focus:border-violet-500/70"
            />
            <button
              type="button"
              onClick={() => setSeed(Math.floor(Math.random() * 100000))}
              title="Randomize seed"
              className="px-3 rounded-lg border border-violet-900/50 text-violet-400 hover:text-violet-200"
            >
              <Dice5 className="w-4 h-4" />
            </button>
          </div>
        </label>
      </div>

      <button
        onClick={() => onGenerate(clampedRooms, seed)}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40"
        style={{
          backgroundColor: `${MODULE_COLORS.content}20`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}60`,
        }}
      >
        {isGenerating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Generating…</>
        ) : (
          <><Boxes className="w-5 h-5" /> Generate Dungeon (UE)</>
        )}
      </button>

      <div className="text-xs px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20">
        {lastRun
          ? `Last run: ${lastRun.roomCount} rooms (seed ${lastRun.seed}) at ${lastRun.createdAt}`
          : 'No runs yet. Set params and generate — the dungeon is baked into /Game/Maps/ProcGenDungeon.'}
      </div>
    </div>
  );
}
