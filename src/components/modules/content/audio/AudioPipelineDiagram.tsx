'use client';

import { useCallback, useMemo } from 'react';
import { Music, Lock, Check, ChevronUp, Volume2, Radio, Layers, Loader2, Send } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, withOpacity, OPACITY_10, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.content;

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
    <SurfaceCard className="flex flex-col items-center gap-0 w-full max-w-md mx-auto select-none p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 self-start w-full border-b border-border pb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
        >
          <Music className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text">Audio Subsystem Architecture</h3>
          <p className="text-xs text-text-muted mt-1">
            {completedCount}/3 modules complete — establish core infrastructure
          </p>
        </div>
      </div>

      {/* Pipeline layers — top to bottom (Dynamic Music → Ambient → Sound Manager) */}
      <div className="w-full">
        {layerStates.map((layer, idx) => {
          const Icon = layer.icon;
          const showArrow = idx < layerStates.length - 1;
          const nextLayer = idx < layerStates.length - 1 ? layerStates[idx + 1] : null;
          const statusColor = layer.completed ? STATUS_SUCCESS : ACCENT;

          return (
            <div key={layer.id} className="w-full flex flex-col items-center">
              {/* Layer Card */}
              <button
                onClick={() => handleClick(layer, layer.locked)}
                disabled={isRunning && !layer.isActive}
                className={`relative w-full rounded-2xl border transition-all duration-300 text-left group overflow-hidden ${
                  layer.locked
                    ? 'border-border bg-surface-deep opacity-60 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-surface-hover'
                }`}
                style={
                  layer.locked
                    ? undefined
                    : {
                        borderColor: withOpacity(statusColor, OPACITY_30),
                        backgroundColor: withOpacity(statusColor, OPACITY_10),
                      }
                }
              >
                <div className="flex items-start gap-4 px-5 py-4">
                  {/* Icon column */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                    style={
                      layer.locked
                        ? { backgroundColor: 'var(--surface-deep)', border: '1px solid var(--border)' }
                        : { backgroundColor: withOpacity(statusColor, OPACITY_10), border: `1px solid ${withOpacity(statusColor, OPACITY_30)}` }
                    }
                  >
                    {layer.completed ? (
                      <Check className="w-6 h-6" style={{ color: STATUS_SUCCESS }} />
                    ) : layer.locked ? (
                      <Lock className="w-5 h-5 text-text-muted" />
                    ) : (
                      <Icon className="w-6 h-6" style={{ color: ACCENT }} />
                    )}
                  </div>

                  {/* Text column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: layer.locked ? 'var(--text-muted)' : statusColor }}
                        >
                          {layer.label}
                        </span>
                        <span
                          className="text-2xs font-medium px-2 py-0.5 rounded border"
                          style={
                            layer.locked
                              ? { color: 'var(--text-muted)', borderColor: 'var(--border)' }
                              : { color: statusColor, backgroundColor: withOpacity(statusColor, OPACITY_10), borderColor: withOpacity(statusColor, OPACITY_20) }
                          }
                        >
                          {layer.subtitle}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed mt-1 text-text-muted">
                      {layer.description}
                    </p>

                    {/* Locked prerequisite hint */}
                    {layer.locked && (
                      <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-deep border border-border w-fit">
                        <Lock className="w-3 h-3 text-text-muted" />
                        <span className="text-2xs font-medium text-text-muted">
                          Requires: {layer.prerequisites.length === 1 ? 'Sound Manager' : 'Sound Manager + Ambient System'}
                        </span>
                      </div>
                    )}

                    {/* Active indicator */}
                    {layer.isActive && (
                      <div
                        className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg w-fit border"
                        style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), borderColor: withOpacity(ACCENT, OPACITY_20) }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: ACCENT }} />
                        <span className="text-2xs font-medium" style={{ color: ACCENT }}>
                          Compiling module…
                        </span>
                      </div>
                    )}

                    {/* Start here nudge on foundation */}
                    {layer.isFoundation && !layer.completed && !layer.locked && !layer.isActive && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: ACCENT }}></span>
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: ACCENT }}></span>
                        </span>
                        <span className="text-2xs font-medium" style={{ color: ACCENT }}>
                          Start here
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right arrow / status */}
                  <div className="flex-shrink-0 self-center pl-2 border-l border-border ml-2 h-full flex items-center">
                    {layer.completed ? (
                      <div className="flex flex-col items-center gap-1">
                        <Check className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
                        <span className="text-2xs font-medium" style={{ color: STATUS_SUCCESS }}>OK</span>
                      </div>
                    ) : !layer.locked && !layer.isActive ? (
                      <div className="flex flex-col items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: ACCENT }} />
                        <span className="text-2xs font-medium" style={{ color: ACCENT }}>Run</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>

              {/* Upward arrow connector */}
              {showArrow && (
                <div className="flex flex-col items-center py-2 relative">
                  <div className="absolute top-0 bottom-0 w-px bg-border" />
                  <ChevronUp
                    className="w-5 h-5 relative z-10 bg-surface"
                    style={{ color: nextLayer?.completed ? STATUS_SUCCESS : nextLayer && !nextLayer.locked ? ACCENT : 'var(--text-muted)' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
