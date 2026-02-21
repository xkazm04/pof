'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Wrench, Copy, Check, Terminal, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD,
  OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS, TabHeader, SectionLabel, FeatureCard, LoadingSpinner } from './_shared';

const ACCENT = ACCENT_ORANGE;

const INITIAL_BUDGETS = [
  { label: 'TICK_BUDGET', current: 11.2, target: 16.0, unit: 'ms' },
  { label: 'DRAW_CALLS', current: 1640, target: 2000, unit: '' },
  { label: 'VRAM_ALLOC', current: 380, target: 512, unit: 'MB' },
  { label: 'ACTIVE_ACTORS', current: 720, target: 1000, unit: '' },
];

const DEBUG_COMMANDS = [
  { syntax: 'godmode', description: 'Toggle invuln & infinite resources' },
  { syntax: 'give <id> <count>', description: 'Add item to inventory by ID' },
  { syntax: 'setlevel <n>', description: 'Set player level directly' },
  { syntax: 'spawn <type>', description: 'Spawn enemy at cursor location' },
  { syntax: 'killall', description: 'Purge all active enemies in cell' },
];

type EffortLevel = 'Small' | 'Medium' | 'Large';
type ImpactLevel = 'High' | 'Medium' | 'Low';

const OPTIMIZATIONS: { title: string; featureName: string; effort: EffortLevel; impact: ImpactLevel; description: string }[] = [
  { title: 'Object Pooling Init', featureName: 'Object pooling', effort: 'Medium', impact: 'High', description: 'Pre-allocate projectiles, VFX actors, and floating text.' },
  { title: 'Tick Optimization', featureName: 'Tick optimization', effort: 'Small', impact: 'High', description: 'Throttle tick on idle actors; move to timer delegates.' },
  { title: 'Async Asset Streaming', featureName: 'Async asset loading', effort: 'Large', impact: 'Medium', description: 'Stream level chunks to avoid main thread hitches.' },
];

const EFFORT_COLORS: Record<EffortLevel, string> = { Small: ACCENT_EMERALD, Medium: STATUS_WARNING, Large: STATUS_ERROR };
const IMPACT_COLORS: Record<ImpactLevel, string> = { High: STATUS_SUCCESS, Medium: STATUS_WARNING, Low: '#64748b' };

const FEATURE_NAMES = [
  'Structured logging', 'Debug draw helpers', 'Debug console commands',
  'Object pooling', 'Tick optimization', 'Async asset loading',
];

function CircularGauge({ label, current, target, unit }: { label: string; current: number; target: number; unit: string }) {
  const pct = Math.min(current / target, 1);
  const r = 20;
  const circ = 2 * Math.PI * r;
  const color = pct < 0.75 ? STATUS_SUCCESS : pct < 0.95 ? STATUS_WARNING : STATUS_ERROR;
  const statusLabel = pct < 0.75 ? 'NOMINAL' : pct < 0.95 ? 'WARNING' : 'CRITICAL';

  return (
    <SurfaceCard level={2} className="flex flex-col items-center px-2 py-3 gap-2 relative overflow-hidden border-orange-900/40 bg-orange-950/10 hover:border-orange-500/30 transition-colors">
      <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

      <div className="relative">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
          <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round" transform="rotate(-90 30 30)"
            style={{ transition: 'stroke-dashoffset 0.3s ease-out', filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
          <span className="text-[10px] font-mono font-bold" style={{ color }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>

      <div className="text-center w-full z-10">
        <div className="text-[10px] font-mono font-bold text-orange-400/80 mb-0.5 truncate tracking-widest">{label}</div>
        <div className="text-sm font-mono text-orange-100" style={{ textShadow: '0 0 8px rgba(251,146,60,0.5)' }}>
          {current.toFixed(unit === 'ms' ? 1 : 0)}<span className="text-[10px] text-orange-500/50">{unit}</span>
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-[8px] px-1.5 py-[2px] rounded font-mono uppercase tracking-widest border" style={{ backgroundColor: `${color}${OPACITY_10}`, color, borderColor: `${color}${OPACITY_30}` }}>
            {statusLabel}
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded transition-all border shrink-0"
      style={{
        backgroundColor: copied ? `${STATUS_SUCCESS}${OPACITY_20}` : `${ACCENT}${OPACITY_10}`,
        color: copied ? STATUS_SUCCESS : ACCENT,
        borderColor: copied ? STATUS_SUCCESS : `${ACCENT}${OPACITY_30}`,
        boxShadow: copied ? `0 0 10px ${STATUS_SUCCESS}40` : 'none'
      }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'COPIED' : 'EXEC'}
    </button>
  );
}

interface DebugDashboardProps { moduleId: SubModuleId }

export function DebugDashboard({ moduleId }: DebugDashboardProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Real-time telemetry simulation
  const [budgets, setBudgets] = useState(INITIAL_BUDGETS);

  useSuspendableEffect(() => {
    const updateInterval = setInterval(() => {
      setBudgets(prev => prev.map(b => {
        // slight randomization logic
        const variance = (Math.random() - 0.5) * (b.current * 0.05);
        let nextVal = b.current + variance;
        if (nextVal < b.target * 0.1) nextVal = b.target * 0.1;
        if (nextVal > b.target * 1.5) nextVal = b.target * 1.5;
        return { ...b, current: nextVal };
      }));
    }, 800);

    return () => clearInterval(updateInterval);
  }, []);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  const stats = useMemo(() => {
    const implemented = FEATURE_NAMES.filter((n) => {
      const st = featureMap.get(n)?.status ?? 'unknown';
      return st === 'implemented' || st === 'improved';
    }).length;
    return { total: FEATURE_NAMES.length, implemented };
  }, [featureMap]);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-4">
      {/* Terminal Interface Header */}
      <div className="flex items-center justify-between pb-3 border-b border-orange-900/40 relative">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded grid place-items-center bg-orange-950/50 border border-orange-800/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-orange-500/20 animate-pulse pointer-events-none" style={{ animationDuration: '1.5s' }} />
            <Activity className="w-5 h-5 relative z-10 text-orange-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-orange-100 font-mono tracking-widest uppercase" style={{ textShadow: '0 0 8px rgba(251,146,60,0.4)' }}>
              CORE_TELEMETRY.exe
            </span>
            <span className="text-xs text-orange-700 font-mono uppercase tracking-widest mt-0.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE STREAM ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Budget gauges */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">SYSTEM_RESOURCES</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {budgets.map((g) => <CircularGauge key={g.label} {...g} />)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Features list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
            <Wrench className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">DEBUG_SUBSYSTEMS // {stats.implemented}/{stats.total}</span>
          </div>
          <div className="space-y-1.5">
            {FEATURE_NAMES.map((name) => (
              <FeatureCard
                key={name}
                name={name}
                featureMap={featureMap}
                defs={defs}
                expanded={expandedFeature}
                onToggle={toggleFeature}
                accent={ACCENT}
              />
            ))}
          </div>
        </div>

        {/* Console Commands */}
        <div className="space-y-2 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
            <Terminal className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">DEV_CONSOLE_CMDS</span>
          </div>
          <SurfaceCard level={2} className="p-0 border-orange-900/30 bg-[#0a0500] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex-1 flex flex-col overflow-hidden relative font-mono">
            <div className="p-3 space-y-2 relative z-10 flex-1 overflow-y-auto">
              {DEBUG_COMMANDS.map((cmd) => (
                <div key={cmd.syntax} className="border border-orange-900/40 bg-orange-950/10 p-2 relative group hover:border-orange-500/50 transition-colors">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <div className="flex flex-col gap-1.5 pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-orange-300 tracking-wide mt-1">&gt; {cmd.syntax}</span>
                      <CopyButton text={cmd.syntax} />
                    </div>
                    <p className="text-[10px] text-orange-700/80 leading-relaxed uppercase">{cmd.description}</p>
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-orange-700/50 mt-2 animate-pulse">&gt; _</div>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Optimization queue */}
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <Activity className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">PERF_OPTIMIZATION_QUEUE</span>
        </div>
        <div className="space-y-2 mt-2">
          {OPTIMIZATIONS.map((opt, i) => {
            const status: FeatureStatus = featureMap.get(opt.featureName)?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            return (
              <SurfaceCard key={opt.title} level={2} className="px-3 py-3 border-orange-900/20 bg-orange-950/5 relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono border"
                      style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT, borderColor: `${ACCENT}${OPACITY_30}` }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-bold text-orange-100 font-mono tracking-widest">{opt.title}</span>
                  </div>
                  <div className="sm:ml-auto flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
                    <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-[2px] rounded border" style={{ backgroundColor: `${EFFORT_COLORS[opt.effort]}${OPACITY_10}`, color: EFFORT_COLORS[opt.effort], borderColor: `${EFFORT_COLORS[opt.effort]}${OPACITY_30}` }}>{opt.effort} EFFORT</span>
                    <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-[2px] rounded border" style={{ backgroundColor: `${IMPACT_COLORS[opt.impact]}${OPACITY_10}`, color: IMPACT_COLORS[opt.impact], borderColor: `${IMPACT_COLORS[opt.impact]}${OPACITY_30}` }}>{opt.impact} IMPACT</span>
                    <span className="flex items-center gap-1.5 px-2 py-[2px] rounded border bg-surface" style={{ borderColor: `${sc.dot}40` }}>
                      <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: sc.dot }}>{sc.label}</span>
                    </span>
                  </div>
                </div>
                <p className="text-xs text-orange-200/50 leading-relaxed pl-9 font-mono border-l border-orange-900/40 ml-[11px] mt-1 tracking-wide">{opt.description}</p>
              </SurfaceCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
