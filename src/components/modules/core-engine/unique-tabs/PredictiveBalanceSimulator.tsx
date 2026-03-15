'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Play, Activity, AlertTriangle, TrendingUp, Shield,
  Heart, Swords, Crosshair, ChevronRight, Timer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from './_shared';
import {
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
  type BalanceReport,
  type HeatmapCell,
  type SurvivalCurvePoint,
  type SensitivityCurve,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';
import { ENEMY_ARCHETYPES, GEAR_LOADOUTS } from '@/lib/combat/definitions';

const ACCENT = MODULE_COLORS.core;

const ENCOUNTER_COLORS = [ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD];

// ── Survival color ─────────────────────────────────────────────────────────

function survivalColor(rate: number): string {
  if (rate >= 0.8) return STATUS_SUCCESS;
  if (rate >= 0.5) return STATUS_WARNING;
  return STATUS_ERROR;
}

function survivalBg(rate: number): string {
  const r = Math.round(255 * (1 - rate));
  const g = Math.round(255 * rate);
  return `rgba(${r}, ${g}, 60, 0.25)`;
}

// ── Collapsible section ────────────────────────────────────────────────────

function Section({ title, icon: Icon, color, defaultOpen, children }: {
  title: string; icon: typeof Heart; color: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <SurfaceCard level={2} className="relative overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        </motion.div>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs font-semibold text-text">{title}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Heatmap visualization ──────────────────────────────────────────────────

function SurvivalHeatmap({ cells, levels, enemies }: {
  cells: HeatmapCell[]; levels: number[]; enemies: string[];
}) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const getCell = (level: number, enemy: string) => cells.find(c => c.playerLevel === level && c.enemyLabel === enemy);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono border-collapse">
          <thead>
            <tr>
              <th className="text-left text-text-muted px-1.5 py-1 font-bold uppercase tracking-wider">Lv.</th>
              {enemies.map(e => (
                <th key={e} className="text-center text-text-muted px-1 py-1 font-bold uppercase tracking-wider whitespace-nowrap">{e}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map(level => (
              <tr key={level}>
                <td className="text-text-muted font-bold px-1.5 py-0.5 border-r border-border/20">{level}</td>
                {enemies.map(enemy => {
                  const cell = getCell(level, enemy);
                  if (!cell) return <td key={enemy} className="px-1 py-0.5" />;
                  const pct = Math.round(cell.survivalRate * 100);
                  return (
                    <td
                      key={enemy}
                      className="text-center px-1 py-0.5 cursor-default transition-all hover:ring-1 hover:ring-white/30"
                      style={{ backgroundColor: survivalBg(cell.survivalRate) }}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className="font-bold" style={{ color: survivalColor(cell.survivalRate) }}>{pct}%</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-xs font-mono"
          >
            <span className="text-text-muted">Lv.{hovered.playerLevel} vs {hovered.enemyLabel}</span>
            <span style={{ color: survivalColor(hovered.survivalRate) }} className="font-bold">{(hovered.survivalRate * 100).toFixed(0)}% survival</span>
            <span className="text-text-muted">{hovered.avgTTK.toFixed(1)}s TTK</span>
            <span className="text-text-muted">{hovered.avgDPS.toFixed(1)} DPS</span>
            <span className="text-text-muted">{hovered.avgEHP.toFixed(0)} EHP</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Survival curve chart (SVG) ─────────────────────────────────────────────

function SurvivalCurveChart({ curves, width, height }: {
  curves: Record<string, SurvivalCurvePoint[]>; width: number; height: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const entries = Object.entries(curves);
  if (entries.length === 0) return null;

  const allPoints = entries.flatMap(([, pts]) => pts);
  const xMin = Math.min(...allPoints.map(p => p.level));
  const xMax = Math.max(...allPoints.map(p => p.level));

  const pad = { l: 36, r: 8, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const toX = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * w;
  const toY = (v: number) => pad.t + h - v * h;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const firstPts = entries[0][1];
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < firstPts.length; i++) {
      const dist = Math.abs(toX(firstPts[i].level) - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  return (
    <svg ref={svgRef} width={width} height={height} className="overflow-visible" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = toY(f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="var(--color-border)" strokeOpacity={0.3} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" className="text-2xs fill-text-muted">{(f * 100).toFixed(0)}%</text>
          </g>
        );
      })}
      {/* Danger zone */}
      <rect x={pad.l} y={toY(0.5)} width={w} height={toY(0) - toY(0.5)} fill={STATUS_ERROR} fillOpacity={0.05} />
      {/* Curves */}
      {entries.map(([label, pts], ci) => {
        const color = ENCOUNTER_COLORS[ci % ENCOUNTER_COLORS.length];
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.level).toFixed(1)} ${toY(p.survivalRate).toFixed(1)}`).join(' ');
        return (
          <g key={label}>
            <path d={path} fill="none" stroke={color} strokeWidth={2} />
            {pts.map((p, i) => (
              <circle key={i} cx={toX(p.level)} cy={toY(p.survivalRate)} r={hoveredIdx === i ? 4 : 2} fill={color} />
            ))}
          </g>
        );
      })}
      {/* Hover crosshair + tooltip */}
      {hoveredIdx !== null && entries[0][1][hoveredIdx] && (() => {
        const lvl = entries[0][1][hoveredIdx].level;
        const x = toX(lvl);
        return (
          <g>
            <line x1={x} y1={pad.t} x2={x} y2={pad.t + h} stroke={ACCENT} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />
            <foreignObject x={x + 8} y={pad.t + 4} width={130} height={16 + entries.length * 16}>
              <div className="bg-surface-1 border border-border rounded px-2 py-1 text-2xs font-mono shadow-lg">
                <div className="font-bold text-text mb-0.5">Lv.{lvl}</div>
                {entries.map(([label, pts], ci) => {
                  const p = pts[hoveredIdx!];
                  if (!p) return null;
                  return (
                    <div key={label} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ENCOUNTER_COLORS[ci % ENCOUNTER_COLORS.length] }} />
                      <span style={{ color: survivalColor(p.survivalRate) }}>{(p.survivalRate * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </foreignObject>
          </g>
        );
      })()}
      {/* X axis */}
      {entries[0][1].filter((_, i, arr) => i === 0 || i === Math.floor(arr.length / 2) || i === arr.length - 1).map((p, i) => (
        <text key={i} x={toX(p.level)} y={height - 2} textAnchor="middle" className="text-2xs fill-text-muted">Lv.{p.level}</text>
      ))}
    </svg>
  );
}

// ── Sensitivity chart ──────────────────────────────────────────────────────

function SensitivityChart({ curve, width, height, color }: {
  curve: SensitivityCurve; width: number; height: number; color: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pts = curve.points;
  if (pts.length < 2) return null;

  const xMin = pts[0].value;
  const xMax = pts[pts.length - 1].value;
  const yMin = 0;
  const yMax = 1;

  const pad = { l: 36, r: 8, t: 8, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const toX = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * w;
  const toY = (v: number) => pad.t + h - ((v - yMin) / (yMax - yMin)) * h;

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.value).toFixed(1)} ${toY(p.survivalRate).toFixed(1)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dist = Math.abs(toX(pts[i].value) - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  const hp = hoveredIdx !== null ? pts[hoveredIdx] : null;

  return (
    <svg ref={svgRef} width={width} height={height} className="overflow-visible" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.t + h * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="var(--color-border)" strokeOpacity={0.3} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" className="text-2xs fill-text-muted">{(f * 100).toFixed(0)}%</text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {pts.map((p, i) => (
        <circle key={i} cx={toX(p.value)} cy={toY(p.survivalRate)} r={hoveredIdx === i ? 5 : 2.5} fill={color} opacity={hoveredIdx === i ? 1 : 0.8} />
      ))}
      {/* Hover tooltip */}
      {hp && (() => {
        const hx = toX(hp.value);
        const onRight = hx < width / 2;
        return (
          <g>
            <line x1={hx} y1={pad.t} x2={hx} y2={pad.t + h} stroke={color} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6} />
            <foreignObject x={onRight ? hx + 8 : hx - 118} y={Math.min(toY(hp.survivalRate) - 10, pad.t + h - 58)} width={110} height={58}>
              <div className="bg-surface-1 border border-border rounded px-2 py-1 text-2xs font-mono shadow-lg" style={{ borderColor: `${color}40` }}>
                <div className="font-bold mb-0.5" style={{ color }}>{curve.attribute}: {hp.value.toFixed(curve.attribute === 'critChance' ? 2 : 0)}</div>
                <div className="text-text-muted">Survival: <span style={{ color: survivalColor(hp.survivalRate) }}>{(hp.survivalRate * 100).toFixed(0)}%</span></div>
                <div className="text-text-muted">TTK: <span className="text-text">{hp.avgTTK.toFixed(1)}s</span></div>
              </div>
            </foreignObject>
          </g>
        );
      })()}
      {/* Diminishing returns */}
      {curve.diminishingAt !== null && (
        <g>
          <line x1={toX(curve.diminishingAt)} y1={pad.t} x2={toX(curve.diminishingAt)} y2={pad.t + h} stroke={STATUS_WARNING} strokeDasharray="4 3" strokeWidth={1.5} />
          <text x={toX(curve.diminishingAt)} y={pad.t - 2} textAnchor="middle" className="text-2xs" fill={STATUS_WARNING}>DR</text>
        </g>
      )}
      {/* X labels */}
      {[pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((p, i) => (
        <text key={i} x={toX(p.value)} y={height - 2} textAnchor="middle" className="text-2xs fill-text-muted">
          {curve.attribute === 'critChance' ? (p.value * 100).toFixed(0) + '%' : p.value.toFixed(0)}
        </text>
      ))}
    </svg>
  );
}

// ── DPS breakdown bar chart ────────────────────────────────────────────────

function DPSBreakdownChart({ breakdowns }: { breakdowns: Record<string, { abilityName: string; avgDamage: number; color: string }[]> }) {
  const entries = Object.entries(breakdowns);
  if (entries.length === 0) return null;

  // Use first encounter's breakdown
  const [label, items] = entries[0];
  const maxDPS = Math.max(...items.map(i => i.avgDamage), 1);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">{label} — Effective DPS/ability</div>
      {items.map(item => {
        const pct = (item.avgDamage / maxDPS) * 100;
        return (
          <div key={item.abilityName} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-muted w-24 truncate text-right flex-shrink-0">{item.abilityName}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-deep overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-text w-10 text-right">{item.avgDamage.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Alert badges ───────────────────────────────────────────────────────────

function AlertBadges({ alerts }: { alerts: BalanceReport['alerts'] }) {
  if (alerts.length === 0) return <div className="text-[10px] text-text-muted font-mono">No balance issues detected.</div>;

  const severityColors = { critical: STATUS_ERROR, warning: STATUS_WARNING, info: '#60a5fa' };
  const severityIcons = { critical: AlertTriangle, warning: AlertTriangle, info: Activity };

  // Deduplicate and limit
  const unique = alerts.filter((a, i, arr) => arr.findIndex(b => b.message === a.message) === i).slice(0, 8);

  return (
    <div className="space-y-1.5">
      {unique.map((alert, i) => {
        const color = severityColors[alert.severity];
        const Icon = severityIcons[alert.severity];
        return (
          <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded border text-[10px] font-mono" style={{ backgroundColor: `${color}10`, borderColor: `${color}30` }}>
            <Icon className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color }} />
            <span className="text-text-muted">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PredictiveBalanceSimulator() {
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<PredictiveBalanceConfig>(DEFAULT_PREDICTIVE_CONFIG);
  const runLock = useRef(false);

  const runSim = useCallback(() => {
    if (runLock.current) return;
    runLock.current = true;
    setIsRunning(true);

    // Defer to next frame so UI shows loading state
    requestAnimationFrame(() => {
      const result = runPredictiveBalance(config);
      setReport(result);
      setIsRunning(false);
      runLock.current = false;
    });
  }, [config]);

  const levels = useMemo(() => {
    const ls: number[] = [];
    for (let l = config.levelRange[0]; l <= config.levelRange[1]; l += config.levelStep) ls.push(l);
    return ls;
  }, [config]);

  const enemyLabels = useMemo(() => {
    return config.enemyConfigs.map(ec => {
      const arch = ENEMY_ARCHETYPES.find(a => a.id === ec.archetypeId);
      return `${ec.count}x ${arch?.name ?? ec.archetypeId}`;
    });
  }, [config]);

  const sensColors: Record<string, string> = { attackPower: ACCENT_ORANGE, armor: ACCENT_EMERALD, maxHealth: STATUS_ERROR, critChance: ACCENT_VIOLET };

  return (
    <SurfaceCard level={2} className="p-0 overflow-hidden relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: ACCENT }} />
          <SectionLabel icon={TrendingUp} label="Predictive Balance Simulator" color={ACCENT} />
        </div>
        <button
          onClick={runSim}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
        >
          {isRunning ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <Activity className="w-3.5 h-3.5" />
            </motion.div>
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isRunning ? 'Simulating...' : 'Run Simulation'}
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Config controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Level Range</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min={1} max={50}
                value={config.levelRange[0]}
                onChange={e => setConfig(c => ({ ...c, levelRange: [+e.target.value, c.levelRange[1]] }))}
                className="w-12 px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text text-center"
              />
              <span className="text-text-muted">—</span>
              <input
                type="number" min={1} max={50}
                value={config.levelRange[1]}
                onChange={e => setConfig(c => ({ ...c, levelRange: [c.levelRange[0], +e.target.value] }))}
                className="w-12 px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text text-center"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Iterations</span>
            <select
              value={config.iterations}
              onChange={e => setConfig(c => ({ ...c, iterations: +e.target.value }))}
              className="px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text"
            >
              {[100, 200, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Gear</span>
            <select
              value={config.gearId}
              onChange={e => setConfig(c => ({ ...c, gearId: e.target.value }))}
              className="px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text"
            >
              {GEAR_LOADOUTS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Level Step</span>
            <select
              value={config.levelStep}
              onChange={e => setConfig(c => ({ ...c, levelStep: +e.target.value }))}
              className="px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text"
            >
              {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Encounter configuration */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Encounter Setup</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {config.enemyConfigs.map((ec, i) => {
              const arch = ENEMY_ARCHETYPES.find(a => a.id === ec.archetypeId);
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-deep border border-border/30 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ENCOUNTER_COLORS[i % ENCOUNTER_COLORS.length] }} />
                  <select
                    value={ec.archetypeId}
                    onChange={e => {
                      const next = [...config.enemyConfigs];
                      next[i] = { ...next[i], archetypeId: e.target.value };
                      setConfig(c => ({ ...c, enemyConfigs: next }));
                    }}
                    className="flex-1 bg-transparent text-text border-none outline-none"
                  >
                    {ENEMY_ARCHETYPES.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <span className="text-text-muted">×</span>
                  <input
                    type="number" min={1} max={10}
                    value={ec.count}
                    onChange={e => {
                      const next = [...config.enemyConfigs];
                      next[i] = { ...next[i], count: +e.target.value };
                      setConfig(c => ({ ...c, enemyConfigs: next }));
                    }}
                    className="w-8 px-1 py-0.5 rounded bg-surface border border-border/40 text-text text-center"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {!report && !isRunning && (
          <div className="text-center py-8 text-text-muted text-xs font-mono">
            Click &quot;Run Simulation&quot; to sweep Lv.{config.levelRange[0]}–{config.levelRange[1]} across {config.enemyConfigs.length} encounter types
          </div>
        )}

        {isRunning && (
          <div className="text-center py-8">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} className="inline-block">
              <Activity className="w-6 h-6" style={{ color: ACCENT }} />
            </motion.div>
            <div className="text-xs text-text-muted font-mono mt-2">Running {config.iterations} iterations × {levels.length} levels × {config.enemyConfigs.length} encounters...</div>
          </div>
        )}

        {report && !isRunning && (
          <div className="space-y-3">
            {/* Summary banner */}
            <div className="px-3 py-2 rounded-lg bg-surface-deep border border-border/30 text-xs font-mono text-text-muted">
              {report.summary}
              <span className="text-text-muted ml-2 opacity-60">({report.durationMs}ms)</span>
            </div>

            {/* Stat badges */}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const midLevel = Math.floor((config.levelRange[0] + config.levelRange[1]) / 2);
                const midCells = report.heatmap.filter(c => c.playerLevel === midLevel);
                const avgSurv = midCells.length > 0 ? midCells.reduce((s, c) => s + c.survivalRate, 0) / midCells.length : 0;
                const avgTTK = midCells.length > 0 ? midCells.reduce((s, c) => s + c.avgTTK, 0) / midCells.length : 0;
                const avgDPS = midCells.length > 0 ? midCells.reduce((s, c) => s + c.avgDPS, 0) / midCells.length : 0;
                const avgEHP = midCells.length > 0 ? midCells.reduce((s, c) => s + c.avgEHP, 0) / midCells.length : 0;

                const badges = [
                  { label: 'Survival', value: `${(avgSurv * 100).toFixed(0)}%`, color: survivalColor(avgSurv), icon: Heart },
                  { label: 'Avg TTK', value: `${avgTTK.toFixed(1)}s`, color: ACCENT_CYAN, icon: Timer },
                  { label: 'Avg DPS', value: avgDPS.toFixed(1), color: ACCENT_ORANGE, icon: Swords },
                  { label: 'Avg EHP', value: avgEHP.toFixed(0), color: ACCENT_EMERALD, icon: Shield },
                  { label: 'Alerts', value: `${report.alerts.length}`, color: report.alerts.some(a => a.severity === 'critical') ? STATUS_ERROR : STATUS_WARNING, icon: AlertTriangle },
                ];

                return badges.map(b => (
                  <div key={b.label} className="flex flex-col items-center px-2.5 py-1.5 rounded-md" style={{ backgroundColor: `${b.color}${OPACITY_15}` }}>
                    <div className="flex items-center gap-1">
                      <b.icon className="w-3 h-3" style={{ color: b.color }} />
                      <span className="text-xs font-bold font-mono" style={{ color: b.color }}>{b.value}</span>
                    </div>
                    <span className="text-2xs text-text-muted mt-0.5">{b.label}</span>
                  </div>
                ));
              })()}
            </div>

            {/* Survival Heatmap */}
            <Section title="Survival Heatmap — Level × Encounter" icon={Crosshair} color={ACCENT} defaultOpen>
              <SurvivalHeatmap cells={report.heatmap} levels={levels} enemies={enemyLabels} />
            </Section>

            {/* Survival Curves */}
            <Section title="Survival Curves by Level" icon={TrendingUp} color={ACCENT_CYAN} defaultOpen>
              <div className="space-y-2">
                <SurvivalCurveChart curves={report.survivalCurves} width={480} height={180} />
                <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                  {Object.keys(report.survivalCurves).map((label, i) => (
                    <span key={label} className="flex items-center gap-1">
                      <span className="w-2 h-0.5 rounded" style={{ backgroundColor: ENCOUNTER_COLORS[i % ENCOUNTER_COLORS.length] }} />
                      <span className="text-text-muted">{label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Section>

            {/* DPS Breakdowns */}
            <Section title="DPS Breakdown by Ability" icon={Swords} color={ACCENT_ORANGE}>
              <DPSBreakdownChart breakdowns={report.dpsBreakdowns} />
            </Section>

            {/* Sensitivity Analysis */}
            <Section title="Sensitivity Analysis" icon={Activity} color={ACCENT_VIOLET}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.sensitivity.map(curve => {
                  const color = sensColors[curve.attribute] ?? ACCENT;
                  return (
                    <div key={curve.attribute}>
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1" style={{ color }}>{curve.attribute}</div>
                      <SensitivityChart curve={curve} width={220} height={120} color={color} />
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Balance Alerts */}
            <Section title={`Balance Alerts (${report.alerts.length})`} icon={AlertTriangle} color={report.alerts.some(a => a.severity === 'critical') ? STATUS_ERROR : STATUS_WARNING}>
              <AlertBadges alerts={report.alerts} />
            </Section>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
