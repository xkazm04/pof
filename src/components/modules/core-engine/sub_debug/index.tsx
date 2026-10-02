'use client';

import { useState, useCallback, useMemo } from 'react';
import { Activity, Wrench, Terminal, LayoutGrid } from 'lucide-react';
import {
  withOpacity, OPACITY_90, OPACITY_25, OPACITY_12, OPACITY_5, OPACITY_80, GLOW_MD,
  ACCENT_EMERALD_DARK, STATUS_SUBDUED,
} from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { SectionHeader, BlueprintPanel } from '../unique-tabs/_design';
import { FeatureCard, LoadingSpinner, SubTabNavigation, type SubTab } from '../unique-tabs/_shared';
import { CircularGauge, CopyButton } from './system/CircularGauge';
import { SystemHealthMatrix, FrameTimeWaterfall } from './system/SystemHealthSection';
import { MemorySection } from './performance/MemorySection';
import { ConsoleSection } from './console/ConsoleSection';
import { NetworkSection } from './network/NetworkSection';
import { GCTimelineSection } from './performance/GCTimelineSection';
import { DrawCallSection } from './performance/DrawCallSection';
import { OptimizationQueue } from './performance/OptimizationQueue';
import { StatDashboardSection } from './crashes/StatDashboardSection';
import { CrashPredictionSection } from './crashes/CrashPredictionSection';
import { RegressionSection } from './crashes/RegressionSection';
import {
  ACCENT, DEBUG_COMMANDS, FEATURE_NAMES,
} from './_shared/data';
import type { SubModuleId } from '@/types/modules';
import FeatureMapTab from '../unique-tabs/FeatureMapTab';
import { VisibleSection } from '../unique-tabs/VisibleSection';
import { useDebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/useDebugSnapshot';
import { provenanceLabel } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';

interface DebugDashboardProps { moduleId: SubModuleId }

export function DebugDashboard({ moduleId }: DebugDashboardProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  // Every perf panel below is a projection of ONE ProfilingSession (newest capture, or the sample).
  const { snapshot, provenance, latest } = useDebugSnapshot();
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
  ], []);

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
          <span className="text-base font-bold font-mono tracking-widest uppercase" style={{ color: `${withOpacity(ACCENT, OPACITY_90)}`, textShadow: `${GLOW_MD} ${withOpacity(ACCENT, OPACITY_25)}` }}>
            CORE_TELEMETRY.exe
          </span>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: provenance.kind === 'session' && provenance.source !== 'manual' ? ACCENT_EMERALD_DARK : STATUS_SUBDUED }} />
            <span>{provenanceLabel(provenance)}</span>
          </span>
        </div>
      </div>

      <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} />}

      {activeTab === 'dashboard' && <VisibleSection moduleId={moduleId} sectionId="health">
      {/* Budget gauges */}
      <div>
        <SectionHeader label="SYSTEM_RESOURCES" color={ACCENT} icon={Terminal} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {snapshot.gauges.map(g => <CircularGauge key={g.label} {...g} />)}
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
                <div key={cmd.syntax} className="border rounded p-2 relative group transition-colors" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_12)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: ACCENT }} />
                  <div className="flex flex-col gap-1.5 pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold mt-1" style={{ color: `${withOpacity(ACCENT, OPACITY_80)}` }}>&gt; {cmd.syntax}</span>
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

      {/* Optimization queue: the newest capture's triage, one-click Fix, verified by re-capture */}
      <OptimizationQueue latest={latest} />

      {/* Section panels */}
      <FrameTimeWaterfall frame={snapshot.frame} />
      <MemorySection memory={snapshot.memory} />
      <GCTimelineSection gc={snapshot.gc} />
      <DrawCallSection drawCalls={snapshot.drawCalls} />
      <StatDashboardSection stats={snapshot.stats} />
      <CrashPredictionSection crash={snapshot.crash} recommendations={snapshot.recommendations} />
      <ConsoleSection />
      {/* Not projected from a profiler session yet — hand-typed illustrations. */}
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted border-t border-border pt-3">
        Illustrative panels below are not read from any profiler session
      </div>
      <SystemHealthMatrix />
      <NetworkSection />
      <RegressionSection />
      </VisibleSection>}
    </div>
  );
}
