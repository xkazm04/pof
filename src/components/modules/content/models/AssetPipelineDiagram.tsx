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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

const ACCENT = '#a78bfa';

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
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Box className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Asset Import Pipeline
        </h3>
      </div>

      <div className="relative">
        {PIPELINE_STAGES.map((stage, index) => {
          const isCompleted = completedStages.has(stage.id);
          const isExpanded = expandedId === stage.id;
          const isLast = index === PIPELINE_STAGES.length - 1;
          const Icon = stage.icon;

          return (
            <div key={stage.id} className="relative">
              {/* Connector line */}
              {!isLast && (
                <div
                  className="absolute left-[15px] top-[32px] w-px"
                  style={{
                    height: isExpanded ? 'calc(100% - 16px)' : 'calc(100% - 8px)',
                    backgroundColor: isCompleted ? `${ACCENT}50` : 'var(--border)',
                  }}
                />
              )}

              {/* Stage node */}
              <motion.button
                onClick={() => toggleExpand(stage.id)}
                className="relative z-10 w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors hover:bg-surface group"
                whileTap={{ scale: 0.99 }}
              >
                {/* Node circle */}
                <div
                  className="relative flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center border transition-colors"
                  style={{
                    borderColor: isCompleted ? ACCENT : '#2a2a4a',
                    backgroundColor: isCompleted ? `${ACCENT}15` : 'var(--surface-deep)',
                  }}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-[#4a4e6a] group-hover:text-text-muted-hover transition-colors" />
                  )}
                </div>

                {/* Label + step number */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium transition-colors ${
                        isCompleted
                          ? 'text-[#a0a4c0]'
                          : 'text-text group-hover:text-text'
                      }`}
                    >
                      {stage.label}
                    </span>
                    {isCompleted && (
                      <span className="text-2xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          color: ACCENT,
                          backgroundColor: `${ACCENT}12`,
                          border: `1px solid ${ACCENT}20`,
                        }}
                      >
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#4a4e6a] truncate">
                    {stage.description}
                  </p>
                </div>

                {/* Expand arrow */}
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-[#4a4e6a]" />
                </motion.div>
              </motion.button>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="ml-[39px] mb-2 pl-3 border-l border-border">
                      <p className="text-xs text-text-muted leading-relaxed mb-2.5">
                        {stage.description}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunPrompt(stage.prompt);
                          setExpandedId(null);
                        }}
                        disabled={isRunning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                        style={{
                          backgroundColor: `${ACCENT}15`,
                          color: ACCENT,
                          border: `1px solid ${ACCENT}30`,
                        }}
                      >
                        <Play className="w-3 h-3" />
                        {isCompleted ? 'Run Again' : 'Run Step'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Progress summary */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-[#4a4e6a]">
          {completedStages.size} / {PIPELINE_STAGES.length} stages complete
        </span>
        <div className="flex gap-1">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.id}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: completedStages.has(stage.id) ? ACCENT : 'var(--border)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
