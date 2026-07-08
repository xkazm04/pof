'use client';

import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { SpawnEntry } from '@/types/level-design';

interface SpawnEntriesPanelProps {
  spawnEntries: SpawnEntry[];
  showSpawns: boolean;
  setShowSpawns: (v: boolean) => void;
  addSpawnEntry: () => void;
  updateSpawn: (id: string, patch: Partial<SpawnEntry>) => void;
  removeSpawn: (id: string) => void;
}

export function SpawnEntriesPanel({
  spawnEntries,
  showSpawns,
  setShowSpawns,
  addSpawnEntry,
  updateSpawn,
  removeSpawn,
}: SpawnEntriesPanelProps) {
  return (
    <div className="bg-black/40 border border-violet-900/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setShowSpawns(!showSpawns)}
        className="flex items-center justify-between w-full p-3 bg-violet-900/10 hover:bg-violet-900/20 transition-colors border-b border-violet-900/30"
      >
        <div className="flex items-center gap-2">
          {showSpawns ? <ChevronDown className="w-3.5 h-3.5 text-violet-400" /> : <ChevronRight className="w-3.5 h-3.5 text-violet-400" />}
          <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">
            SPAWN_VECTORS
          </span>
          <span className="text-[11px] font-mono text-violet-500 bg-violet-900/30 px-1.5 rounded">
            {spawnEntries.length}
          </span>
        </div>
      </button>

      {showSpawns && (
        <div className="p-3 space-y-2 relative">
          <div className="absolute left-4 top-4 bottom-4 w-px bg-violet-900/40" />

          {spawnEntries.map((entry) => (
            <div
              key={entry.id}
              className="relative pl-6 flex items-center gap-2 group"
            >
              <div className="absolute left-[-2px] w-2 h-2 rounded-full border-2 border-[#03030a] bg-violet-500 transition-transform group-hover:scale-125 z-10" />
              <div className="absolute left-[-2px] w-2 h-2 rounded-full border-2 border-[#03030a] bg-violet-500 animate-ping z-0 opacity-50" />

              <div className="flex-1 grid grid-cols-[1fr_50px_60px] gap-2 p-1.5 bg-black/60 border border-violet-900/30 rounded-lg">
                <input
                  type="text"
                  value={entry.enemyClass}
                  onChange={(e) => updateSpawn(entry.id, { enemyClass: e.target.value })}
                  className="bg-transparent text-xs text-violet-100 outline-none font-mono placeholder-violet-500/40 px-2 uppercase"
                  placeholder="ENTITY_CLASS"
                />
                <div className="flex items-center bg-violet-900/20 rounded px-1 border border-violet-900/30">
                  <span className="text-[11px] text-violet-500 pr-1">Q</span>
                  <input
                    type="number"
                    value={entry.count}
                    onChange={(e) => updateSpawn(entry.id, { count: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-violet-100 outline-none text-center font-mono"
                    min={1}
                  />
                </div>
                <div className="flex items-center bg-violet-900/20 rounded px-1 border border-violet-900/30">
                  <span className="text-[11px] text-violet-500 pr-1">W</span>
                  <input
                    type="number"
                    value={entry.wave}
                    onChange={(e) => updateSpawn(entry.id, { wave: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-violet-100 outline-none text-center font-mono"
                    min={1}
                  />
                </div>
              </div>
              <button
                onClick={() => removeSpawn(entry.id)}
                className="w-6 h-6 rounded flex items-center justify-center bg-black/60 border border-violet-900/30 text-violet-500 hover:text-red-400 hover:border-red-500/30 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            onClick={addSpawnEntry}
            className="ml-6 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-violet-400 uppercase tracking-widest border border-dashed border-violet-900/50 hover:bg-violet-900/20 hover:border-violet-500/50 transition-all"
          >
            <Plus className="w-3 h-3" />
            ADD_VECTOR
          </button>
        </div>
      )}
    </div>
  );
}
