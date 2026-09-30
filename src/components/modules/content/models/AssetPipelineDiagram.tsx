'use client';

import { useId, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Import,
  Bone,
  Paintbrush,
  Layers,
  ShieldCheck,
  ListChecks,
  Check,
  ChevronDown,
  Play,
  ArrowRight,
  Loader2,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ACCENT_VIOLET, ACCENT_CYAN, STATUS_ERROR } from '@/lib/chart-colors';
import { DURATION, EASE_OUT, motionSafe } from '@/lib/motion';
import { MeterBar } from '@/components/ui/MeterBar';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { useModuleStore } from '@/stores/moduleStore';
import { resolveDiagramNodes, deriveDiagramNodeStates } from '@/lib/checklist-diagram';

interface PipelineStageSpec {
  id: string;
  subtitle: string;
  icon: LucideIcon;
  prerequisites: string[];
}

/**
 * The diagram's shape: which REAL `models` checklist items it draws, in import
 * order. Labels, descriptions and prompts come from `module-registry`
 * (`mod-1`…`mod-6`) via `@/lib/checklist-diagram`, never from a copy here.
 *
 * The stages used to be six local ids (`source` … `collision`) stored under
 * `pipeline-<id>` keys with their own prompt strings: `resolveProgressKey` knows
 * none of those keys, `POST /api/checklist/complete` refuses them, so no stage
 * could ever complete — and a run here never ticked the Roadmap item it mirrored.
 */
export const MODELS_PIPELINE_SPEC: readonly PipelineStageSpec[] = [
  { id: 'mod-1', subtitle: 'Import', icon: Import, prerequisites: [] },
  { id: 'mod-4', subtitle: 'Mesh / Nanite', icon: Bone, prerequisites: ['mod-1'] },
  { id: 'mod-5', subtitle: 'Materials & UVs', icon: Paintbrush, prerequisites: ['mod-4'] },
  { id: 'mod-2', subtitle: 'LOD', icon: Layers, prerequisites: ['mod-5'] },
  { id: 'mod-3', subtitle: 'Collision', icon: ShieldCheck, prerequisites: ['mod-2'] },
  { id: 'mod-6', subtitle: 'Validation', icon: ListChecks, prerequisites: ['mod-3'] },
];

const STAGES = resolveDiagramNodes('models', MODELS_PIPELINE_SPEC);

const ACCENT = ACCENT_VIOLET;
const EMPTY_PROGRESS: Record<string, boolean> = {};

interface AssetPipelineDiagramProps {
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  activeItemId: string | null;
}

export function AssetPipelineDiagram({
  onRunPrompt,
  isRunning,
  activeItemId,
}: AssetPipelineDiagramProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();
  const panelIdBase = useId();
  const progress = useModuleStore((s) => s.checklistProgress['models'] ?? EMPTY_PROGRESS);
  const { nodes: stages, completedCount: doneCount } = useMemo(
    () => deriveDiagramNodeStates(STAGES, progress, activeItemId),
    [progress, activeItemId],
  );

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-[#03030a] rounded-2xl border border-violet-900/30 relative overflow-hidden shadow-[inset_0_0_100px_rgba(167,139,250,0.03)]">
      {/* Schematic Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: `linear-gradient(${ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT} 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="mb-8 relative z-10 border-b border-violet-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="p-2 rounded grid place-items-center bg-violet-950/50 border border-violet-800/50 shadow-[0_0_15px_rgba(167,139,250,0.15)] relative overflow-hidden">
            <Layers className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-violet-100 font-mono tracking-widest uppercase" style={{ textShadow: '0 0 8px rgba(167,139,250,0.4)' }}>
              ASSET_PIPELINE.graph
            </h3>
            <p className="text-xs text-violet-300 font-mono uppercase mt-0.5">
              Automated Import Sequence // {doneCount} of {stages.length} stages complete
            </p>
          </div>
        </div>
        <MeterBar
          value={doneCount}
          max={stages.length}
          color={ACCENT_CYAN}
          height={4}
          className="mt-3"
          ariaLabel="Asset pipeline progress"
          valueText={`${doneCount} of ${stages.length} stages complete`}
        />
      </div>

      <div className="relative pl-4 z-10">
        {stages.map((stage, index) => {
          const isCompleted = stage.completed;
          const isExpanded = expandedId === stage.id;
          const isLast = index === stages.length - 1;
          const Icon = stage.icon;
          const panelId = `${panelIdBase}-${stage.id}-panel`;

          // Next node is completed
          const nextCompleted = !isLast ? stages[index + 1].completed : false;
          // Determine path state
          const pathActive = isCompleted && nextCompleted;
          const pathPending = isCompleted && !nextCompleted && !isLast;

          return (
            <div key={stage.id} className="relative">
              {/* Connector line (Animated Flow) */}
              {!isLast && (
                <div className="absolute left-[17px] top-[40px] w-[2px] h-[calc(100%-10px)] bg-violet-950/50 rounded-full overflow-hidden">
                  {/* Base Line */}
                  <div className="absolute inset-0 bg-gradient-to-b from-violet-500/20 to-transparent" />

                  {/* Animated Active Data Flow */}
                  {pathActive && (
                    <div className="absolute inset-0 w-full" style={{ background: `linear-gradient(to bottom, ${ACCENT_CYAN} 0%, transparent 100%)`, opacity: 0.6 }} />
                  )}

                  {/* Flow Particles — an infinite loop, so it is suppressed entirely
                      under prefers-reduced-motion (the static gradient above still
                      conveys the same "flow" state). */}
                  {(pathPending || pathActive) && !prefersReduced && (
                    <motion.div
                      className="absolute w-full h-8 bg-gradient-to-b from-transparent via-cyan-400 to-transparent top-0"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }}
                      animate={{ top: ['-20%', '120%'] }}
                      transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
                    />
                  )}
                </div>
              )}

              {/* Stage node */}
              <div className="relative flex items-start group mb-6">

                {/* Node Icon/Status — decorative; the status it encodes is also
                    carried by the "Complete" badge inside the accessible trigger. */}
                <div aria-hidden="true" className="flex-shrink-0 relative z-10 mt-1">
                  <div className="absolute inset-0 bg-violet-500/20 blur-md rounded-full scale-150 transition-opacity" style={{ opacity: isCompleted ? 1 : 0 }} />
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center border-2 border-surface-deep shadow-lg relative transition-all duration-300"
                    style={{
                      backgroundColor: isCompleted ? `${ACCENT_CYAN}20` : 'var(--surface)',
                      borderColor: isCompleted ? ACCENT_CYAN : 'var(--border)',
                      boxShadow: isCompleted ? `0 0 15px ${ACCENT_CYAN}40, inset 0 0 10px ${ACCENT_CYAN}20` : 'none',
                    }}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,1)]" />
                    ) : stage.locked ? (
                      <Lock className="w-4 h-4 text-text-muted" />
                    ) : (
                      <Icon className="w-4 h-4 text-text-muted group-hover:text-violet-400 transition-colors" />
                    )}
                  </div>
                </div>

                {/* Node Content Card — a disclosure: the header row is the trigger,
                    the panel (with its own Run button) is a sibling, so no button
                    is ever nested inside another. */}
                <div className="ml-6 flex-1">
                  <motion.div
                    className="bg-surface/40 border border-violet-900/30 rounded-xl transition-colors duration-300 shadow-lg relative overflow-hidden"
                    style={{ borderColor: isExpanded ? `${ACCENT}60` : undefined, boxShadow: isExpanded ? `0 0 20px ${ACCENT}20` : undefined }}
                    whileHover={prefersReduced ? undefined : { x: 2 }}
                  >
                    <div aria-hidden="true" className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                      <Icon className="w-16 h-16 rotate-12" style={{ color: ACCENT }} />
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(stage.id)}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      className="w-full text-left p-4 rounded-xl hover:bg-surface/60 transition-colors duration-300 focus-ring-inset"
                    >
                      <div className="flex items-center justify-between gap-3 relative z-10">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-bold tracking-wide font-mono" style={{ color: isCompleted ? ACCENT_CYAN : 'var(--text)' }}>
                              {stage.label}
                            </span>
                            {isCompleted && (
                              <span className="text-xs px-1.5 py-[2px] rounded font-mono uppercase border border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
                                Complete
                              </span>
                            )}
                            <span className="text-xs px-1.5 py-[2px] rounded font-mono uppercase border border-violet-900/50 text-violet-300">
                              {stage.subtitle}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted font-mono max-w-[85%]">{stage.description}</p>
                          {stage.missing ? (
                            <p className="mt-2 text-xs font-mono uppercase font-bold" style={{ color: STATUS_ERROR }}>
                              REGISTRY_DRIFT: {stage.id} — not runnable
                            </p>
                          ) : stage.locked ? (
                            <p className="mt-2 flex items-center gap-1 text-xs font-mono text-text-muted">
                              <Lock className="w-3 h-3" aria-hidden="true" /> Requires {stage.unmetDeps.join(', ')}
                            </p>
                          ) : stage.isActive ? (
                            <p role="status" className="mt-2 flex items-center gap-1 text-xs font-mono text-cyan-300">
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Running now
                            </p>
                          ) : null}
                        </div>
                        <motion.div
                          aria-hidden="true"
                          className="flex-shrink-0"
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={motionSafe({ duration: DURATION.fast }, prefersReduced)}
                        >
                          <ChevronDown className="w-5 h-5 text-violet-400" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Expanded Prompt */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          id={panelId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={motionSafe({ duration: DURATION.base, ease: EASE_OUT }, prefersReduced)}
                          className="relative z-10 overflow-hidden"
                        >
                          <div className="mx-4 mb-4 pt-4 border-t border-violet-900/40">
                            <MicroLabel mono uppercase as="div" className="mb-2">
                              Prompt sent to Claude
                            </MicroLabel>
                            <div className="flex items-start gap-3 bg-black/40 p-3 rounded-lg border border-violet-900/30 shadow-inner">
                              <Play aria-hidden="true" className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs font-mono text-violet-100/90 leading-relaxed border-l border-violet-900/50 pl-3">
                                {stage.prompt}
                              </p>
                            </div>

                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  // A drift stage has no registry prompt: an empty run would look like work.
                                  if (isRunning || stage.locked || !stage.prompt) return;
                                  onRunPrompt(stage.id, stage.prompt);
                                  setExpandedId(null);
                                }}
                                disabled={isRunning || stage.locked}
                                aria-busy={stage.isActive}
                                title={
                                  isRunning
                                    ? 'A task is already running — wait for it to finish'
                                    : stage.locked
                                      ? stage.missing
                                        ? 'This stage has no checklist item behind it'
                                        : `Complete ${stage.unmetDeps.join(', ')} first`
                                      : undefined
                                }
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.5)] focus-ring disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                              >
                                {isRunning ? (
                                  <>
                                    Task running… <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                  </>
                                ) : (
                                  <>
                                    {isCompleted ? `Re-run ${stage.subtitle}` : `Run ${stage.subtitle}`}
                                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
