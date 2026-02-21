'use client';

import { useCallback, useMemo } from 'react';
import { Brush, Crown, Paintbrush, SunDim, Lock, Check, ChevronDown } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import type { LucideIcon } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

interface MaterialNode {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
  /** Tier in the hierarchy: 0 = root, 1 = surface switches, 2 = instances */
  tier: number;
  dependencies: string[];
}

/**
 * Material hierarchy:
 * - mt-3: Master Material (root) — the base shader with switches
 * - mt-1: Dynamic Materials (tier 1) — material parameter collections & runtime changes
 * - mt-2: Post-Process (tier 2) — post-process materials layered on top
 *
 * The UE5 workflow: Master Material → Material Instances (dynamic) → Post-Process chain
 */
const NODES: MaterialNode[] = [
  {
    id: 'mt-3',
    label: 'Master Material',
    subtitle: 'Root Shader',
    description: 'Surface switches for Metal, Cloth, Skin',
    icon: Crown,
    prompt: 'Design a master material with switches for different surface types (metal, cloth, skin, etc.).',
    tier: 0,
    dependencies: [],
  },
  {
    id: 'mt-1',
    label: 'Dynamic Materials',
    subtitle: 'Instances',
    description: 'Runtime parameter collections & material instances',
    icon: Paintbrush,
    prompt: 'Create a dynamic material system for runtime color/texture changes with material parameter collections.',
    tier: 1,
    dependencies: ['mt-3'],
  },
  {
    id: 'mt-2',
    label: 'Post-Process',
    subtitle: 'Effects Chain',
    description: 'Bloom, color grading, custom post-process effects',
    icon: SunDim,
    prompt: 'Set up post-process effects chain with bloom, color grading, and custom effects.',
    tier: 1,
    dependencies: ['mt-3'],
  },
];

interface MaterialLayerGraphProps {
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  activeItemId: string | null;
}

const EMPTY_PROGRESS: Record<string, boolean> = {};

export function MaterialLayerGraph({ onRunPrompt, isRunning, activeItemId }: MaterialLayerGraphProps) {
  const progress = useModuleStore((s) => s.checklistProgress['materials'] ?? EMPTY_PROGRESS);

  const nodeStates = useMemo(() => {
    return NODES.map((node) => {
      const completed = !!progress[node.id];
      const prerequisitesMet = node.dependencies.every((d) => !!progress[d]);
      const locked = !prerequisitesMet && !completed;
      const isActive = activeItemId === node.id;
      const isRoot = node.tier === 0;
      return { ...node, completed, locked, isActive, isRoot };
    });
  }, [progress, activeItemId]);

  const root = nodeStates[0];
  const children = nodeStates.slice(1);

  const handleClick = useCallback(
    (node: MaterialNode, locked: boolean) => {
      if (locked || isRunning) return;
      onRunPrompt(node.id, node.prompt);
    },
    [onRunPrompt, isRunning],
  );

  const completedCount = nodeStates.filter((n) => n.completed).length;

  return (
    <div className="w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] p-6 relative overflow-y-auto select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-10 left-10 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-emerald-600/5 blur-[80px] rounded-full pointer-events-none" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTY3LCAxMzksIDI1MCwgMC4wNSkiLz48L3N2Zz4=')" }} />
      </div>

      <div className="max-w-xl mx-auto relative z-10 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-violet-900/30 pb-4">
          <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <Brush className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100">Shader Tree Compiler</h3>
            <p className="text-[10px] text-violet-400/60 uppercase tracking-wider mt-0.5">
              GRAPH_STATUS: {completedCount}/3 NODES_COMPILED
            </p>
          </div>
        </div>

        {/* Graph Area */}
        <div className="flex flex-col items-center">
          {/* Root node — Master Material */}
          <div className="w-full max-w-sm">
            <NodeCard
              node={root}
              onClick={() => handleClick(root, root.locked)}
              isRunning={isRunning}
            />
          </div>

          {/* Branch connector — single line down then fork */}
          <div className="flex flex-col items-center w-full my-1">
            {/* Vertical line from root */}
            <div className="w-px h-8 bg-violet-900/50 relative">
              <div className="absolute top-0 left-[-1px] w-[3px] h-2 bg-violet-500 animate-[bounce_2s_infinite]" />
            </div>

            {/* Horizontal fork line */}
            <div className="w-[calc(50%+1rem)] h-px bg-violet-900/50 relative" />

            {/* Vertical drops to children */}
            <div className="flex w-[calc(50%+1rem)] justify-between">
              <div className="w-px h-8 bg-violet-900/50 relative">
                <div className="absolute bottom-0 left-[-3px] w-[7px] h-[7px] border-2 border-[#03030a] rounded-full bg-violet-500" />
              </div>
              <div className="w-px h-8 bg-violet-900/50 relative">
                <div className="absolute bottom-0 left-[-3px] w-[7px] h-[7px] border-2 border-[#03030a] rounded-full bg-violet-500" />
              </div>
            </div>
          </div>

          {/* Child nodes — side by side */}
          <div className="flex items-start gap-4 w-full">
            {children.map((child) => (
              <div key={child.id} className="flex-1">
                <NodeCard
                  node={child}
                  onClick={() => handleClick(child, child.locked)}
                  isRunning={isRunning}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Node Card ──

interface NodeState extends MaterialNode {
  completed: boolean;
  locked: boolean;
  isActive: boolean;
  isRoot: boolean;
}

interface NodeCardProps {
  node: NodeState;
  onClick: () => void;
  isRunning: boolean;
}

function NodeCard({ node, onClick, isRunning }: NodeCardProps) {
  const Icon = node.icon;
  const isCompleted = node.completed;
  const isLocked = node.locked;
  const isActive = node.isActive;

  return (
    <button
      onClick={onClick}
      disabled={isRunning && !isActive}
      className={`
        relative w-full rounded-xl text-left transition-all duration-300 group overflow-hidden
        ${isCompleted
          ? 'bg-[#03030a] border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.05)]'
          : isLocked
            ? 'bg-black/40 border border-violet-900/20 opacity-50 cursor-not-allowed grayscale'
            : isActive
              ? 'bg-[#03030a] border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2),inset_0_0_15px_rgba(245,158,11,0.1)]'
              : 'bg-black/60 border border-violet-900/40 hover:border-violet-500/50 hover:bg-violet-900/10 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]'
        }
      `}
    >
      {/* Glossy Header Bar */}
      <div className={`
        h-1.5 w-full
        ${isCompleted ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
          : isLocked ? 'bg-violet-900/30'
            : isActive ? 'bg-gradient-to-r from-amber-600 to-amber-400 animate-pulse'
              : 'bg-gradient-to-r from-violet-600/50 to-violet-400/50 group-hover:from-violet-500 group-hover:to-violet-400 transition-colors'}
      `} />

      <div className="flex items-start gap-4 p-4 relative z-10">
        {/* Icon Container */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${isCompleted ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : isLocked ? 'bg-surface border border-border text-text-muted'
              : isActive ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-violet-500/10 border border-violet-500/30 text-violet-400 group-hover:scale-110 transition-transform'}
        `}>
          {isCompleted ? <Check className="w-5 h-5" /> : isLocked ? <Lock className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-widest truncate ${isCompleted ? 'text-emerald-400' : isLocked ? 'text-text-muted' : isActive ? 'text-amber-400' : 'text-violet-100'}`}>
              {node.label}
            </span>
            <span className={`text-[8px] font-mono tracking-widest px-1.5 py-0.5 rounded border uppercase ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80' :
                isLocked ? 'bg-transparent border-transparent text-transparent' :
                  'bg-violet-900/30 border-violet-900/50 text-violet-300'}
            `}>
              {node.subtitle}
            </span>
          </div>

          <p className="text-[10px] text-violet-200/60 leading-relaxed font-mono tracking-tight line-clamp-2">
            {node.description}
          </p>

          {/* Status Sub-text */}
          <div className="mt-3">
            {isLocked && (
              <div className="flex items-center gap-1 text-[9px] text-amber-500/60 uppercase tracking-widest font-bold">
                <Lock className="w-3 h-3" /> DEP_MISSING: mt-3
              </div>
            )}
            {isActive && (
              <div className="flex items-center gap-2 text-[9px] text-amber-400 uppercase tracking-widest font-bold animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                COMPILING_SHADER...
              </div>
            )}
            {!isLocked && !isActive && !isCompleted && (
              <div className="flex items-center gap-1 text-[9px] text-violet-400/50 uppercase tracking-widest font-bold group-hover:text-violet-400 transition-colors">
                <span>AWAITING_EXECUTION</span>
              </div>
            )}
            {isCompleted && (
              <div className="flex items-center gap-1 text-[9px] text-emerald-500/60 uppercase tracking-widest font-bold">
                <span>COMPILED_SUCCESSFULLY</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
