'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { PipelineFlow } from '../_shared';
import {
  ACCENT, RETARGET_PIPELINE_STEPS, ROOT_MOTION_PATHS,
} from './data';

export function RetargetingTab() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="space-y-4">
        <RetargetPipelineOverview />
        <RetargetPipelineStatus />
      </div>
      <RootMotionTrajectory />
    </div>
  );
}

/* ── Pipeline Overview ─────────────────────────────────────────────────────── */

function RetargetPipelineOverview() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Retarget Pipeline" color={ACCENT} />
      <div className="mt-3">
        <PipelineFlow steps={['Mixamo FBX', 'Bone Prefix Strip', 'IK Retargeter', 'Root Motion Extract', 'Commandlet']} accent={ACCENT} />
      </div>
    </BlueprintPanel>
  );
}

/* ── Pipeline Status ───────────────────────────────────────────────────────── */

function RetargetPipelineStatus() {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Retarget Pipeline Status" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Detailed status of each retarget pipeline stage. Click a step to see details.
      </p>
      <div className="space-y-1.5">
        {RETARGET_PIPELINE_STEPS.map((step, i) => {
          const isExpanded = expandedStep === step.name;
          return (
            <motion.div
              key={step.name}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.name)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover/30 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: step.color, boxShadow: `0 0 6px ${step.color}` }} />
                  <span className="text-xs font-mono font-bold text-text w-16">{step.name}</span>
                </span>
                {i < RETARGET_PIPELINE_STEPS.length - 1 && (
                  <span className="text-text-muted opacity-40 text-xs">&rarr;</span>
                )}
                <span className="ml-auto flex-shrink-0">
                  <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </span>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-2 ml-8 text-xs text-text-muted leading-relaxed border-l-2" style={{ borderColor: step.color }}>
                      {step.detail}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}

/* ── Root Motion Trajectory ────────────────────────────────────────────────── */

function RootMotionTrajectory() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Root Motion Trajectory Preview" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Top-down view of root motion paths per montage. Line thickness indicates velocity.
      </p>
      <div className="flex items-center gap-4">
        <svg width={120} height={120} viewBox="0 0 120 120" className="overflow-visible flex-shrink-0">
          <circle cx={60} cy={60} r={52} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <circle cx={60} cy={60} r={28} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <line x1={60} y1={8} x2={60} y2={112} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <line x1={8} y1={60} x2={112} y2={60} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <circle cx={60} cy={104} r={3} fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <text x={60} y={117} textAnchor="middle" className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>Origin</text>
          {ROOT_MOTION_PATHS.map((path) => {
            const pts = path.points.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <g key={path.name}>
                <polyline points={pts} fill="none" stroke={path.color} strokeWidth="3" strokeLinecap="round" opacity={0.8} />
                <circle
                  cx={path.points[path.points.length - 1].x}
                  cy={path.points[path.points.length - 1].y}
                  r={3} fill={path.color}
                />
              </g>
            );
          })}
        </svg>
        <div className="space-y-3">
          {ROOT_MOTION_PATHS.map((path) => (
            <div key={path.name} className="flex items-center gap-2">
              <span className="w-8 h-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: path.color }} />
              <span className="text-xs font-medium text-text">{path.name}</span>
              <span className="text-xs font-mono text-text-muted ml-auto">{path.distance}</span>
            </div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
