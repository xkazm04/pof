'use client';

import { useState, useCallback } from 'react';
import {
  Swords, Puzzle, Compass, Crown, Shield, ArrowRightLeft, Film, Home,
  FileCode, Plus, Trash2, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import type { RoomNode, RoomType, DifficultyLevel, PacingCurve, SpawnEntry } from '@/types/level-design';
import type { LucideIcon } from 'lucide-react';

const ROOM_TYPE_CONFIG: Record<RoomType, { icon: LucideIcon; color: string; label: string }> = {
  combat:      { icon: Swords,         color: '#f87171', label: 'Combat' },
  puzzle:      { icon: Puzzle,         color: '#a78bfa', label: 'Puzzle' },
  exploration: { icon: Compass,        color: '#34d399', label: 'Exploration' },
  boss:        { icon: Crown,          color: '#fbbf24', label: 'Boss' },
  safe:        { icon: Shield,         color: '#60a5fa', label: 'Safe Zone' },
  transition:  { icon: ArrowRightLeft, color: '#8b8fb0', label: 'Transition' },
  cutscene:    { icon: Film,           color: '#f472b6', label: 'Cutscene' },
  hub:         { icon: Home,           color: '#2dd4bf', label: 'Hub' },
};

const ALL_ROOM_TYPES: RoomType[] = ['combat', 'puzzle', 'exploration', 'boss', 'safe', 'transition', 'cutscene', 'hub'];
const ALL_PACING: PacingCurve[] = ['rest', 'buildup', 'rising', 'peak', 'falling'];
const ALL_DIFFICULTIES: DifficultyLevel[] = [1, 2, 3, 4, 5];

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  1: '#4ade80', 2: '#a3e635', 3: '#fbbf24', 4: '#fb923c', 5: '#f87171',
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
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
        <input
          type="text"
          value={room.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="flex-1 bg-transparent text-sm font-semibold text-text outline-none border-b border-transparent focus:border-border-bright transition-colors"
        />
      </div>

      {/* Type selector */}
      <div>
        <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block">Room Type</label>
        <div className="flex flex-wrap gap-1">
          {ALL_ROOM_TYPES.map((type) => {
            const tc = ROOM_TYPE_CONFIG[type];
            const active = room.type === type;
            return (
              <button
                key={type}
                onClick={() => updateField('type', type)}
                className="px-2 py-1 rounded text-xs font-medium transition-all"
                style={{
                  backgroundColor: active ? tc.color + '20' : 'var(--border)',
                  color: active ? tc.color : 'var(--text-muted)',
                  border: `1px solid ${active ? tc.color + '40' : 'var(--border-bright)'}`,
                }}
              >
                {tc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block">Description</label>
        <textarea
          value={room.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe this room's purpose, aesthetics, and narrative role..."
          className="w-full px-3 py-2 bg-surface-deep border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed"
          rows={3}
        />
      </div>

      {/* Encounter Design (natural language) */}
      <div>
        <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block">Encounter Design</label>
        <textarea
          value={room.encounterDesign}
          onChange={(e) => updateField('encounterDesign', e.target.value)}
          placeholder="Describe encounters, enemy behavior, wave patterns, triggers, environmental hazards..."
          className="w-full px-3 py-2 bg-surface-deep border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed"
          rows={4}
        />
      </div>

      {/* Difficulty + Pacing row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block">Difficulty</label>
          <div className="flex gap-1">
            {ALL_DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => updateField('difficulty', d)}
                className="flex-1 py-1.5 rounded text-xs font-bold transition-all"
                style={{
                  backgroundColor: room.difficulty === d ? DIFFICULTY_COLORS[d] + '25' : 'var(--border)',
                  color: room.difficulty === d ? DIFFICULTY_COLORS[d] : 'var(--text-muted)',
                  border: `1px solid ${room.difficulty === d ? DIFFICULTY_COLORS[d] + '50' : 'var(--border-bright)'}`,
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block">Pacing</label>
          <select
            value={room.pacing}
            onChange={(e) => updateField('pacing', e.target.value as PacingCurve)}
            className="w-full px-2 py-1.5 bg-surface-deep border border-border rounded-md text-xs text-text outline-none focus:border-border-bright"
          >
            {ALL_PACING.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Spawn Entries */}
      <div>
        <button
          onClick={() => setShowSpawns(!showSpawns)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {showSpawns ? <ChevronDown className="w-3 h-3 text-text-muted-hover" /> : <ChevronRight className="w-3 h-3 text-text-muted-hover" />}
          <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
            Spawn Entries
          </span>
          <span className="text-2xs text-text-muted">({room.spawnEntries.length})</span>
        </button>

        {showSpawns && (
          <div className="mt-2 space-y-1.5">
            {room.spawnEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-surface-deep rounded border border-border"
              >
                <input
                  type="text"
                  value={entry.enemyClass}
                  onChange={(e) => updateSpawn(entry.id, { enemyClass: e.target.value })}
                  className="flex-1 bg-transparent text-xs text-text outline-none min-w-0 font-mono"
                  placeholder="Enemy class"
                />
                <span className="text-2xs text-text-muted">x</span>
                <input
                  type="number"
                  value={entry.count}
                  onChange={(e) => updateSpawn(entry.id, { count: Number(e.target.value) })}
                  className="w-10 bg-transparent text-xs text-text outline-none text-center"
                  min={1}
                />
                <span className="text-2xs text-text-muted">W{entry.wave}</span>
                <input
                  type="number"
                  value={entry.wave}
                  onChange={(e) => updateSpawn(entry.id, { wave: Number(e.target.value) })}
                  className="w-8 bg-transparent text-xs text-text outline-none text-center"
                  min={1}
                />
                <button
                  onClick={() => removeSpawn(entry.id)}
                  className="text-text-muted hover:text-[#f87171] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addSpawnEntry}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-text hover:bg-border transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Spawn
            </button>
          </div>
        )}
      </div>

      {/* Linked Files */}
      <div>
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {showFiles ? <ChevronDown className="w-3 h-3 text-text-muted-hover" /> : <ChevronRight className="w-3 h-3 text-text-muted-hover" />}
          <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
            Linked Files
          </span>
          <span className="text-2xs text-text-muted">({room.linkedFiles.length})</span>
        </button>

        {showFiles && (
          <div className="mt-2 space-y-0.5">
            {room.linkedFiles.map((fp, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-text-muted font-mono px-2">
                <FileCode className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{fp}</span>
              </div>
            ))}
            {room.linkedFiles.length === 0 && (
              <p className="text-xs text-text-muted px-2">No files linked yet. Generate code to create links.</p>
            )}
          </div>
        )}
      </div>

      {/* Generate Code button */}
      <button
        onClick={() => onGenerateCode(room)}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${accentColor}24`,
          color: accentColor,
          border: `1px solid ${accentColor}38`,
        }}
      >
        <Zap className="w-3.5 h-3.5" />
        {isGenerating ? 'Generating...' : 'Generate Spawn Code'}
      </button>
    </div>
  );
}
