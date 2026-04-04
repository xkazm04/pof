'use client';

import { Activity, Cpu, Wifi } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, OPACITY_15 } from '@/lib/chart-colors';

/* -- Props ----------------------------------------------------------------- */

export interface DebugDashboardPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* -- Constants -------------------------------------------------------------- */

const ACCENT = MODULE_COLORS.core;

const PERF_METRICS = [
  { name: 'FPS', value: 58, unit: '', target: 60, status: 'warning' as const },
  { name: 'Memory', value: 2.4, unit: 'GB', target: 4.0, status: 'ok' as const },
  { name: 'Draw Calls', value: 3200, unit: '', target: 3000, status: 'warning' as const },
  { name: 'Network Latency', value: 42, unit: 'ms', target: 100, status: 'ok' as const },
  { name: 'Triangles', value: 1.8, unit: 'M', target: 3.0, status: 'ok' as const },
] as const;

const MEMORY_BREAKDOWN = [
  { label: 'Textures', mb: 820 },
  { label: 'Meshes', mb: 540 },
  { label: 'Audio', mb: 180 },
  { label: 'Blueprints', mb: 310 },
  { label: 'Particles', mb: 150 },
] as const;

const NETWORK_STATS = [
  { label: 'Packets In', value: '1,240/s' },
  { label: 'Packets Out', value: '980/s' },
  { label: 'Bandwidth', value: '12.4 KB/s' },
  { label: 'Replication', value: '340 actors' },
] as const;

function metricColor(status: string): string {
  if (status === 'ok') return STATUS_SUCCESS;
  if (status === 'warning') return STATUS_WARNING;
  return STATUS_ERROR;
}

/* -- Micro density --------------------------------------------------------- */

function DashboardMicro() {
  const fps = PERF_METRICS[0];
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Activity className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{fps.value} FPS</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function DashboardCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Performance Metrics</span>
        <span className="font-mono text-text">{PERF_METRICS.length} metrics</span>
      </div>
      {PERF_METRICS.map((m) => (
        <div key={m.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: metricColor(m.status) }}
          />
          <span className="text-text-muted flex-1 truncate">{m.name}</span>
          <span className="font-mono text-text">
            {m.value}{m.unit ? ` ${m.unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function DashboardFull() {
  const totalMb = MEMORY_BREAKDOWN.reduce((s, m) => s + m.mb, 0);
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Real-time debug dashboard with performance gauges, memory profiling, and network telemetry.
      </SurfaceCard>

      {/* Metric Cards */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Activity} label="Performance Gauges" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {PERF_METRICS.map((metric, i) => {
            const pct = Math.min((metric.value / metric.target) * 100, 100);
            const color = metricColor(metric.status);
            return (
              <motion.div
                key={metric.name}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text font-medium">{metric.name}</span>
                  <span className="font-mono text-text">
                    {metric.value}{metric.unit ? ` ${metric.unit}` : ''}
                    <span className="text-text-muted"> / {metric.target}{metric.unit ? ` ${metric.unit}` : ''}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: `${color}${OPACITY_15}` }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Memory Breakdown */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Cpu} label="Memory Breakdown" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {MEMORY_BREAKDOWN.map((seg, i) => (
            <motion.div
              key={seg.label}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-text-muted flex-1 truncate">{seg.label}</span>
              <span className="font-mono text-text">{seg.mb} MB</span>
              <span className="text-text-muted font-mono">{((seg.mb / totalMb) * 100).toFixed(0)}%</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Network Stats */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Wifi} label="Network Stats" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {NETWORK_STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-text-muted">{stat.label}</span>
              <span className="font-mono text-text">{stat.value}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* -- Main ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DebugDashboardPanel({ featureMap, defs }: DebugDashboardPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Debug Dashboard" icon={<Activity className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <DashboardMicro />}
          {density === 'compact' && <DashboardCompact />}
          {density === 'full' && <DashboardFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
