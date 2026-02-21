'use client';

import { useCallback, useMemo } from 'react';
import { Music, Lock, Check, ChevronUp, Volume2, Radio, Layers, Loader2, Send } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

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
    <div className="flex flex-col items-center gap-0 w-full max-w-md mx-auto select-none p-6 bg-[#03030a] rounded-2xl border border-blue-900/30 shadow-[inset_0_0_80px_rgba(59,130,246,0.05)] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8 self-start relative z-10 w-full border-b border-blue-900/40 pb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[inset_0_0_15px_rgba(59,130,246,0.1)]">
          <Music className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase text-blue-100 dark:text-blue-100 shadow-[0_0_10px_rgba(59,130,246,0.5)]">Audio Subsystem Architecture</h3>
          <p className="text-[10px] text-blue-400/60 uppercase tracking-widest mt-1">
            {completedCount}/3 MODULES COMPILED — ESTABLISH CORE INFRASTRUCTURE
          </p>
        </div>
      </div>

      {/* Pipeline layers — top to bottom (Dynamic Music → Ambient → Sound Manager) */}
      <div className="w-full relative z-10">
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
                  relative w-full rounded-2xl border transition-all duration-500 text-left group overflow-hidden
                  ${layer.completed
                    ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.1)_inset]'
                    : layer.locked
                      ? 'border-blue-900/20 bg-black/40 opacity-60 cursor-not-allowed'
                      : layer.isActive
                        ? 'border-amber-500/50 bg-amber-950/30 shadow-[0_0_30px_rgba(245,158,11,0.15)_inset]'
                        : 'border-blue-500/30 bg-blue-950/20 hover:border-blue-400/60 hover:bg-blue-900/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] cursor-pointer'
                  }
                `}
                style={{
                  ...(layer.isFoundation && !layer.completed && !layer.locked
                    ? { boxShadow: '0 0 30px rgba(59,130,246,0.15), inset 0 0 20px rgba(59,130,246,0.1)' }
                    : {}),
                }}
              >
                {/* Active scanline effect */}
                {!layer.locked && !layer.completed && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/5 to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-1000 ease-linear" />
                )}

                {/* Pulse ring on foundation layer */}
                {layer.isFoundation && !layer.completed && !layer.locked && !layer.isActive && (
                  <span
                    className="absolute inset-0 rounded-2xl animate-pulse pointer-events-none border border-blue-400/40 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                  />
                )}

                <div className="flex items-start gap-4 px-5 py-4 relative z-10">
                  {/* Icon column */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg relative"
                    style={{
                      background: layer.completed
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))'
                        : layer.locked
                          ? 'rgba(0,0,0,0.5)'
                          : 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))',
                      border: layer.completed
                        ? '1px solid rgba(16,185,129,0.3)'
                        : layer.locked
                          ? '1px solid rgba(30,58,138,0.3)'
                          : '1px solid rgba(59,130,246,0.3)',
                    }}
                  >
                    {layer.completed ? (
                      <Check className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    ) : layer.locked ? (
                      <Lock className="w-5 h-5 text-blue-800/60" />
                    ) : (
                      <>
                        <Icon className="w-6 h-6 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        {layer.isFoundation && !layer.isActive && (
                          <div className="absolute inset-0 border border-blue-400/50 rounded-xl animate-ping opacity-20" />
                        )}
                      </>
                    )}
                  </div>

                  {/* Text column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-widest ${layer.completed
                            ? 'text-emerald-400'
                            : layer.locked
                              ? 'text-blue-800/60'
                              : 'text-blue-200'
                            }`}
                        >
                          {layer.label}
                        </span>

                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${layer.completed
                            ? 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20'
                            : layer.locked
                              ? 'bg-black/50 text-blue-900/50 border-blue-900/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}
                        >
                          {layer.subtitle}
                        </span>
                      </div>
                    </div>

                    <p
                      className={`text-[10px] font-mono leading-relaxed mt-1 uppercase tracking-wider ${layer.locked ? 'text-blue-900/40' : 'text-blue-300/60'
                        }`}
                    >
                      {layer.description}
                    </p>

                    {/* Locked prerequisite hint */}
                    {layer.locked && (
                      <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-950/30 border border-orange-900/30 w-fit">
                        <Lock className="w-3 h-3 text-orange-500/70" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500/70">
                          REQ: {layer.prerequisites.length === 1 ? 'SOUND_MANAGER' : 'SOUND_MANAGER + AMBIENT_SYS'}
                        </span>
                      </div>
                    )}

                    {/* Active indicator */}
                    {layer.isActive && (
                      <div className="flex items-center gap-2 mt-3 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg w-fit">
                        <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
                          COMPILING_MODULE...
                        </span>
                      </div>
                    )}

                    {/* Start here nudge on foundation */}
                    {layer.isFoundation && !layer.completed && !layer.locked && !layer.isActive && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">
                          INITIALIZE_HERE
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right arrow / status */}
                  <div className="flex-shrink-0 self-center pl-2 border-l border-blue-900/20 ml-2 h-full flex items-center">
                    {layer.completed ? (
                      <div className="flex flex-col items-center gap-1">
                        <Check className="w-4 h-4 text-emerald-500/50" />
                        <span className="text-[9px] text-emerald-500/50 font-bold uppercase tracking-widest">OK</span>
                      </div>
                    ) : !layer.locked && !layer.isActive ? (
                      <div className="flex flex-col items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Send className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">RUN</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>

              {/* Upward arrow connector */}
              {showArrow && (
                <div className="flex flex-col items-center py-2 relative">
                  {/* Glowing connection line */}
                  <div
                    className="absolute top-0 bottom-0 w-px"
                    style={{
                      background: nextLayer?.completed
                        ? 'linear-gradient(to bottom, rgba(16,185,129,0.5), rgba(16,185,129,0.1))'
                        : nextLayer && !nextLayer.locked
                          ? 'linear-gradient(to bottom, rgba(59,130,246,0.5), rgba(59,130,246,0.1))'
                          : 'rgba(30,58,138,0.2)',
                    }}
                  />
                  <ChevronUp
                    className="w-5 h-5 relative z-10 bg-[#03030a]"
                    style={{
                      color: nextLayer?.completed
                        ? 'rgba(16,185,129,0.8)'
                        : nextLayer && !nextLayer.locked
                          ? 'rgba(59,130,246,0.8)'
                          : 'rgba(30,58,138,0.5)',
                      filter: nextLayer?.completed || (nextLayer && !nextLayer.locked) ? 'drop-shadow(0 0 5px currentColor)' : 'none',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
