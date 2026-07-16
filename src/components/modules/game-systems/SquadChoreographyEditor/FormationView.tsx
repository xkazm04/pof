import { useState, useCallback } from 'react';
import { Info } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_VIOLET, ACCENT_CYAN, STATUS_WARNING, OPACITY_10,
} from '@/lib/chart-colors';
import type { DirectorConfig, DirectorResult } from '@/types/squad-tactics';
import { ROLE_DEFINITIONS } from '@/lib/ai-director/squad-engine';
import {
  ROLE_COLORS, SVG_SIZE, SVG_CENTER, DRAW_RADIUS,
} from './constants';
import { SquadMemberGlyph } from './SquadMemberGlyph';
import { SquadMemberRow } from './SquadMemberRow';

/* ── Formation SVG View ───────────────────────────────────────────────────── */

export function FormationView({
  config, result,
  isDragging, svgRef, scale, arrowEndX, arrowEndY,
  onPointerDown, onPointerUp, onPointerMove,
}: {
  config: DirectorConfig;
  result: DirectorResult;
  isDragging: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  scale: number;
  arrowEndX: number;
  arrowEndY: number;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
}) {
  // Hover lives here (not in the parent editor) so highlighting a member only
  // re-renders the two affected memoized leaves — the static SVG subtree (grid,
  // compass, forward arrow, legend) and the unrelated members/rows are skipped.
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  // Stable identity so the memoized leaves don't re-render just because the
  // setter prop changed each render.
  const handleEnter = useCallback((id: string) => setHoveredMember(id), []);
  const handleLeave = useCallback(() => setHoveredMember(null), []);

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
          onPointerCancel={onPointerUp}
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
                className="text-[11px] font-mono fill-[var(--text-muted)]"
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
            className="text-[11px] font-mono font-bold"
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
            className="text-[11px] font-mono" fill={ACCENT_CYAN} opacity={0.7}
          >
            Player
          </text>

          {/* Squad members */}
          {result.members.map(member => (
            <SquadMemberGlyph
              key={member.id}
              member={member}
              scale={scale}
              isHovered={hoveredMember === member.id}
              onEnter={handleEnter}
              onLeave={handleLeave}
            />
          ))}

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
                  className="text-[11px] font-mono fill-[var(--text-muted)]"
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
            {result.members.map(member => (
              <SquadMemberRow
                key={member.id}
                member={member}
                isHovered={hoveredMember === member.id}
                onEnter={handleEnter}
                onLeave={handleLeave}
              />
            ))}
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
