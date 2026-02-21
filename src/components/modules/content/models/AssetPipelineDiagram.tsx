'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileUp,
  Import,
  Bone,
  Box,
  Paintbrush,
  Layers,
  ShieldCheck,
  Check,
  ChevronDown,
  Play,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ACCENT_VIOLET, ACCENT_CYAN, MODULE_COLORS, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';

interface PipelineStage {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'source',
    label: 'Source File',
    description: 'Prepare FBX/glTF files from DCC tools (Blender, Maya, 3ds Max)',
    icon: FileUp,
    prompt: 'Guide me through preparing 3D source files for UE5 import. Cover FBX and glTF export settings from Blender/Maya, axis conventions, scale settings (1 unit = 1cm), and how to organize source files for a clean import pipeline.',
  },
  {
    id: 'import',
    label: 'FBX/glTF Import',
    description: 'Configure import settings: scale, axis, normals, smoothing groups',
    icon: Import,
    prompt: 'Set up the FBX/glTF import pipeline in UE5 with proper import settings: auto-detect scale, convert scene, force front axis, import normals (compute or import), combine meshes option, and skeletal mesh settings if applicable. Create a C++ import factory or import rules data asset.',
  },
  {
    id: 'mesh',
    label: 'Skeletal / Static Mesh',
    description: 'Choose mesh type, configure skeleton, set up sockets and physics asset',
    icon: Bone,
    prompt: 'Set up skeletal and static mesh configuration after import. For skeletal meshes: assign skeleton, configure physics asset with ragdoll capsules, add sockets for weapons/VFX attachment. For static meshes: configure nanite, set mobility, enable collision complexity. Create a mesh setup utility class.',
  },
  {
    id: 'material',
    label: 'Material Assignment',
    description: 'Auto-assign materials, create material instances, set up texture mapping',
    icon: Paintbrush,
    prompt: 'Create an automatic material assignment system for imported meshes. Scan material slots, create Material Instances from a master material, auto-assign textures by naming convention (Albedo, Normal, ORM/Roughness/Metallic), and set up a material library for reuse across assets.',
  },
  {
    id: 'lod',
    label: 'LOD Setup',
    description: 'Generate LOD chain with screen-size thresholds and reduction settings',
    icon: Layers,
    prompt: 'Set up LOD (Level of Detail) generation for imported meshes. Configure auto-LOD generation with 3-4 levels, set screen-size thresholds (LOD0: 1.0, LOD1: 0.5, LOD2: 0.25, LOD3: 0.1), polygon reduction percentages per level, and Nanite settings for high-poly meshes. Create a batch LOD setup utility.',
  },
  {
    id: 'collision',
    label: 'Collision',
    description: 'Generate collision shapes: simple, convex decomposition, or per-poly',
    icon: ShieldCheck,
    prompt: 'Set up collision generation for imported static meshes. Configure auto-convex collision with proper hull count and accuracy, simple box/sphere collision for basic shapes, per-poly collision for complex geometry (with performance notes), and custom collision presets. Create a collision setup utility that can batch-process assets.',
  },
];

const ACCENT = ACCENT_VIOLET;

interface AssetPipelineDiagramProps {
  completedStages: Set<string>;
  onRunPrompt: (prompt: string) => void;
  isRunning: boolean;
}

export function AssetPipelineDiagram({
  completedStages,
  onRunPrompt,
  isRunning,
}: AssetPipelineDiagramProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      <div className="flex items-center justify-between mb-8 relative z-10 border-b border-violet-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded grid place-items-center bg-violet-950/50 border border-violet-800/50 shadow-[0_0_15px_rgba(167,139,250,0.15)] relative overflow-hidden">
            <Layers className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-violet-100 font-mono tracking-widest uppercase" style={{ textShadow: '0 0 8px rgba(167,139,250,0.4)' }}>
              ASSET_PIPELINE.graph
            </span>
            <span className="text-[10px] text-violet-400/80 font-mono uppercase tracking-widest mt-0.5">
              Automated Import Sequence // {completedStages.size} OF {PIPELINE_STAGES.length}
            </span>
          </div>
        </div>
      </div>

      <div className="relative pl-4 z-10">
        {PIPELINE_STAGES.map((stage, index) => {
          const isCompleted = completedStages.has(stage.id);
          const isExpanded = expandedId === stage.id;
          const isLast = index === PIPELINE_STAGES.length - 1;
          const Icon = stage.icon;

          // Next node is completed
          const nextCompleted = !isLast ? completedStages.has(PIPELINE_STAGES[index + 1].id) : false;
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

                  {/* Flow Particles */}
                  {(pathPending || pathActive) && (
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

                {/* Node Icon/Status */}
                <div className="flex-shrink-0 relative z-10 mt-1 cursor-pointer" onClick={() => toggleExpand(stage.id)}>
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
                    ) : (
                      <Icon className="w-4 h-4 text-text-muted group-hover:text-violet-400 transition-colors" />
                    )}
                  </div>
                </div>

                {/* Node Content Card */}
                <div className="ml-6 flex-1">
                  <motion.button
                    onClick={() => toggleExpand(stage.id)}
                    className="w-full text-left bg-surface/40 hover:bg-surface/80 border border-violet-900/30 rounded-xl p-4 transition-all duration-300 shadow-lg relative overflow-hidden"
                    style={{ borderColor: isExpanded ? `${ACCENT}60` : undefined, boxShadow: isExpanded ? `0 0 20px ${ACCENT}20` : undefined }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                      <Icon className="w-16 h-16 rotate-12" style={{ color: ACCENT }} />
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-bold tracking-wide font-mono" style={{ color: isCompleted ? ACCENT_CYAN : 'var(--text)' }}>
                            {stage.label}
                          </span>
                          {isCompleted && (
                            <span className="text-[9px] px-1.5 py-[2px] rounded font-mono uppercase tracking-widest border border-cyan-500/30 text-cyan-400 bg-cyan-500/10">OK</span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted font-mono opacity-80 max-w-[85%]">{stage.description}</p>
                      </div>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-5 h-5 text-violet-500/50" />
                      </motion.div>
                    </div>

                    {/* Expanded Prompts */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="relative z-10 overflow-hidden"
                        >
                          <div className="pt-4 border-t border-violet-900/40">
                            <div className="flex items-start gap-3 bg-black/40 p-3 rounded-lg border border-violet-900/30 shadow-inner">
                              <div className="mt-0.5"><Play className="w-3.5 h-3.5 text-orange-400" /></div>
                              <p className="text-[11px] font-mono text-violet-200/70 leading-relaxed italic border-l border-violet-900/50 pl-3">
                                {stage.prompt}
                              </p>
                            </div>

                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRunPrompt(stage.prompt);
                                  setExpandedId(null);
                                }}
                                disabled={isRunning}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.5)] disabled:opacity-50 disabled:shadow-none"
                              >
                                {isCompleted ? 'Re-Execute' : 'Execute AI Task'} <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
