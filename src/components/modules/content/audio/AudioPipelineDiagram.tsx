'use client';

import { useCallback, useMemo } from 'react';
import { Music, Lock, Check, ChevronUp, Volume2, Radio, Layers } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';

const ACCENT = '#f59e0b';

interface PipelineLayer {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: typeof Music;
  prompt: string;
  prerequisites: string[];
}

const LAYERS: PipelineLayer[] = [
  {
    id: 'au-3',
    label: 'Dynamic Music',
    subtitle: 'Adaptive',
    description: 'Layer-based music that transitions with game state',
    icon: Layers,
    prompt: 'Implement a dynamic music system that transitions between layers based on game state.',
    prerequisites: ['au-1', 'au-2'],
  },
  {
    id: 'au-2',
    label: 'Ambient System',
    subtitle: 'Spatial',
    description: 'Audio volumes, time-of-day variation, environmental triggers',
    icon: Radio,
    prompt: 'Build an ambient sound system with audio volumes, time-of-day variation, and environmental triggers.',
    prerequisites: ['au-1'],
  },
  {
    id: 'au-1',
    label: 'Sound Manager',
    subtitle: 'Foundation',
    description: 'Pooling, fading, priority — the base of your audio stack',
    icon: Volume2,
    prompt: 'Create an audio manager component for playing sounds with pooling, fading, and priority.',
    prerequisites: [],
  },
];

interface AudioPipelineDiagramProps {
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  activeItemId: string | null;
}

const EMPTY_PROGRESS: Record<string, boolean> = {};

export function AudioPipelineDiagram({ onRunPrompt, isRunning, activeItemId }: AudioPipelineDiagramProps) {
  const progress = useModuleStore((s) => s.checklistProgress['audio'] ?? EMPTY_PROGRESS);

  const layerStates = useMemo(() => {
    return LAYERS.map((layer) => {
      const completed = !!progress[layer.id];
      const prerequisitesMet = layer.prerequisites.every((pid) => !!progress[pid]);
      const locked = !prerequisitesMet && !completed;
      const isActive = activeItemId === layer.id;
      const isFoundation = layer.id === 'au-1';
      return { ...layer, completed, locked, isActive, isFoundation };
    });
  }, [progress, activeItemId]);

  const handleClick = useCallback(
    (layer: PipelineLayer, locked: boolean) => {
      if (locked || isRunning) return;
      onRunPrompt(layer.id, layer.prompt);
    },
    [onRunPrompt, isRunning],
  );

  const completedCount = layerStates.filter((l) => l.completed).length;

  return (
    <div className="flex flex-col items-center gap-0 w-full max-w-md mx-auto select-none">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 self-start">
        <Music className="w-4 h-4" style={{ color: ACCENT }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Audio Pipeline</h3>
          <p className="text-2xs text-text-muted">
            {completedCount}/3 layers complete — build from the foundation up
          </p>
        </div>
      </div>

      {/* Pipeline layers — top to bottom (Dynamic Music → Ambient → Sound Manager) */}
      {layerStates.map((layer, idx) => {
        const Icon = layer.icon;
        const showArrow = idx < layerStates.length - 1;
        const nextLayer = idx < layerStates.length - 1 ? layerStates[idx + 1] : null;

        return (
          <div key={layer.id} className="w-full flex flex-col items-center">
            {/* Layer Card */}
            <button
              onClick={() => handleClick(layer, layer.locked)}
              disabled={isRunning && !layer.isActive}
              className={`
                relative w-full rounded-xl border transition-all duration-base text-left group
                ${layer.completed
                  ? 'border-status-green-strong bg-status-green-subtle'
                  : layer.locked
                    ? 'border-border bg-[#0a0a1e] opacity-60 cursor-not-allowed'
                    : layer.isActive
                      ? 'border-status-amber-strong bg-status-amber-subtle'
                      : 'border-border bg-surface-deep hover:border-status-amber-strong hover:bg-status-amber-subtle cursor-pointer'
                }
              `}
              style={{
                ...(layer.isFoundation && !layer.completed && !layer.locked
                  ? { boxShadow: `0 0 20px ${ACCENT}10, 0 0 40px ${ACCENT}06` }
                  : {}),
              }}
            >
              {/* Pulse ring on foundation layer */}
              {layer.isFoundation && !layer.completed && !layer.locked && !layer.isActive && (
                <span
                  className="absolute inset-0 rounded-xl animate-pulse pointer-events-none"
                  style={{
                    border: `1px solid ${ACCENT}18`,
                    boxShadow: `0 0 12px ${ACCENT}08`,
                  }}
                />
              )}

              <div className="flex items-start gap-3 px-4 py-3.5">
                {/* Icon column */}
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                  style={{
                    background: layer.completed
                      ? 'linear-gradient(135deg, #22c55e18, #22c55e08)'
                      : layer.locked
                        ? 'var(--surface)'
                        : `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}08)`,
                    border: layer.completed
                      ? '1px solid #22c55e25'
                      : layer.locked
                        ? '1px solid var(--border)'
                        : `1px solid ${ACCENT}20`,
                  }}
                >
                  {layer.completed ? (
                    <Check className="w-4 h-4 text-[#22c55e]" />
                  ) : layer.locked ? (
                    <Lock className="w-3.5 h-3.5 text-text-muted" />
                  ) : (
                    <Icon className="w-4 h-4" style={{ color: ACCENT }} />
                  )}
                </div>

                {/* Text column */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        layer.completed
                          ? 'text-[#22c55e]'
                          : layer.locked
                            ? 'text-text-muted'
                            : 'text-text'
                      }`}
                    >
                      {layer.label}
                    </span>
                    <span
                      className={`text-2xs font-medium uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        layer.completed
                          ? 'bg-status-green-medium text-[#22c55e80]'
                          : layer.locked
                            ? 'bg-surface text-[#3a3e5a]'
                            : `text-[${ACCENT}90]`
                      }`}
                      style={
                        !layer.completed && !layer.locked
                          ? { backgroundColor: `${ACCENT}12`, color: `${ACCENT}` }
                          : {}
                      }
                    >
                      {layer.subtitle}
                    </span>
                  </div>

                  <p
                    className={`text-xs mt-0.5 leading-relaxed ${
                      layer.locked ? 'text-[#3a3e5a]' : 'text-text-muted'
                    }`}
                  >
                    {layer.description}
                  </p>

                  {/* Locked prerequisite hint */}
                  {layer.locked && (
                    <p className="text-2xs mt-1.5 text-[#f59e0b80] flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      Complete {layer.prerequisites.length === 1 ? 'Sound Manager' : 'Sound Manager & Ambient System'} first
                    </p>
                  )}

                  {/* Active indicator */}
                  {layer.isActive && (
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

                  {/* Start here nudge on foundation */}
                  {layer.isFoundation && !layer.completed && !layer.locked && !layer.isActive && (
                    <p className="text-2xs mt-1.5 font-medium" style={{ color: `${ACCENT}cc` }}>
                      Start here
                    </p>
                  )}
                </div>

                {/* Right arrow / status */}
                <div className="flex-shrink-0 self-center">
                  {layer.completed ? (
                    <span className="text-2xs text-[#22c55e80] font-medium">Done</span>
                  ) : !layer.locked && !layer.isActive ? (
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

            {/* Upward arrow connector */}
            {showArrow && (
              <div className="flex flex-col items-center py-1">
                <ChevronUp
                  className="w-4 h-4"
                  style={{
                    color: nextLayer?.completed
                      ? '#22c55e40'
                      : nextLayer && !nextLayer.locked
                        ? `${ACCENT}40`
                        : 'var(--border)',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
