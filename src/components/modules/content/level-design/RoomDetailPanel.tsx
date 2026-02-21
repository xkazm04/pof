'use client';

import { useState, useCallback } from 'react';
import {
  Swords, Puzzle, Compass, Crown, Shield, ArrowRightLeft, Film, Home,
  FileCode, Plus, Trash2, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import type { RoomNode, RoomType, DifficultyLevel, PacingCurve, SpawnEntry } from '@/types/level-design';
import type { LucideIcon } from 'lucide-react';
import { STATUS_ERROR, ACCENT_VIOLET, ACCENT_EMERALD, STATUS_WARNING, STATUS_INFO, ACCENT_PINK, STATUS_SUCCESS, STATUS_LIME, STATUS_BLOCKER } from '@/lib/chart-colors';

const ROOM_TYPE_CONFIG: Record<RoomType, { icon: LucideIcon; color: string; label: string }> = {
  combat: { icon: Swords, color: STATUS_ERROR, label: 'Combat' },
  puzzle: { icon: Puzzle, color: ACCENT_VIOLET, label: 'Puzzle' },
  exploration: { icon: Compass, color: ACCENT_EMERALD, label: 'Exploration' },
  boss: { icon: Crown, color: STATUS_WARNING, label: 'Boss' },
  safe: { icon: Shield, color: STATUS_INFO, label: 'Safe Zone' },
  transition: { icon: ArrowRightLeft, color: '#8b8fb0', label: 'Transition' },
  cutscene: { icon: Film, color: ACCENT_PINK, label: 'Cutscene' },
  hub: { icon: Home, color: '#2dd4bf', label: 'Hub' },
};

const ALL_ROOM_TYPES: RoomType[] = ['combat', 'puzzle', 'exploration', 'boss', 'safe', 'transition', 'cutscene', 'hub'];
const ALL_PACING: PacingCurve[] = ['rest', 'buildup', 'rising', 'peak', 'falling'];
const ALL_DIFFICULTIES: DifficultyLevel[] = [1, 2, 3, 4, 5];

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  1: STATUS_SUCCESS, 2: STATUS_LIME, 3: STATUS_WARNING, 4: STATUS_BLOCKER, 5: STATUS_ERROR,
};

interface RoomDetailPanelProps {
  room: RoomNode;
  onUpdate: (room: RoomNode) => void;
  onGenerateCode: (room: RoomNode) => void;
  accentColor: string;
  isGenerating: boolean;
}

export function RoomDetailPanel({
  room,
  onUpdate,
  onGenerateCode,
  accentColor,
  isGenerating,
}: RoomDetailPanelProps) {
  const [showSpawns, setShowSpawns] = useState(true);
  const [showFiles, setShowFiles] = useState(false);

  const cfg = ROOM_TYPE_CONFIG[room.type];
  const Icon = cfg.icon;

  const updateField = useCallback(<K extends keyof RoomNode>(key: K, value: RoomNode[K]) => {
    onUpdate({ ...room, [key]: value });
  }, [room, onUpdate]);

  const addSpawnEntry = useCallback(() => {
    const entry: SpawnEntry = {
      id: `spawn-${Date.now()}`,
      enemyClass: 'BP_Enemy',
      count: 3,
      spawnDelay: 0,
      wave: 1,
    };
    updateField('spawnEntries', [...room.spawnEntries, entry]);
  }, [room.spawnEntries, updateField]);

  const updateSpawn = useCallback((id: string, patch: Partial<SpawnEntry>) => {
    updateField(
      'spawnEntries',
      room.spawnEntries.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }, [room.spawnEntries, updateField]);

  const removeSpawn = useCallback((id: string) => {
    updateField('spawnEntries', room.spawnEntries.filter((s) => s.id !== id));
  }, [room.spawnEntries, updateField]);

  return (
    <div className="w-full h-full bg-[#03030a] border-l border-violet-900/40 shadow-[-20px_0_40px_rgba(167,139,250,0.05)] overflow-y-auto relative">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <div className="space-y-6 p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-violet-900/40 pb-4">
          <div className="w-12 h-12 rounded-xl border border-violet-500/50 flex items-center justify-center flex-shrink-0 relative overflow-hidden group shadow-[0_0_15px_rgba(139,92,246,0.2)]"
            style={{ backgroundColor: `${cfg.color}15` }}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent -translate-y-[100%] group-hover:translate-y-[100%] transition-transform duration-1000" />
            <Icon className="w-6 h-6" style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block mb-0.5">NODE_NAME</label>
            <input
              type="text"
              value={room.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full bg-transparent text-lg font-bold text-violet-100 outline-none border-b border-transparent focus:border-violet-500/50 transition-colors uppercase tracking-wider truncate"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Type selector */}
        <div>
          <label className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Zap className="w-3 h-3" /> Topology Classification
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ALL_ROOM_TYPES.map((type) => {
              const tc = ROOM_TYPE_CONFIG[type];
              const active = room.type === type;
              const TIcon = tc.icon;
              return (
                <button
                  key={type}
                  onClick={() => updateField('type', type)}
                  className="flex flex-col items-center justify-center p-2 rounded-lg transition-all group border relative overflow-hidden"
                  style={{
                    backgroundColor: active ? `${tc.color}15` : 'rgba(10,10,25,0.6)',
                    color: active ? tc.color : 'var(--text-muted)',
                    borderColor: active ? `${tc.color}50` : 'rgba(139,92,246,0.2)',
                    boxShadow: active ? `0 0 15px ${tc.color}20, inset 0 0 10px ${tc.color}10` : 'none',
                  }}
                >
                  {active && <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />}
                  <TIcon className="w-4 h-4 mb-1.5 transition-transform group-hover:scale-110" style={{ color: active ? tc.color : 'rgba(139,92,246,0.5)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider truncate w-full text-center" style={{ color: active ? tc.color : 'rgba(200,200,240,0.6)' }}>
                    {tc.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description & Encounter */}
        <div className="space-y-4">
          <div className="bg-black/40 rounded-xl border border-violet-900/30 p-1 relative group">
            <div className="absolute -left-px top-4 bottom-4 w-[2px] bg-violet-500/30 group-focus-within:bg-violet-400 transition-colors" />
            <div className="px-3 pt-2 pb-1">
              <label className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block mb-1">NARRATIVE_ROLE</label>
              <textarea
                value={room.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Aesthetics and narrative role..."
                className="w-full bg-transparent text-[11px] text-violet-200 placeholder-violet-500/40 outline-none resize-none leading-relaxed font-mono"
                rows={2}
              />
            </div>
          </div>

          <div className="bg-black/40 rounded-xl border border-violet-900/30 p-1 relative group">
            <div className="absolute -left-px top-4 bottom-4 w-[2px] bg-amber-500/30 group-focus-within:bg-amber-400 transition-colors" />
            <div className="px-3 pt-2 pb-1">
              <label className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest block mb-1">ENCOUNTER_DESIGN</label>
              <textarea
                value={room.encounterDesign}
                onChange={(e) => updateField('encounterDesign', e.target.value)}
                placeholder="Wave patterns, triggers, hazards..."
                className="w-full bg-transparent text-[11px] text-amber-100/90 placeholder-amber-500/40 outline-none resize-none leading-relaxed font-mono"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Difficulty + Pacing row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block mb-2">THREAT_LEVEL</label>
            <div className="flex h-8 rounded-lg overflow-hidden border border-violet-900/40 bg-black/60">
              {ALL_DIFFICULTIES.map((d) => {
                const active = room.difficulty === d;
                const dColor = DIFFICULTY_COLORS[d];
                return (
                  <button
                    key={d}
                    onClick={() => updateField('difficulty', d)}
                    className="flex-1 text-[10px] font-bold transition-all relative"
                    style={{
                      backgroundColor: active ? `${dColor}25` : 'transparent',
                      color: active ? dColor : 'rgba(200,200,240,0.5)',
                    }}
                  >
                    {active && <div className="absolute bottom-0 inset-x-0 h-[2px]" style={{ backgroundColor: dColor }} />}
                    {active && <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${dColor}, transparent)` }} />}
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block mb-2">PACING_CURVE</label>
            <div className="relative h-8">
              <select
                value={room.pacing}
                onChange={(e) => updateField('pacing', e.target.value as PacingCurve)}
                className="w-full h-full px-3 bg-black/60 border border-violet-900/40 rounded-lg text-xs font-mono text-violet-200 outline-none focus:border-violet-500 transition-colors appearance-none uppercase tracking-wider"
              >
                {ALL_PACING.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Spawn Entries */}
        <div className="bg-black/40 border border-violet-900/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowSpawns(!showSpawns)}
            className="flex items-center justify-between w-full p-3 bg-violet-900/10 hover:bg-violet-900/20 transition-colors border-b border-violet-900/30"
          >
            <div className="flex items-center gap-2">
              {showSpawns ? <ChevronDown className="w-3.5 h-3.5 text-violet-400" /> : <ChevronRight className="w-3.5 h-3.5 text-violet-400" />}
              <span className="text-[10px] font-bold text-violet-300 uppercase tracking-widest">
                SPAWN_VECTORS
              </span>
              <span className="text-[9px] font-mono text-violet-500 bg-violet-900/30 px-1.5 rounded">
                {room.spawnEntries.length}
              </span>
            </div>
          </button>

          {showSpawns && (
            <div className="p-3 space-y-2 relative">
              <div className="absolute left-4 top-4 bottom-4 w-px bg-violet-900/40" />

              {room.spawnEntries.map((entry) => (
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
                      className="bg-transparent text-[10px] text-violet-100 outline-none font-mono placeholder-violet-500/40 px-2 uppercase"
                      placeholder="ENTITY_CLASS"
                    />
                    <div className="flex items-center bg-violet-900/20 rounded px-1 border border-violet-900/30">
                      <span className="text-[8px] text-violet-500 pr-1">Q</span>
                      <input
                        type="number"
                        value={entry.count}
                        onChange={(e) => updateSpawn(entry.id, { count: Number(e.target.value) })}
                        className="w-full bg-transparent text-[10px] text-violet-100 outline-none text-center font-mono"
                        min={1}
                      />
                    </div>
                    <div className="flex items-center bg-violet-900/20 rounded px-1 border border-violet-900/30">
                      <span className="text-[8px] text-violet-500 pr-1">W</span>
                      <input
                        type="number"
                        value={entry.wave}
                        onChange={(e) => updateSpawn(entry.id, { wave: Number(e.target.value) })}
                        className="w-full bg-transparent text-[10px] text-violet-100 outline-none text-center font-mono"
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
                className="ml-6 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold text-violet-400 uppercase tracking-widest border border-dashed border-violet-900/50 hover:bg-violet-900/20 hover:border-violet-500/50 transition-all"
              >
                <Plus className="w-3 h-3" />
                ADD_VECTOR
              </button>
            </div>
          )}
        </div>

        {/* Linked Files */}
        <div className="bg-black/40 border border-violet-900/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="flex items-center justify-between w-full p-3 bg-violet-900/10 hover:bg-violet-900/20 transition-colors border-b border-violet-900/30"
          >
            <div className="flex items-center gap-2">
              {showFiles ? <ChevronDown className="w-3.5 h-3.5 text-violet-400" /> : <ChevronRight className="w-3.5 h-3.5 text-violet-400" />}
              <span className="text-[10px] font-bold text-violet-300 uppercase tracking-widest">
                LINKED_ASSETS
              </span>
              <span className="text-[9px] font-mono text-violet-500 bg-violet-900/30 px-1.5 rounded">
                {room.linkedFiles.length}
              </span>
            </div>
          </button>

          {showFiles && (
            <div className="p-3 space-y-1">
              {room.linkedFiles.map((fp, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-black/40 border border-violet-900/30 rounded group hover:border-violet-500/30 transition-colors">
                  <FileCode className="w-3.5 h-3.5 text-violet-500/50 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                  <span className="text-[10px] text-violet-200 font-mono truncate tracking-tight">{fp}</span>
                </div>
              ))}
              {room.linkedFiles.length === 0 && (
                <p className="text-[9px] text-violet-500/60 font-mono italic px-2">No assets linked. Execute sequence to formulate bindings.</p>
              )}
            </div>
          )}
        </div>

        {/* Generate Code button */}
        <button
          onClick={() => onGenerateCode(room)}
          disabled={isGenerating}
          className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 mt-4 group outline-none"
          style={{
            backgroundColor: `${accentColor}15`,
            color: accentColor,
            border: `1px solid ${accentColor}50`,
            boxShadow: `0 0 20px ${accentColor}20, inset 0 0 10px ${accentColor}10`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
          <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

          {isGenerating ? (
            <div className="flex items-center gap-2 animate-pulse">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              COMPILING...
            </div>
          ) : (
            <>
              <Zap className="w-4 h-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(currentColor,0.8)] transition-all" />
              EXECUTE SPAWN SEQUENCE
            </>
          )}
        </button>
      </div>
    </div>
  );
}
