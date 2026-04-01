'use client';

import { useState, useCallback } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Activity, Wrench, Terminal } from 'lucide-react';
import { OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { SectionHeader, BlueprintPanel } from '../_design';
import { STATUS_COLORS, FeatureCard, LoadingSpinner } from '../_shared';
import { CircularGauge, CopyButton } from './CircularGauge';
import { SystemHealthMatrix, FrameTimeWaterfall } from './SystemHealthSection';
import { MemorySection } from './MemorySection';
import { ConsoleSection } from './ConsoleSection';
import { NetworkSection } from './NetworkSection';
import { GCTimelineSection } from './GCTimelineSection';
import { DrawCallSection } from './DrawCallSection';
import { StatDashboardSection } from './StatDashboardSection';
import { CrashPredictionSection } from './CrashPredictionSection';
import { RegressionSection } from './RegressionSection';
import {
  ACCENT, INITIAL_BUDGETS, DEBUG_COMMANDS, OPTIMIZATIONS,
  EFFORT_COLORS, IMPACT_COLORS, FEATURE_NAMES,
} from './data';
import type { SubModuleId } from '@/types/modules';
import type { FeatureStatus } from '@/types/feature-matrix';

interface DebugDashboardProps { moduleId: SubModuleId }

export function DebugDashboard({ moduleId }: DebugDashboardProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [budgets, setBudgets] = useState(INITIAL_BUDGETS);

  useSuspendableEffect(() => {
    const id = setInterval(() => {
      setBudgets(prev => prev.map(b => {
        const variance = (Math.random() - 0.5) * (b.current * 0.05);
        let next = b.current + variance;
        if (next < b.target * 0.1) next = b.target * 0.1;
        if (next > b.target * 1.5) next = b.target * 1.5;
        return { ...b, current: next };
      }));
    }, 800);
    return () => clearInterval(id);
  }, []);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature(prev => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <BlueprintPanel color={ACCENT} className="p-2 grid place-items-center">
          <Activity className="w-5 h-5" style={{ color: ACCENT }} />
        </BlueprintPanel>
        <div className="flex flex-col">
          <span className="text-base font-bold font-mono tracking-widest uppercase" style={{ color: `${ACCENT}ee`, textShadow: `0 0 8px ${ACCENT}40` }}>
            CORE_TELEMETRY.exe
          </span>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE STREAM ACTIVE
          </span>
        </div>
      </div>

      {/* Budget gauges */}
      <div>
        <SectionHeader label="SYSTEM_RESOURCES" color={ACCENT} icon={Terminal} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {budgets.map(g => <CircularGauge key={g.label} {...g} />)}
        </div>
      </div>

      {/* Features + Debug commands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <SectionHeader label={`DEBUG_SUBSYSTEMS // ${stats.implemented}/${stats.total}`} color={ACCENT} icon={Wrench} />
          <div className="space-y-1.5">
            {FEATURE_NAMES.map(name => (
              <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs}
                expanded={expandedFeature} onToggle={toggleFeature} accent={ACCENT} />
            ))}
          </div>
        </div>

        <div className="space-y-3 h-full flex flex-col">
          <SectionHeader label="DEV_CONSOLE_CMDS" color={ACCENT} icon={Terminal} />
          <BlueprintPanel color={ACCENT} className="p-0 flex-1 flex flex-col overflow-hidden font-mono">
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {DEBUG_COMMANDS.map(cmd => (
                <div key={cmd.syntax} className="border rounded p-2 relative group transition-colors" style={{ borderColor: `${ACCENT}20`, backgroundColor: `${ACCENT}04` }}>
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: ACCENT }} />
                  <div className="flex flex-col gap-1.5 pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold mt-1" style={{ color: `${ACCENT}cc` }}>&gt; {cmd.syntax}</span>
                      <CopyButton text={cmd.syntax} />
                    </div>
                    <p className="text-xs text-text-muted uppercase">{cmd.description}</p>
                  </div>
                </div>
              ))}
              <div className="text-xs text-text-muted animate-pulse">&gt; _</div>
            </div>
          </BlueprintPanel>
        </div>
      </div>

      {/* Optimization queue */}
      <div className="mt-2">
        <SectionHeader label="PERF_OPTIMIZATION_QUEUE" color={ACCENT} icon={Activity} />
        <div className="space-y-3 mt-2">
          {OPTIMIZATIONS.map((opt, i) => {
            const status: FeatureStatus = featureMap.get(opt.featureName)?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            return (
              <BlueprintPanel key={opt.title} color={ACCENT} className="px-3 py-3 group">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold font-mono border"
                      style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT, borderColor: `${ACCENT}${OPACITY_30}` }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-bold font-mono tracking-widest" style={{ color: `${ACCENT}ee` }}>{opt.title}</span>
                  </div>
                  <div className="sm:ml-auto flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
                    <span className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-[2px] rounded border"
                      style={{ backgroundColor: `${EFFORT_COLORS[opt.effort]}${OPACITY_10}`, color: EFFORT_COLORS[opt.effort], borderColor: `${EFFORT_COLORS[opt.effort]}${OPACITY_30}` }}>{opt.effort} EFFORT</span>
                    <span className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-[2px] rounded border"
                      style={{ backgroundColor: `${IMPACT_COLORS[opt.impact]}${OPACITY_10}`, color: IMPACT_COLORS[opt.impact], borderColor: `${IMPACT_COLORS[opt.impact]}${OPACITY_30}` }}>{opt.impact} IMPACT</span>
                    <span className="flex items-center gap-1.5 px-2 py-[2px] rounded border bg-surface" style={{ borderColor: `${sc.dot}40` }}>
                      <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                      <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: sc.dot }}>{sc.label}</span>
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-muted leading-relaxed pl-9 font-mono border-l ml-[11px] mt-1 tracking-wide" style={{ borderColor: `${ACCENT}20` }}>{opt.description}</p>
              </BlueprintPanel>
            );
          })}
        </div>
      </div>

      {/* Section panels */}
      <SystemHealthMatrix />
      <FrameTimeWaterfall />
      <MemorySection />
      <ConsoleSection />
      <NetworkSection />
      <GCTimelineSection />
      <DrawCallSection />
      <StatDashboardSection />
      <CrashPredictionSection />
      <RegressionSection />
    </div>
  );
}
