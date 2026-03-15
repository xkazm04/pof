'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Users, Play, RotateCcw, Info, ArrowRight,
  Shield, Crosshair, Target, Eye, Swords,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SubTabNavigation, type SubTab } from '@/components/modules/core-engine/unique-tabs/_shared';
import {
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD,
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';
import type { SquadRole, DirectorConfig } from '@/types/squad-tactics';
import {
  runSquadSimulation, PRESET_FORMATIONS, ROLE_DEFINITIONS,
  DEFAULT_DIRECTOR_CONFIG,
} from '@/lib/ai-director/squad-engine';

const ACCENT = MODULE_COLORS.systems;

/* ── Role colors & icons ──────────────────────────────────────────────────── */

const ROLE_COLORS: Record<SquadRole, string> = {
  aggressor: STATUS_ERROR,
  flanker: ACCENT_EMERALD,
  support: ACCENT_CYAN,
  tank: STATUS_WARNING,
  ambusher: ACCENT_VIOLET,
};

const ROLE_ICONS: Record<SquadRole, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  aggressor: Swords,
  flanker: Crosshair,
  support: Eye,
  tank: Shield,
  ambusher: Target,
};

/* ── SVG constants ────────────────────────────────────────────────────────── */

const SVG_SIZE = 380;
const SVG_CENTER = SVG_SIZE / 2;
const SVG_PADDING = 50;
const DRAW_RADIUS = (SVG_SIZE - SVG_PADDING * 2) / 2;

/* ── Sub-tabs ─────────────────────────────────────────────────────────────── */

const SUB_TABS: SubTab[] = [
  { id: 'formation', label: 'Formation View' },
  { id: 'pipeline', label: 'EQS Pipeline' },
  { id: 'codegen', label: 'UE5 Code' },
];

/* ── Flank color helper (matches FlankAngleHeatmap) ───────────────────────── */

function flankColor(angleDeg: number): string {
  const t = Math.min(angleDeg / 180, 1);
  if (t <= 0.5) {
    const f = t / 0.5;
    const r = Math.round(255 + (234 - 255) * f);
    const g = Math.round(68 + (179 - 68) * f);
    const b = Math.round(68 + (8 - 68) * f);
    return `rgb(${r},${g},${b})`;
  }
  const f = (t - 0.5) / 0.5;
  const r = Math.round(234 + (34 - 234) * f);
  const g = Math.round(179 + (197 - 179) * f);
  const b = Math.round(8 + (94 - 8) * f);
  return `rgb(${r},${g},${b})`;
}

/* ── Pipeline step colors ─────────────────────────────────────────────────── */

const STEP_KIND_COLORS: Record<string, string> = {
  context: ACCENT_CYAN,
  generator: ACCENT_VIOLET,
  'test-score': ACCENT_EMERALD,
  'test-filter': ACCENT_ORANGE,
  director: ACCENT,
  result: STATUS_SUCCESS,
};

/* ── Component ────────────────────────────────────────────────────────────── */

export function SquadChoreographyEditor() {
  const [config, setConfig] = useState<DirectorConfig>(DEFAULT_DIRECTOR_CONFIG);
  const [activeTab, setActiveTab] = useState('formation');
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Run simulation
  const result = useMemo(() => runSquadSimulation(config), [config]);

  // Scale factor: map UU to SVG pixels
  const maxDist = Math.max(
    ...result.members.map(m => m.distance),
    config.attackDistance,
  );
  const scale = DRAW_RADIUS / (maxDist * 1.15);

  // Forward arrow
  const arrowLen = DRAW_RADIUS * 0.7;
  const arrowEndX = SVG_CENTER + Math.cos(config.targetForwardAngle) * arrowLen;
  const arrowEndY = SVG_CENTER + Math.sin(config.targetForwardAngle) * arrowLen;

  // Handlers
  const handleFormationChange = useCallback((formationId: string) => {
    const formation = PRESET_FORMATIONS.find(f => f.id === formationId);
    if (formation) {
      setConfig(prev => ({ ...prev, formation, seed: prev.seed + 1 }));
    }
  }, []);

  const handleResimulate = useCallback(() => {
    setConfig(prev => ({ ...prev, seed: prev.seed + 1 }));
  }, []);

  const handleResetForward = useCallback(() => {
    setConfig(prev => ({ ...prev, targetForwardAngle: -Math.PI / 2 }));
  }, []);

  const handlePointerDown = useCallback(() => setIsDragging(true), []);
  const handlePointerUp = useCallback(() => setIsDragging(false), []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - SVG_CENTER;
      const y = e.clientY - rect.top - SVG_CENTER;
      setConfig(prev => ({ ...prev, targetForwardAngle: Math.atan2(y, x) }));
    },
    [isDragging],
  );

  const handleWeightChange = useCallback((key: 'flankWeight' | 'separationWeight' | 'rangeWeight', value: number) => {
    setConfig(prev => ({ ...prev, [key]: value, seed: prev.seed + 1 }));
  }, []);

  const handleDistanceChange = useCallback((value: number) => {
    setConfig(prev => ({ ...prev, attackDistance: value, seed: prev.seed + 1 }));
  }, []);

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full" data-testid="squad-choreography-editor">
      {/* Header */}
      <SurfaceCard className="p-0 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${ACCENT}${OPACITY_10}` }}
          >
            <Users className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-text font-mono">AI Director: Squad Choreography</h3>
            <p className="text-2xs text-text-muted">
              Compose EQS queries across a squad to produce emergent coordinated tactics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResimulate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: `${ACCENT}${OPACITY_15}`,
                color: ACCENT,
                border: `1px solid ${ACCENT}30`,
              }}
              data-testid="squad-resimulate-btn"
            >
              <Play className="w-3.5 h-3.5" />
              Re-simulate
            </button>
            <button
              onClick={handleResetForward}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: `${ACCENT_CYAN}${OPACITY_15}`,
                color: ACCENT_CYAN,
                border: `1px solid ${ACCENT_CYAN}30`,
              }}
              data-testid="squad-reset-forward-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </SurfaceCard>

      {/* Config + Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Formation selector */}
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Formation</h4>
          <div className="space-y-1">
            {PRESET_FORMATIONS.map(f => (
              <button
                key={f.id}
                onClick={() => handleFormationChange(f.id)}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors"
                style={{
                  backgroundColor: config.formation.id === f.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
                  color: config.formation.id === f.id ? ACCENT : 'var(--text-muted)',
                  border: config.formation.id === f.id ? `1px solid ${ACCENT}30` : '1px solid transparent',
                }}
                data-testid={`squad-formation-${f.id}`}
              >
                <span className="font-bold">{f.name}</span>
                <span className="text-2xs block text-text-muted mt-0.5">{f.description}</span>
              </button>
            ))}
          </div>
        </SurfaceCard>

        {/* Weights / params */}
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Director Weights</h4>
          {[
            { key: 'flankWeight' as const, label: 'Flank Angle', value: config.flankWeight },
            { key: 'separationWeight' as const, label: 'Ally Separation', value: config.separationWeight },
            { key: 'rangeWeight' as const, label: 'Range Preference', value: config.rangeWeight },
          ].map(w => (
            <div key={w.key} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-2xs text-text-muted">{w.label}</span>
                <span className="text-2xs font-mono font-bold" style={{ color: ACCENT }}>{w.value.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={w.value}
                onChange={e => handleWeightChange(w.key, parseFloat(e.target.value))}
                className="w-full h-1 accent-current rounded-full"
                style={{ accentColor: ACCENT }}
              />
            </div>
          ))}
          <div className="space-y-0.5 pt-1 border-t border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-text-muted">Attack Distance</span>
              <span className="text-2xs font-mono font-bold" style={{ color: ACCENT }}>{config.attackDistance} UU</span>
            </div>
            <input
              type="range"
              min={100} max={600} step={25}
              value={config.attackDistance}
              onChange={e => handleDistanceChange(parseInt(e.target.value))}
              className="w-full h-1 accent-current rounded-full"
              style={{ accentColor: ACCENT }}
            />
          </div>
        </SurfaceCard>

        {/* Formation metrics */}
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Formation Metrics</h4>
          {[
            { label: 'Quality Score', value: `${(result.formationScore * 100).toFixed(0)}%`, color: result.formationScore > 0.7 ? STATUS_SUCCESS : result.formationScore > 0.4 ? STATUS_WARNING : STATUS_ERROR },
            { label: 'Angular Coverage', value: `${result.angularCoverage.toFixed(0)}°/360°`, color: result.angularCoverage > 200 ? STATUS_SUCCESS : result.angularCoverage > 120 ? STATUS_WARNING : STATUS_ERROR },
            { label: 'Avg Separation', value: `${result.avgSeparation.toFixed(0)} UU`, color: result.avgSeparation > config.minSeparation ? STATUS_SUCCESS : STATUS_ERROR },
            { label: 'Squad Size', value: `${result.members.length}`, color: ACCENT },
            { label: 'Collisions', value: result.hasCollisions ? 'Yes' : 'None', color: result.hasCollisions ? STATUS_ERROR : STATUS_SUCCESS },
          ].map(m => (
            <div key={m.label} className="flex items-center justify-between">
              <span className="text-2xs text-text-muted">{m.label}</span>
              <span className="text-2xs font-mono font-bold" style={{ color: m.color }}>{m.value}</span>
            </div>
          ))}
          {/* Role breakdown */}
          <div className="pt-1 border-t border-border/30 space-y-1">
            <span className="text-2xs text-text-muted">Roles</span>
            <div className="flex flex-wrap gap-1">
              {config.formation.roles.map(({ role, count }) => {
                const RoleIcon = ROLE_ICONS[role];
                return (
                  <span
                    key={role}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono"
                    style={{
                      backgroundColor: `${ROLE_COLORS[role]}${OPACITY_10}`,
                      color: ROLE_COLORS[role],
                      border: `1px solid ${ROLE_COLORS[role]}30`,
                    }}
                  >
                    <RoleIcon className="w-2.5 h-2.5" />
                    {count}x {ROLE_DEFINITIONS[role].label}
                  </span>
                );
              })}
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Sub-tab navigation */}
      <SubTabNavigation
        tabs={SUB_TABS}
        activeTabId={activeTab}
        onChange={setActiveTab}
        accent={ACCENT}
      />

      {/* Tab content */}
      {activeTab === 'formation' && (
        <FormationView
          config={config}
          result={result}
          hoveredMember={hoveredMember}
          setHoveredMember={setHoveredMember}
          isDragging={isDragging}
          svgRef={svgRef}
          scale={scale}
          arrowEndX={arrowEndX}
          arrowEndY={arrowEndY}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
        />
      )}
      {activeTab === 'pipeline' && (
        <PipelineView result={result} />
      )}
      {activeTab === 'codegen' && (
        <CodeGenView config={config} />
      )}
    </div>
  );
}

/* ── Formation SVG View ───────────────────────────────────────────────────── */

function FormationView({
  config, result, hoveredMember, setHoveredMember,
  isDragging, svgRef, scale, arrowEndX, arrowEndY,
  onPointerDown, onPointerUp, onPointerMove,
}: {
  config: DirectorConfig;
  result: ReturnType<typeof runSquadSimulation>;
  hoveredMember: string | null;
  setHoveredMember: (id: string | null) => void;
  isDragging: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  scale: number;
  arrowEndX: number;
  arrowEndY: number;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* SVG diagram */}
      <SurfaceCard className="p-0 overflow-hidden flex-shrink-0">
        <svg
          ref={svgRef}
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'default' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          data-testid="squad-formation-svg"
        >
          {/* Grid rings */}
          {[0.25, 0.5, 0.75, 1.0].map(t => (
            <circle
              key={t}
              cx={SVG_CENTER} cy={SVG_CENTER}
              r={DRAW_RADIUS * t}
              fill="none"
              stroke="var(--border)"
              strokeWidth={0.5}
              opacity={0.3}
              strokeDasharray={t < 1 ? '3 3' : undefined}
            />
          ))}

          {/* Attack distance ring */}
          <circle
            cx={SVG_CENTER} cy={SVG_CENTER}
            r={config.attackDistance * scale}
            fill="none"
            stroke={ACCENT_VIOLET}
            strokeWidth={1}
            opacity={0.4}
            strokeDasharray="4 3"
          />

          {/* Compass labels */}
          {['N', 'E', 'S', 'W'].map((dir, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI / 2);
            const r = DRAW_RADIUS + 16;
            return (
              <text
                key={dir}
                x={SVG_CENTER + Math.cos(angle) * r}
                y={SVG_CENTER + Math.sin(angle) * r}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[8px] font-mono fill-[var(--text-muted)]"
                opacity={0.5}
              >
                {dir}
              </text>
            );
          })}

          {/* Target forward vector */}
          <line
            x1={SVG_CENTER} y1={SVG_CENTER}
            x2={arrowEndX} y2={arrowEndY}
            stroke={ACCENT_CYAN}
            strokeWidth={2}
            opacity={0.8}
            markerEnd="url(#squad-fwd-arrow)"
          />
          <defs>
            <marker
              id="squad-fwd-arrow"
              markerWidth="8" markerHeight="6"
              refX="8" refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={ACCENT_CYAN} />
            </marker>
          </defs>

          {/* Drag handle */}
          <circle
            cx={arrowEndX} cy={arrowEndY}
            r={10}
            fill={ACCENT_CYAN}
            fillOpacity={0.15}
            stroke={ACCENT_CYAN}
            strokeWidth={1.5}
            className="cursor-grab"
            onPointerDown={onPointerDown}
            data-testid="squad-forward-drag"
          />
          <text
            x={SVG_CENTER + Math.cos(config.targetForwardAngle) * (DRAW_RADIUS * 0.45)}
            y={SVG_CENTER + Math.sin(config.targetForwardAngle) * (DRAW_RADIUS * 0.45) - 8}
            textAnchor="middle"
            className="text-[9px] font-mono font-bold"
            fill={ACCENT_CYAN}
            opacity={0.8}
          >
            Forward
          </text>

          {/* Target center */}
          <circle
            cx={SVG_CENTER} cy={SVG_CENTER}
            r={8}
            fill={ACCENT_CYAN}
            fillOpacity={0.15}
            stroke={ACCENT_CYAN}
            strokeWidth={1.5}
          />
          <line x1={SVG_CENTER - 5} y1={SVG_CENTER} x2={SVG_CENTER + 5} y2={SVG_CENTER} stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.6} />
          <line x1={SVG_CENTER} y1={SVG_CENTER - 5} x2={SVG_CENTER} y2={SVG_CENTER + 5} stroke={ACCENT_CYAN} strokeWidth={1.5} opacity={0.6} />
          <text
            x={SVG_CENTER} y={SVG_CENTER + 18}
            textAnchor="middle"
            className="text-[8px] font-mono" fill={ACCENT_CYAN} opacity={0.7}
          >
            Player
          </text>

          {/* Squad members */}
          {result.members.map(member => {
            const sx = SVG_CENTER + member.position.x * scale;
            const sy = SVG_CENTER + member.position.y * scale;
            const color = ROLE_COLORS[member.role];
            const isHovered = hoveredMember === member.id;
            const baseR = 7;
            const r = isHovered ? baseR + 3 : baseR;

            return (
              <g
                key={member.id}
                onPointerEnter={() => setHoveredMember(member.id)}
                onPointerLeave={() => setHoveredMember(null)}
                data-testid={`squad-member-${member.id}`}
              >
                {/* Connection line to center */}
                <line
                  x1={SVG_CENTER} y1={SVG_CENTER}
                  x2={sx} y2={sy}
                  stroke={color}
                  strokeWidth={isHovered ? 1.5 : 0.8}
                  opacity={isHovered ? 0.5 : 0.2}
                  strokeDasharray="3 3"
                />

                {/* Flank angle indicator arc */}
                {isHovered && (
                  <circle
                    cx={sx} cy={sy} r={14}
                    fill="none" stroke={flankColor(member.flankAngle)}
                    strokeWidth={2} opacity={0.6}
                  />
                )}

                {/* Member dot */}
                <circle
                  cx={sx} cy={sy} r={r}
                  fill={color}
                  fillOpacity={0.9}
                  stroke="var(--surface-deep)"
                  strokeWidth={2}
                  className="cursor-pointer transition-all"
                />

                {/* Role initial */}
                <text
                  x={sx} y={sy + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[8px] font-mono font-bold fill-[var(--surface-deep)]"
                  style={{ pointerEvents: 'none' }}
                >
                  {member.role[0].toUpperCase()}
                </text>

                {/* Label on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={sx + 12} y={sy - 20}
                      width={90} height={36}
                      rx={4}
                      fill="var(--surface-deep)"
                      stroke={color}
                      strokeWidth={0.5}
                      opacity={0.95}
                    />
                    <text x={sx + 16} y={sy - 8}
                      className="text-[8px] font-mono font-bold" fill={color}
                    >
                      {member.label}
                    </text>
                    <text x={sx + 16} y={sy + 2}
                      className="text-[7px] font-mono fill-[var(--text-muted)]"
                    >
                      Flank: {member.flankAngle.toFixed(0)}° | {member.distance.toFixed(0)} UU
                    </text>
                    <text x={sx + 16} y={sy + 12}
                      className="text-[7px] font-mono fill-[var(--text-muted)]"
                    >
                      Score: {(member.score * 100).toFixed(0)}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Legend */}
          {(() => {
            const uniqueRoles = [...new Set(result.members.map(m => m.role))];
            return uniqueRoles.map((role, i) => (
              <g key={role}>
                <circle
                  cx={12} cy={SVG_SIZE - 12 - i * 14}
                  r={4}
                  fill={ROLE_COLORS[role]}
                  fillOpacity={0.9}
                />
                <text
                  x={20} y={SVG_SIZE - 12 - i * 14}
                  dominantBaseline="central"
                  className="text-[8px] font-mono fill-[var(--text-muted)]"
                >
                  {ROLE_DEFINITIONS[role].label}
                </text>
              </g>
            ));
          })()}
        </svg>
      </SurfaceCard>

      {/* Side panel: member details */}
      <div className="flex-1 space-y-2 min-w-0">
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Squad Members</h4>
          <div className="space-y-1.5">
            {result.members.map(member => {
              const RoleIcon = ROLE_ICONS[member.role];
              const color = ROLE_COLORS[member.role];
              const isHovered = hoveredMember === member.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
                  style={{
                    backgroundColor: isHovered ? `${color}${OPACITY_10}` : 'transparent',
                    border: `1px solid ${isHovered ? `${color}30` : 'transparent'}`,
                  }}
                  onPointerEnter={() => setHoveredMember(member.id)}
                  onPointerLeave={() => setHoveredMember(null)}
                  data-testid={`squad-member-row-${member.id}`}
                >
                  <RoleIcon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                  <span className="text-xs font-bold text-text flex-1 min-w-0 truncate">{member.label}</span>
                  <span className="text-2xs font-mono shrink-0" style={{ color: flankColor(member.flankAngle) }}>
                    {member.flankAngle.toFixed(0)}°
                  </span>
                  <span className="text-2xs font-mono text-text-muted shrink-0">{member.distance.toFixed(0)} UU</span>
                  <div className="w-10 h-2 bg-surface-deep/50 rounded-sm overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-sm"
                      style={{ backgroundColor: color, width: `${member.score * 100}%`, opacity: 0.8 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Role descriptions */}
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Role EQS Composition</h4>
          <div className="space-y-1.5">
            {config.formation.roles.map(({ role }) => {
              const def = ROLE_DEFINITIONS[role];
              const color = ROLE_COLORS[role];
              return (
                <div key={role} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-2xs font-bold text-text">{def.label}</span>
                    <span className="text-2xs text-text-muted ml-auto">{def.engagementRange[0]}-{def.engagementRange[1]} UU</span>
                  </div>
                  <div className="flex items-center gap-1 ml-3.5 flex-wrap">
                    {[...def.generators, ...def.tests].map((t, i) => (
                      <span
                        key={i}
                        className="text-2xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${color}${OPACITY_10}`,
                          color,
                          border: `1px solid ${color}20`,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Interaction hint */}
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
          style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Drag the cyan arrow to rotate the target&apos;s forward direction.
            The AI Director reallocates positions by priority: high-priority roles
            (Tank, Aggressor) claim first, then Flankers and Support adjust around them.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── EQS Pipeline View ────────────────────────────────────────────────────── */

function PipelineView({ result }: { result: ReturnType<typeof runSquadSimulation> }) {
  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="squad-pipeline-view">
      <div className="px-4 py-3 border-b border-border/40">
        <h4 className="text-sm font-bold text-text font-mono">Composed EQS Pipeline</h4>
        <p className="text-2xs text-text-muted">
          The AI Director composes individual EQS queries into a coordinated squad pipeline.
          Unlike isolated queries, each member&apos;s allocation considers ally positions.
        </p>
      </div>

      {/* Flow summary */}
      <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-1 flex-wrap">
        {result.composedPipeline.map((step, i) => {
          const color = STEP_KIND_COLORS[step.kind] ?? ACCENT;
          return (
            <div key={i} className="flex items-center gap-1">
              <span
                className="text-2xs font-mono px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${color}${OPACITY_10}`,
                  color,
                  border: `1px solid ${color}30`,
                }}
              >
                {step.label}
              </span>
              {i < result.composedPipeline.length - 1 && (
                <ArrowRight className="w-3 h-3 text-text-muted" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step details */}
      <div className="p-3 space-y-1.5">
        {result.composedPipeline.map((step, i) => {
          const color = STEP_KIND_COLORS[step.kind] ?? ACCENT;
          const kindLabel = step.kind === 'test-score' ? 'Score' : step.kind === 'test-filter' ? 'Filter' : step.kind.charAt(0).toUpperCase() + step.kind.slice(1);

          return (
            <div key={i}>
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: `${color}30` }}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-bold text-text">{step.label}</span>
                  <span
                    className="text-2xs font-medium px-1.5 py-0.5 rounded ml-auto shrink-0"
                    style={{ color, backgroundColor: `${color}${OPACITY_15}` }}
                  >
                    {kindLabel}
                  </span>
                </div>
                <div className="px-3 pb-2 space-y-0.5">
                  {step.cppClass && (
                    <p className="text-2xs font-mono" style={{ color }}>{step.cppClass}</p>
                  )}
                  <p className="text-2xs text-text-muted">{step.description}</p>
                </div>
              </div>
              {i < result.composedPipeline.length - 1 && (
                <div className="flex items-center justify-center py-0.5">
                  <ArrowRight className="w-3.5 h-3.5" style={{ color: STEP_KIND_COLORS[result.composedPipeline[i + 1].kind] ?? ACCENT }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Key insight */}
      <div className="mx-3 mb-3">
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
          style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT }}
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Key difference from standard EQS:</strong> The <code className="font-mono">AllySeparation</code> test
            and <code className="font-mono">Director Allocate</code> step make this pipeline squad-aware.
            Positions are allocated sequentially by role priority, so each member&apos;s query
            incorporates previously allocated ally positions as additional scoring context.
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
}

/* ── UE5 Code Generation View ─────────────────────────────────────────────── */

function CodeGenView({ config }: { config: DirectorConfig }) {
  const code = useMemo(() => {
    const roleEntries = config.formation.roles
      .map(({ role, count }) => `    { ESquadRole::${role.charAt(0).toUpperCase() + role.slice(1)}, ${count} }`)
      .join(',\n');

    return `// ── UARPGSquadDirector.h ──────────────────────────────────────────────
// AI Director that composes EQS queries across a squad for coordinated tactics.
// Generated for "${config.formation.name}" formation.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "EnvironmentQuery/EnvQueryManager.h"
#include "UARPGSquadDirector.generated.h"

UENUM(BlueprintType)
enum class ESquadRole : uint8
{
    Aggressor   UMETA(DisplayName = "Aggressor"),
    Flanker     UMETA(DisplayName = "Flanker"),
    Support     UMETA(DisplayName = "Support"),
    Tank        UMETA(DisplayName = "Tank"),
    Ambusher    UMETA(DisplayName = "Ambusher"),
};

USTRUCT(BlueprintType)
struct FSquadRoleAssignment
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    ESquadRole Role = ESquadRole::Aggressor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Count = 1;
};

USTRUCT(BlueprintType)
struct FSquadFormation
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName FormationName = TEXT("${config.formation.name}");

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FSquadRoleAssignment> Roles = {
${roleEntries}
    };

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float AttackDistance = ${config.attackDistance}.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float FlankWeight = ${config.flankWeight.toFixed(2)}f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float SeparationWeight = ${config.separationWeight.toFixed(2)}f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float RangeWeight = ${config.rangeWeight.toFixed(2)}f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MinSeparation = ${config.minSeparation}.0f;
};

UCLASS()
class UARPGSquadDirector : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    /** Register a squad of AI controllers for coordinated positioning. */
    UFUNCTION(BlueprintCallable, Category = "AI|Squad")
    void RegisterSquad(
        FName SquadId,
        const TArray<AAIController*>& Members,
        const FSquadFormation& Formation
    );

    /**
     * Allocate positions for the entire squad.
     * Runs EQS queries sequentially by role priority:
     *   Tank/Aggressor first → Flanker → Support/Ambusher
     * Each query includes an AllySeparation test scored against
     * previously allocated positions.
     */
    UFUNCTION(BlueprintCallable, Category = "AI|Squad")
    void AllocateSquadPositions(FName SquadId, AActor* TargetActor);

    /** Get the allocated position for a specific squad member. */
    UFUNCTION(BlueprintPure, Category = "AI|Squad")
    FVector GetAllocatedPosition(AAIController* Member) const;

    /** Get the role assigned to a member. */
    UFUNCTION(BlueprintPure, Category = "AI|Squad")
    ESquadRole GetMemberRole(AAIController* Member) const;

private:
    /** Compose EQS query for a role with ally-awareness. */
    UEnvQuery* ComposeQueryForRole(
        ESquadRole Role,
        const TArray<FVector>& AllocatedPositions
    ) const;

    /** Score a candidate position for the given role. */
    float ScorePosition(
        const FVector& Candidate,
        ESquadRole Role,
        const FVector& TargetForward,
        const TArray<FVector>& AllocatedPositions,
        const FSquadFormation& Formation
    ) const;

    TMap<FName, TArray<AAIController*>> Squads;
    TMap<FName, FSquadFormation> SquadFormations;
    TMap<AAIController*, FVector> AllocatedPositions;
    TMap<AAIController*, ESquadRole> MemberRoles;
};`;
  }, [config]);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="squad-codegen-view">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT}${OPACITY_10}` }}
        >
          <Users className="w-4 h-4" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">UE5 C++ Preview</h3>
          <p className="text-2xs text-text-muted">
            <code className="font-mono">UARPGSquadDirector</code> — WorldSubsystem for squad-level EQS composition
          </p>
        </div>
        <span
          className="text-2xs font-mono px-2 py-1 rounded"
          style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT }}
        >
          {config.formation.name} Formation
        </span>
      </div>

      <div className="overflow-x-auto">
        <pre className="p-4 text-2xs font-mono text-text leading-relaxed whitespace-pre">
          {code}
        </pre>
      </div>
    </SurfaceCard>
  );
}
