'use client';

import { useMemo, useState, useCallback } from 'react';
import { Swords, Shield, Zap, ChevronDown, ChevronRight, ExternalLink, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, LoadingSpinner } from './_shared';

const ACCENT = MODULE_COLORS.core;

/* ── Lane definitions ──────────────────────────────────────────────────── */

interface LaneConfig {
  id: string;
  label: string;
  icon: typeof Swords;
  color: string;
  featureNames: string[];
}

const LANES: LaneConfig[] = [
  {
    id: 'offensive',
    label: 'Offensive',
    icon: Swords,
    color: '#ef4444', // Red for offensive
    featureNames: ['Melee attack ability', 'Combo system', 'Dodge ability (GAS)'],
  },
  {
    id: 'pipeline',
    label: 'Damage Pipeline',
    icon: Zap,
    color: '#f59e0b', // Amber for pipeline
    featureNames: ['Hit detection', 'GAS damage application', 'Death flow'],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: Shield,
    color: '#3b82f6', // Blue for feedback
    featureNames: ['Hit reaction system', 'Combat feedback'],
  },
];

/* ── Flow arrows between features ──────────────────────────────────────── */

interface FlowArrow {
  from: string;
  to: string;
  label?: string;
}

const FLOW_ARROWS: FlowArrow[] = [
  { from: 'Melee attack ability', to: 'Combo system', label: 'chains' },
  { from: 'Melee attack ability', to: 'Hit detection', label: 'triggers' },
  { from: 'Combo system', to: 'Hit detection', label: 'per section' },
  { from: 'Hit detection', to: 'GAS damage application', label: 'on hit' },
  { from: 'GAS damage application', to: 'Hit reaction system', label: 'applies' },
  { from: 'GAS damage application', to: 'Combat feedback', label: 'triggers' },
  { from: 'GAS damage application', to: 'Death flow', label: 'HP <= 0' },
];

/* ── Component ─────────────────────────────────────────────────────────── */

interface CombatActionMapProps {
  moduleId: SubModuleId;
}

export function CombatActionMap({ moduleId }: CombatActionMapProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build a lookup: featureName → FeatureRow (review data)
  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  // Summary stats
  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0, missing = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
      else if (status === 'missing') missing++;
    }
    return { total, implemented, partial, missing };
  }, [defs, featureMap]);

  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <TabHeader icon={Swords} title="Combat Action Map" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* Pipeline overview - compact flow */}
      <SurfaceCard level={2} className="p-3.5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
        <SectionLabel icon={Zap} label="Execution Flow" />
        <div className="mt-3 relative z-10">
          <PipelineFlow steps={['Attack', 'Combo', 'Hit Detect', 'Damage', 'Reaction', 'Feedback']} accent={ACCENT} />
        </div>
      </SurfaceCard>

      {/* Lanes */}
      <div className="space-y-4">
        <SectionLabel icon={Swords} label="Combat Lanes" />
        <div className="space-y-4">
          {LANES.map((lane, idx) => (
            <motion.div
              key={lane.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
            >
              <LaneSection
                lane={lane}
                featureMap={featureMap}
                defs={defs}
                expanded={expanded}
                onToggle={toggleExpand}
                arrows={FLOW_ARROWS}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Combo detail - special treatment */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <ComboChainDiagram status={featureMap.get('Combo system')?.status ?? 'unknown'} />
      </motion.div>
    </div>
  );
}

/* ── Lane section ──────────────────────────────────────────────────────── */

function LaneSection({
  lane,
  featureMap,
  defs,
  expanded,
  onToggle,
  arrows,
}: {
  lane: LaneConfig;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
  arrows: FlowArrow[];
}) {
  const LaneIcon = lane.icon;

  return (
    <div className="relative">
      {/* Lane background styling */}
      <div className="absolute inset-0 rounded-xl opacity-5 pointer-events-none" style={{ backgroundColor: lane.color }} />
      <div className="absolute -left-1 top-0 bottom-0 w-1 rounded-l opacity-50" style={{ backgroundColor: lane.color }} />

      <div className="pl-3 py-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1 rounded bg-surface/50 border border-border/50">
            <LaneIcon className="w-3.5 h-3.5" style={{ color: lane.color, filter: `drop-shadow(0 0 3px ${lane.color}80)` }} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-text">
            {lane.label}
          </span>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          {lane.featureNames.map((name, i) => {
            const row = featureMap.get(name);
            const def = defs.find((d) => d.featureName === name);
            const status: FeatureStatus = row?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            const isExpanded = expanded === name;
            const outgoing = arrows.filter((a) => a.from === name);

            return (
              <div key={name} className="flex items-center gap-3">
                <SurfaceCard level={3} className="min-w-[200px] max-w-[260px] group relative overflow-hidden shadow-lg border-border/60">
                  <div className="absolute top-0 left-0 w-full h-[1px] opacity-30" style={{ background: `linear-gradient(90deg, transparent, ${lane.color}, transparent)` }} />

                  <button
                    onClick={() => onToggle(name)}
                    className="w-full text-left px-3.5 py-2.5 transition-colors hover:bg-surface-hover/50 focus:outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="flex-shrink-0"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted transition-colors group-hover:text-text" />
                      </motion.div>
                      <span className="text-xs font-semibold text-text truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 ml-5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot, boxShadow: `0 0 6px ${sc.dot}80` }} />
                      <span className="text-2xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
                      {row?.qualityScore != null && (
                        <span className="text-2xs font-mono text-emerald-400 ml-auto bg-emerald-400/10 px-1 rounded-sm border border-emerald-400/20">
                          Q{row.qualityScore}
                        </span>
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ opacity: { duration: 0.2 }, height: { duration: 0.3, type: "spring", bounce: 0 } }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-2.5 border-t border-border/40 bg-surface/30">
                          <p className="text-2xs text-text-muted leading-relaxed mt-2.5">
                            {def?.description ?? row?.description ?? 'No description'}
                          </p>
                          {row?.filePaths && row.filePaths.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {row.filePaths.slice(0, 3).map((fp) => (
                                <span key={fp} className="flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {fp.split('/').pop()}
                                </span>
                              ))}
                            </div>
                          )}
                          {row?.nextSteps && (
                            <p className="text-2xs border-l-2 pl-2 mt-2" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}>
                              <span className="font-semibold opacity-70 mr-1">Next:</span>{row.nextSteps}
                            </p>
                          )}
                          {def?.dependsOn && def.dependsOn.length > 0 && (
                            <div className="text-2xs text-text-muted mt-1.5 bg-surface-deep px-2 py-1 rounded inline-block">
                              <span className="font-semibold">Deps:</span> {def.dependsOn.map((d) => d.replace(/.*::/, '')).join(', ')}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SurfaceCard>

                {/* Animated Arrow to next in lane */}
                {i < lane.featureNames.length - 1 && (
                  <div className="flex flex-col items-center gap-1 relative w-8">
                    <div className="h-[2px] w-full bg-border relative overflow-hidden rounded-full">
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-current"
                        style={{ color: lane.color }}
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>
                    {outgoing.length > 0 && (
                      <span className="text-[10px] text-text-muted font-mono leading-none whitespace-nowrap absolute -bottom-4">
                        {outgoing[0]?.label}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Combo chain diagram ───────────────────────────────────────────────── */

function ComboChainDiagram({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];

  const sections = [
    { name: 'Attack 1', timing: '0.0s - 0.4s', window: 'Combo Window', delay: 0 },
    { name: 'Attack 2', timing: '0.0s - 0.5s', window: 'Combo Window', delay: 0.2 },
    { name: 'Attack 3', timing: '0.0s - 0.6s', window: 'Finisher', delay: 0.4 },
  ];

  return (
    <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -z-10 group-hover:bg-red-500/10 transition-colors duration-700" />

      <div className="flex items-center gap-2.5 mb-4 border-b border-border/40 pb-2">
        <div className="bg-red-500/10 p-1.5 rounded-md border border-red-500/20">
          <Play className="w-4 h-4 text-red-400" />
        </div>
        <span className="text-sm font-bold text-text tracking-wide">Combo Chain Analysis</span>
        <span className="text-2xs px-2 py-0.5 rounded-md ml-auto border border-border/50 shadow-sm" style={{ backgroundColor: sc.bg, color: sc.dot }}>
          {sc.label}
        </span>
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-2 custom-scrollbar">
        {sections.map((s, i) => (
          <div key={s.name} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s.delay, duration: 0.4 }}
              className="flex flex-col items-center px-4 py-3 rounded-xl border relative overflow-hidden min-w-[140px]"
              style={{
                borderColor: i === 2 ? '#ef444450' : `${ACCENT}40`,
                backgroundColor: i === 2 ? '#ef444410' : `${ACCENT}08`,
                boxShadow: i === 2 ? '0 0 15px rgba(239, 68, 68, 0.1)' : 'none',
              }}
            >
              {i === 2 && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-tr from-transparent via-red-500/5 to-transparent pointer-events-none"
                  animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
                  transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
                />
              )}

              <span className="text-xs font-bold text-text z-10">{s.name}</span>
              <span className="text-2xs text-text-muted font-mono mt-0.5 z-10">{s.timing}</span>

              <div className="mt-2 text-2xs px-2 py-0.5 rounded-md font-medium z-10"
                style={{
                  backgroundColor: i === 2 ? '#ef444420' : `${MODULE_COLORS.core}20`,
                  color: i === 2 ? '#ef4444' : MODULE_COLORS.core,
                  border: `1px solid ${i === 2 ? '#ef444440' : `${MODULE_COLORS.core}40`}`
                }}
              >
                {s.window}
              </div>

              {/* Notify windows */}
              <div className="mt-2.5 w-full h-2 rounded-full bg-surface-deep overflow-hidden flex relative shadow-inner z-10">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ delay: s.delay + 0.3, duration: 0.5 }}
                  className="h-full bg-blue-500/60 shadow-[0_0_5px_rgba(59,130,246,0.6)]" title="Combo Input Window"
                />
                <motion.div
                  initial={{ width: 0 }} animate={{ width: '30%' }} transition={{ delay: s.delay + 0.6, duration: 0.3 }}
                  className="h-full bg-red-500/60 shadow-[0_0_5px_rgba(239,68,68,0.6)]" title="Hit Detection"
                />
              </div>
            </motion.div>

            {i < sections.length - 1 && (
              <div className="flex flex-col items-center px-3 relative">
                <div className="w-6 h-[2px] bg-border relative overflow-hidden rounded-full">
                  <motion.div
                    className="absolute inset-y-0 left-0 w-full bg-text-muted/50"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <span className="text-[10px] text-text-muted font-mono mt-1 uppercase tracking-wider">input</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border/40 text-xs font-medium text-text-muted">
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded bg-blue-500/60 shadow-[0_0_5px_rgba(59,130,246,0.4)]" /> Combo Window
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded bg-red-500/60 shadow-[0_0_5px_rgba(239,68,68,0.4)]" /> Hit Detection
        </span>
      </div>
    </SurfaceCard>
  );
}
