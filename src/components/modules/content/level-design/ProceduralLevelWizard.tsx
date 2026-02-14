'use client';

import { useState, useCallback } from 'react';
import {
  Zap, Grid3X3, Waves, Hexagon, Mountain,
  Castle, Sword, Trophy, MapPin, Package, Gem,
} from 'lucide-react';

// ── Types ──

export type GenAlgorithm = 'bsp' | 'wfc' | 'cellular' | 'perlin';
export type LevelType = 'dungeon' | 'openworld' | 'arena';

export interface SizeParams {
  gridWidth: number;
  gridHeight: number;
  roomCountMin: number;
  roomCountMax: number;
  corridorWidth: number;
}

export interface GameplayConstraints {
  spawnPoints: boolean;
  lootPlacement: boolean;
  bossRoom: boolean;
  secretRooms: boolean;
  safeZones: boolean;
}

export interface ProceduralLevelConfig {
  algorithm: GenAlgorithm;
  levelType: LevelType;
  size: SizeParams;
  constraints: GameplayConstraints;
  seed: string;
}

// ── Static Data ──

interface AlgorithmDef {
  id: GenAlgorithm;
  label: string;
  icon: typeof Grid3X3;
  color: string;
  description: string;
  bestFor: string;
}

const ALGORITHMS: AlgorithmDef[] = [
  {
    id: 'bsp',
    label: 'BSP Tree',
    icon: Grid3X3,
    color: '#38bdf8',
    description: 'Binary Space Partitioning — recursively divides space into rooms connected by corridors.',
    bestFor: 'Dungeon rooms + corridors, roguelike layouts',
  },
  {
    id: 'wfc',
    label: 'Wave Function Collapse',
    icon: Hexagon,
    color: '#a78bfa',
    description: 'Constraint-propagation algorithm that places tiles based on adjacency rules.',
    bestFor: 'Tile-based levels, town layouts, pattern-driven generation',
  },
  {
    id: 'cellular',
    label: 'Cellular Automata',
    icon: Waves,
    color: '#22c55e',
    description: 'Cave-like structures from iterative cell birth/death rules (similar to Conway\'s Game of Life).',
    bestFor: 'Organic caves, natural caverns, irregular shapes',
  },
  {
    id: 'perlin',
    label: 'Perlin Noise',
    icon: Mountain,
    color: '#f97316',
    description: 'Continuous noise function for smooth height/density maps with octave layering.',
    bestFor: 'Open world terrain, elevation maps, biome placement',
  },
];

interface LevelTypeDef {
  id: LevelType;
  label: string;
  icon: typeof Castle;
  color: string;
  description: string;
}

const LEVEL_TYPES: LevelTypeDef[] = [
  {
    id: 'dungeon',
    label: 'Dungeon',
    icon: Castle,
    color: '#f59e0b',
    description: 'Rooms connected by corridors, doors, keys, and locked areas',
  },
  {
    id: 'openworld',
    label: 'Open World',
    icon: Mountain,
    color: '#22c55e',
    description: 'Large terrain with biomes, POIs, roads, and seamless zones',
  },
  {
    id: 'arena',
    label: 'Arena',
    icon: Sword,
    color: '#ef4444',
    description: 'Single combat space with cover, spawn waves, and phase transitions',
  },
];

interface ConstraintDef {
  key: keyof GameplayConstraints;
  label: string;
  icon: typeof MapPin;
  description: string;
}

const CONSTRAINTS: ConstraintDef[] = [
  { key: 'spawnPoints', label: 'Spawn Points', icon: MapPin, description: 'Player start + enemy spawn locations' },
  { key: 'lootPlacement', label: 'Loot Placement', icon: Package, description: 'Chests, item drops, loot rooms' },
  { key: 'bossRoom', label: 'Boss Room', icon: Trophy, description: 'Dedicated boss encounter area' },
  { key: 'secretRooms', label: 'Secret Rooms', icon: Gem, description: 'Hidden rooms with bonus loot' },
  { key: 'safeZones', label: 'Safe Zones', icon: Castle, description: 'Rest areas, shops, save points' },
];

const DEFAULT_SIZE: Record<LevelType, SizeParams> = {
  dungeon: { gridWidth: 64, gridHeight: 64, roomCountMin: 8, roomCountMax: 15, corridorWidth: 3 },
  openworld: { gridWidth: 256, gridHeight: 256, roomCountMin: 20, roomCountMax: 40, corridorWidth: 5 },
  arena: { gridWidth: 32, gridHeight: 32, roomCountMin: 1, roomCountMax: 3, corridorWidth: 4 },
};

// ── Component ──

const ACCENT = '#f59e0b';

interface ProceduralLevelWizardProps {
  onGenerate: (config: ProceduralLevelConfig) => void;
  isGenerating: boolean;
}

export function ProceduralLevelWizard({ onGenerate, isGenerating }: ProceduralLevelWizardProps) {
  const [algorithm, setAlgorithm] = useState<GenAlgorithm>('bsp');
  const [levelType, setLevelType] = useState<LevelType>('dungeon');
  const [size, setSize] = useState<SizeParams>(DEFAULT_SIZE.dungeon);
  const [constraints, setConstraints] = useState<GameplayConstraints>({
    spawnPoints: true,
    lootPlacement: true,
    bossRoom: true,
    secretRooms: false,
    safeZones: false,
  });
  const [seed, setSeed] = useState('');

  const selectLevelType = useCallback((lt: LevelType) => {
    setLevelType(lt);
    setSize(DEFAULT_SIZE[lt]);
  }, []);

  const toggleConstraint = useCallback((key: keyof GameplayConstraints) => {
    setConstraints((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateSize = useCallback((key: keyof SizeParams, value: number) => {
    setSize((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(() => {
    onGenerate({ algorithm, levelType, size, constraints, seed });
  }, [algorithm, levelType, size, constraints, seed, onGenerate]);

  const algDef = ALGORITHMS.find((a) => a.id === algorithm)!;
  const ltDef = LEVEL_TYPES.find((lt) => lt.id === levelType)!;

  return (
    <div className="w-full space-y-5 p-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Grid3X3 className="w-4 h-4" style={{ color: ACCENT }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Procedural Level Wizard</h3>
          <p className="text-2xs text-text-muted">Configure algorithm, size, and constraints for code generation</p>
        </div>
      </div>

      {/* ─── Algorithm ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">Generation Algorithm</h4>
        <div className="grid grid-cols-2 gap-2">
          {ALGORITHMS.map((alg) => {
            const isActive = algorithm === alg.id;
            const Icon = alg.icon;
            return (
              <button
                key={alg.id}
                onClick={() => setAlgorithm(alg.id)}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  backgroundColor: isActive ? `${alg.color}10` : 'var(--surface-deep)',
                  border: `1px solid ${isActive ? `${alg.color}50` : 'var(--border)'}`,
                }}
              >
                <Icon
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: isActive ? alg.color : '#4a4e6a' }}
                />
                <div className="min-w-0">
                  <span
                    className="text-xs font-semibold block"
                    style={{ color: isActive ? alg.color : 'var(--text-muted)' }}
                  >
                    {alg.label}
                  </span>
                  <span className="text-2xs text-[#4a4e6a] block mt-0.5 leading-relaxed">{alg.description}</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-2xs px-1 py-1 rounded bg-surface border border-border text-text-muted">
          Best for: {algDef.bestFor}
        </p>
      </div>

      {/* ─── Level Type ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">Level Type</h4>
        <div className="grid grid-cols-3 gap-2">
          {LEVEL_TYPES.map((lt) => {
            const isActive = levelType === lt.id;
            const Icon = lt.icon;
            return (
              <button
                key={lt.id}
                onClick={() => selectLevelType(lt.id)}
                className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl text-center transition-all"
                style={{
                  backgroundColor: isActive ? `${lt.color}10` : 'var(--surface-deep)',
                  border: `1px solid ${isActive ? `${lt.color}50` : 'var(--border)'}`,
                }}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: isActive ? lt.color : '#4a4e6a' }}
                />
                <span
                  className="text-2xs font-semibold"
                  style={{ color: isActive ? lt.color : 'var(--text-muted)' }}
                >
                  {lt.label}
                </span>
                <span className="text-2xs text-[#4a4e6a] leading-relaxed">{lt.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Size Parameters ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">
          Size Parameters
          <span className="ml-1.5 font-normal normal-case text-[#4a4e6a]">(for {ltDef.label})</span>
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <SizeSlider label="Grid Width" value={size.gridWidth} min={16} max={512} step={16} onChange={(v) => updateSize('gridWidth', v)} color={ACCENT} />
          <SizeSlider label="Grid Height" value={size.gridHeight} min={16} max={512} step={16} onChange={(v) => updateSize('gridHeight', v)} color={ACCENT} />
          <SizeSlider label="Min Rooms" value={size.roomCountMin} min={1} max={50} step={1} onChange={(v) => updateSize('roomCountMin', v)} color={ACCENT} />
          <SizeSlider label="Max Rooms" value={size.roomCountMax} min={1} max={100} step={1} onChange={(v) => updateSize('roomCountMax', v)} color={ACCENT} />
          <SizeSlider label="Corridor Width" value={size.corridorWidth} min={1} max={10} step={1} onChange={(v) => updateSize('corridorWidth', v)} color={ACCENT} />
          {/* Seed */}
          <div className="px-3 py-2 rounded-lg bg-surface-deep border border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs font-medium text-[#c0c4e0]">Seed</span>
              <span className="text-2xs text-[#4a4e6a]">optional</span>
            </div>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Random"
              className="w-full px-2 py-1 bg-surface border border-border rounded text-2xs text-text placeholder-[#3a3e5a] outline-none focus:border-border-bright transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* ─── Gameplay Constraints ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">Gameplay Constraints</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {CONSTRAINTS.map((c) => {
            const isActive = constraints[c.key];
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => toggleConstraint(c.key)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all"
                style={{
                  backgroundColor: isActive ? `${ACCENT}10` : 'var(--surface-deep)',
                  border: `1px solid ${isActive ? `${ACCENT}40` : 'var(--border)'}`,
                }}
              >
                <span
                  className="flex-shrink-0 w-2.5 h-2.5 rounded-full border transition-all"
                  style={{
                    borderColor: isActive ? ACCENT : 'var(--border-bright)',
                    backgroundColor: isActive ? ACCENT : 'transparent',
                  }}
                />
                <Icon
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: isActive ? ACCENT : '#4a4e6a' }}
                />
                <div className="min-w-0">
                  <span
                    className="text-2xs font-semibold block"
                    style={{ color: isActive ? ACCENT : 'var(--text-muted)' }}
                  >
                    {c.label}
                  </span>
                  <span className="text-2xs text-[#4a4e6a] block truncate">{c.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Generate ─── */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${ACCENT}15`,
          color: ACCENT,
          border: `1px solid ${ACCENT}30`,
        }}
      >
        <Zap className="w-3.5 h-3.5" />
        {isGenerating
          ? 'Generating...'
          : `Generate ${ltDef.label} — ${algDef.label}`
        }
      </button>
    </div>
  );
}

// ── Size Slider ──

function SizeSlider({
  label, value, min, max, step, onChange, color,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color: string;
}) {
  return (
    <div className="px-3 py-2 rounded-lg bg-surface-deep border border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs font-medium text-[#c0c4e0]">{label}</span>
        <span className="text-2xs font-mono text-[#9b9ec0]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, var(--border) ${((value - min) / (max - min)) * 100}%, var(--border) 100%)`,
        }}
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-2xs text-[#3a3e5a]">{min}</span>
        <span className="text-2xs text-[#3a3e5a]">{max}</span>
      </div>
    </div>
  );
}
