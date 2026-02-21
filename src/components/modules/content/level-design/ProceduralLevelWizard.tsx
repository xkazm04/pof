'use client';

import { useState, useCallback } from 'react';
import {
  Zap, Grid3X3, Waves, Hexagon, Mountain,
  Castle, Sword, Trophy, MapPin, Package, Gem, Loader2
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_IMPROVED, ACCENT_VIOLET, STATUS_SUCCESS, ACCENT_ORANGE } from '@/lib/chart-colors';
import { motion } from 'framer-motion';

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
    color: STATUS_IMPROVED,
    description: 'Binary Space Partitioning — recursively divides space into rooms connected by corridors.',
    bestFor: 'Dungeon rooms + corridors, roguelike layouts',
  },
  {
    id: 'wfc',
    label: 'Wave Function Collapse',
    icon: Hexagon,
    color: ACCENT_VIOLET,
    description: 'Constraint-propagation algorithm that places tiles based on adjacency rules.',
    bestFor: 'Tile-based levels, town layouts, pattern-driven generation',
  },
  {
    id: 'cellular',
    label: 'Cellular Automata',
    icon: Waves,
    color: STATUS_SUCCESS,
    description: 'Cave-like structures from iterative cell birth/death rules (similar to Conway\'s Game of Life).',
    bestFor: 'Organic caves, natural caverns, irregular shapes',
  },
  {
    id: 'perlin',
    label: 'Perlin Noise',
    icon: Mountain,
    color: ACCENT_ORANGE,
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
    color: MODULE_COLORS.content,
    description: 'Rooms connected by corridors, doors, keys, and locked areas',
  },
  {
    id: 'openworld',
    label: 'Open World',
    icon: Mountain,
    color: STATUS_SUCCESS,
    description: 'Large terrain with biomes, POIs, roads, and seamless zones',
  },
  {
    id: 'arena',
    label: 'Arena',
    icon: Sword,
    color: MODULE_COLORS.evaluator,
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
    <div className="w-full h-full space-y-6 p-6 overflow-y-auto bg-[#03030a] rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] text-violet-100 font-mono relative">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 blur-[100px] rounded-full pointer-events-none" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 relative z-10 border-b border-violet-900/30 pb-4">
        <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
          <Grid3X3 className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100">Procedural Matrix Configurator</h3>
          <p className="text-[10px] text-violet-400/60 uppercase tracking-wider mt-0.5">Initialize algorithmic spatial generation parameters</p>
        </div>
      </div>

      {/* ─── Algorithm ─── */}
      <div className="space-y-3 relative z-10">
        <h4 className="flex items-center gap-2 text-[10px] font-bold text-violet-400 uppercase tracking-widest">
          <Zap className="w-3 h-3" /> Core Subroutine
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {ALGORITHMS.map((alg) => {
            const isActive = algorithm === alg.id;
            const Icon = alg.icon;
            return (
              <button
                key={alg.id}
                onClick={() => setAlgorithm(alg.id)}
                className="relative flex items-start gap-4 p-4 rounded-xl text-left transition-all group overflow-hidden"
                style={{
                  backgroundColor: isActive ? `${alg.color}15` : 'rgba(10,10,25,0.6)',
                  border: `1px solid ${isActive ? `${alg.color}60` : 'rgba(139,92,246,0.15)'}`,
                  boxShadow: isActive ? `0 0 20px ${alg.color}20, inset 0 0 20px ${alg.color}10` : 'none',
                }}
              >
                {/* Tech background element */}
                <div className="absolute right-0 top-0 w-32 h-32 opacity-[0.03] transition-transform duration-700 group-hover:scale-150 group-hover:rotate-12 pointer-events-none">
                  <Icon className="w-full h-full" style={{ color: isActive ? alg.color : '#fff' }} />
                </div>

                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10 transition-colors"
                  style={{ backgroundColor: isActive ? `${alg.color}20` : 'rgba(139,92,246,0.1)' }}>
                  <Icon className="w-5 h-5" style={{ color: isActive ? alg.color : 'rgba(139,92,246,0.6)' }} />
                </div>
                <div className="min-w-0 relative z-10">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider block mb-1 transition-colors"
                    style={{ color: isActive ? alg.color : 'rgba(200,200,240,0.6)' }}
                  >
                    {alg.label}
                  </span>
                  <span className="text-[9px] text-violet-300/60 block leading-relaxed">{alg.description}</span>
                </div>
              </button>
            );
          })}
        </div>
        <motion.p
          key={algorithm}
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="text-[10px] px-3 py-2 rounded-lg bg-black/40 border border-violet-900/30 text-violet-300/80 font-mono"
        >
          <span className="text-violet-500 font-bold mr-2">RECOMMENDED_FOR:</span>
          {algDef.bestFor.toUpperCase()}
        </motion.p>
      </div>

      {/* ─── Level Type ─── */}
      <div className="space-y-3 relative z-10 bg-black/40 p-4 rounded-xl border border-violet-900/30 shadow-inner">
        <h4 className="flex items-center gap-2 text-[10px] font-bold text-violet-400 uppercase tracking-widest">
          <Hexagon className="w-3 h-3" /> Output Topology
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {LEVEL_TYPES.map((lt) => {
            const isActive = levelType === lt.id;
            const Icon = lt.icon;
            return (
              <button
                key={lt.id}
                onClick={() => selectLevelType(lt.id)}
                className="relative flex flex-col items-center gap-3 p-4 rounded-xl text-center transition-all group overflow-hidden"
                style={{
                  backgroundColor: isActive ? `${lt.color}15` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? `${lt.color}60` : 'rgba(139,92,246,0.1)'}`,
                  boxShadow: isActive ? `0 0 20px ${lt.color}15` : 'none',
                }}
              >
                <div className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-500"
                  style={{
                    borderColor: isActive ? lt.color : 'rgba(139,92,246,0.2)',
                    transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-inner"
                    style={{ backgroundColor: isActive ? `${lt.color}20` : 'transparent', transform: isActive ? 'rotate(-180deg)' : 'rotate(0deg)' }}>
                    <Icon className="w-5 h-5" style={{ color: isActive ? lt.color : 'rgba(139,92,246,0.6)' }} />
                  </div>
                </div>
                <div>
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider block mb-1 transition-colors"
                    style={{ color: isActive ? lt.color : 'rgba(200,200,240,0.6)' }}
                  >
                    {lt.label}
                  </span>
                  <span className="text-[8px] text-violet-400/50 uppercase tracking-widest leading-tight block px-2">
                    {lt.description.split(' ').slice(0, 3).join(' ')}...
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Size Parameters ─── */}
      <div className="space-y-3 relative z-10">
        <h4 className="flex items-center gap-2 text-[10px] font-bold text-violet-400 uppercase tracking-widest border-b border-violet-900/30 pb-2">
          <Grid3X3 className="w-3 h-3" /> Size Parameters
          <span className="ml-1 text-violet-500/50">[{ltDef.label}]</span>
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <SizeSlider label="Grid Width" value={size.gridWidth} min={16} max={512} step={16} onChange={(v) => updateSize('gridWidth', v)} color={MODULE_COLORS.content} />
          <SizeSlider label="Grid Height" value={size.gridHeight} min={16} max={512} step={16} onChange={(v) => updateSize('gridHeight', v)} color={MODULE_COLORS.content} />
          <SizeSlider label="Min Rooms" value={size.roomCountMin} min={1} max={50} step={1} onChange={(v) => updateSize('roomCountMin', v)} color={MODULE_COLORS.content} />
          <SizeSlider label="Max Rooms" value={size.roomCountMax} min={1} max={100} step={1} onChange={(v) => updateSize('roomCountMax', v)} color={MODULE_COLORS.content} />
          <SizeSlider label="Corridor Width" value={size.corridorWidth} min={1} max={10} step={1} onChange={(v) => updateSize('corridorWidth', v)} color={MODULE_COLORS.content} />
          {/* Seed Input */}
          <div className="px-4 py-3 rounded-xl bg-black/60 border border-violet-900/40 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/5 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-violet-300 uppercase tracking-widest">WORLD SEED</span>
              <span className="text-[8px] text-violet-500 font-mono">OPTIONAL</span>
            </div>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="0xRND..."
              className="w-full px-3 py-1.5 bg-black/40 border border-violet-900/50 rounded-md text-[10px] text-violet-200 placeholder-violet-500/40 outline-none focus:border-violet-500 transition-colors font-mono tracking-wider shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* ─── Gameplay Constraints ─── */}
      <div className="space-y-3 relative z-10">
        <h4 className="flex items-center gap-2 text-[10px] font-bold text-violet-400 uppercase tracking-widest border-b border-violet-900/30 pb-2">
          <Castle className="w-3 h-3" /> Environmental Logic
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {CONSTRAINTS.map((c) => {
            const isActive = constraints[c.key];
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => toggleConstraint(c.key)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border group relative overflow-hidden"
                style={{
                  backgroundColor: isActive ? `${MODULE_COLORS.content}15` : 'rgba(0,0,0,0.4)',
                  borderColor: isActive ? `${MODULE_COLORS.content}50` : 'rgba(139,92,246,0.15)',
                }}
              >
                {/* Active Glow */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/10 to-transparent animate-pulse pointer-events-none" />
                )}

                <div
                  className="w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 relative z-10"
                  style={{
                    borderColor: isActive ? MODULE_COLORS.content : 'rgba(139,92,246,0.3)',
                    backgroundColor: isActive ? MODULE_COLORS.content : 'transparent',
                    boxShadow: isActive ? `0 0 10px ${MODULE_COLORS.content}80` : 'none',
                  }}
                >
                  {isActive && <div className="w-1.5 h-1.5 bg-white rounded-sm shadow-sm" />}
                </div>
                <Icon
                  className="w-4 h-4 flex-shrink-0 relative z-10 transition-colors"
                  style={{ color: isActive ? MODULE_COLORS.content : 'rgba(139,92,246,0.5)' }}
                />
                <div className="min-w-0 relative z-10 flex-1">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider block truncate"
                    style={{ color: isActive ? MODULE_COLORS.content : 'rgba(200,200,240,0.7)' }}
                  >
                    {c.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Generate ─── */}
      <div className="pt-4 relative z-10">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 group outline-none"
          style={{
            backgroundColor: `${MODULE_COLORS.content}20`,
            color: MODULE_COLORS.content,
            border: `1px solid ${MODULE_COLORS.content}60`,
            boxShadow: `0 0 30px ${MODULE_COLORS.content}30, inset 0 0 15px ${MODULE_COLORS.content}10`,
          }}
        >
          {/* Edge Glints */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent opacity-50" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-30" />

          {/* Shine effect */}
          <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 group-hover:left-[200%] transition-all duration-1000 ease-in-out pointer-events-none" />

          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Compiling Matrix...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all" />
              Execute {algDef.label} Routine
            </>
          )}
        </button>
      </div>
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
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="px-4 py-3 rounded-xl bg-black/60 border border-violet-900/40 relative overflow-hidden group">
      {/* Animated scanline effect on hover */}
      <div className="absolute inset-x-0 inset-y-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-1000 pointer-events-none" />

      <div className="flex items-center justify-between mb-2 relative z-10">
        <span className="text-[9px] font-bold text-violet-300 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-900/30" style={{ color }}>{value}</span>
      </div>

      <div className="relative h-1.5 rounded-full bg-violet-900/30 overflow-hidden mt-1 backdrop-blur-sm shadow-inner z-10">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(currentColor,0.5)] bg-gradient-to-r from-violet-600 to-violet-400"
          style={{ width: `${percent}%`, color }}
        />
      </div>

      <div className="flex justify-between mt-1.5 opacity-50 relative z-10">
        <span className="text-[8px] font-mono text-violet-200">{min}</span>
        <span className="text-[8px] font-mono text-violet-200">{max}</span>
      </div>
    </div>
  );
}
