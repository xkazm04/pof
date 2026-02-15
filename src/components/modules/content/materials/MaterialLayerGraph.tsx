'use client';

import { useCallback, useMemo } from 'react';
import { Brush, Crown, Paintbrush, SunDim, Lock, Check, ChevronDown } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import type { LucideIcon } from 'lucide-react';

const ACCENT = '#f59e0b';

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
    <div className="w-full max-w-lg mx-auto select-none">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Brush className="w-4 h-4" style={{ color: ACCENT }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Material Hierarchy</h3>
          <p className="text-2xs text-text-muted">
            {completedCount}/3 layers — build from the master material down
          </p>
        </div>
      </div>

      {/* Root node — Master Material */}
      <div className="flex flex-col items-center">
        <NodeCard
          node={root}
          onClick={() => handleClick(root, root.locked)}
          isRunning={isRunning}
        />

        {/* Branch connector — single line down then fork */}
        <div className="flex flex-col items-center py-1.5">
          <ChevronDown
            className="w-4 h-4"
            style={{
              color: root.completed
                ? '#22c55e40'
                : `${ACCENT}40`,
            }}
          />
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

  return (
    <button
      onClick={onClick}
      disabled={isRunning && !node.isActive}
      className={`
        relative w-full rounded-xl border transition-all duration-base text-left group
        ${node.completed
          ? 'border-status-green-strong bg-status-green-subtle'
          : node.locked
            ? 'border-border bg-[#0a0a1e] opacity-60 cursor-not-allowed'
            : node.isActive
              ? 'border-status-amber-strong bg-status-amber-subtle'
              : 'border-border bg-surface-deep hover:border-status-amber-strong hover:bg-status-amber-subtle cursor-pointer'
        }
      `}
      style={{
        ...(node.isRoot && !node.completed && !node.locked
          ? { boxShadow: `0 0 20px ${ACCENT}10, 0 0 40px ${ACCENT}06` }
          : {}),
      }}
    >
      {/* Subtle glow on root */}
      {node.isRoot && !node.completed && !node.locked && !node.isActive && (
        <span
          className="absolute inset-0 rounded-xl animate-pulse pointer-events-none"
          style={{
            border: `1px solid ${ACCENT}18`,
            boxShadow: `0 0 12px ${ACCENT}08`,
          }}
        />
      )}

      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
          style={{
            background: node.completed
              ? 'linear-gradient(135deg, #22c55e18, #22c55e08)'
              : node.locked
                ? 'var(--surface)'
                : `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}08)`,
            border: node.completed
              ? '1px solid #22c55e25'
              : node.locked
                ? '1px solid var(--border)'
                : `1px solid ${ACCENT}20`,
          }}
        >
          {node.completed ? (
            <Check className="w-3.5 h-3.5 text-[#22c55e]" />
          ) : node.locked ? (
            <Lock className="w-3 h-3 text-text-muted" />
          ) : (
            <Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold ${
                node.completed
                  ? 'text-[#22c55e]'
                  : node.locked
                    ? 'text-text-muted'
                    : 'text-text'
              }`}
            >
              {node.label}
            </span>
            <span
              className={`text-2xs font-medium uppercase tracking-widest px-1.5 py-0.5 rounded ${
                node.completed
                  ? 'bg-status-green-medium text-[#22c55e80]'
                  : node.locked
                    ? 'bg-surface text-[#3a3e5a]'
                    : ''
              }`}
              style={
                !node.completed && !node.locked
                  ? { backgroundColor: `${ACCENT}12`, color: ACCENT }
                  : {}
              }
            >
              {node.subtitle}
            </span>
          </div>

          <p
            className={`text-xs mt-0.5 leading-relaxed ${
              node.locked ? 'text-[#3a3e5a]' : 'text-text-muted'
            }`}
          >
            {node.description}
          </p>

          {/* Locked hint */}
          {node.locked && (
            <p className="text-2xs mt-1.5 text-[#f59e0b80] flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Complete Master Material first
            </p>
          )}

          {/* Active indicator */}
          {node.isActive && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: ACCENT }}
              />
              <span className="text-2xs font-medium" style={{ color: ACCENT }}>
                Building...
              </span>
            </div>
          )}

          {/* Root start nudge */}
          {node.isRoot && !node.completed && !node.locked && !node.isActive && (
            <p className="text-2xs mt-1.5 font-medium" style={{ color: `${ACCENT}cc` }}>
              Start here
            </p>
          )}
        </div>

        {/* Right status */}
        <div className="flex-shrink-0 self-center">
          {node.completed ? (
            <span className="text-2xs text-[#22c55e80] font-medium">Done</span>
          ) : !node.locked && !node.isActive ? (
            <span
              className="text-2xs font-medium opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all"
              style={{ color: ACCENT }}
            >
              Build →
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
