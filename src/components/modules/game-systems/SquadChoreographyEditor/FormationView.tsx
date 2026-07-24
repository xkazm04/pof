import { useState, useCallback, useRef, useId } from 'react';
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
import { compassDeg, compassCardinal } from './helpers';
import { SquadMemberGlyph } from './SquadMemberGlyph';
import { SquadMemberRow } from './SquadMemberRow';

/** Keyboard rotation steps for the forward handle (degrees): fine, and Shift-coarse. */
const ANGLE_STEP_DEG = 5;
const ANGLE_STEP_COARSE_DEG = 15;
const DEG_TO_RAD = Math.PI / 180;

/* ── Formation SVG View ───────────────────────────────────────────────────── */

export function FormationView({
  config, result,
  isDragging, svgRef, scale, arrowEndX, arrowEndY,
  onPointerDown, onPointerUp, onPointerMove, onAngleChange,
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
  /** Set the target forward angle (radians) — the keyboard path into the drag handle. */
  onAngleChange: (angle: number) => void;
}) {
  // Hover lives here (not in the parent editor) so highlighting a member only
  // re-renders the two affected memoized leaves — the static SVG subtree (grid,
  // compass, forward arrow, legend) and the unrelated members/rows are skipped.
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  // Keyboard focus is tracked separately from hover: it both highlights the
  // matching glyph and owns the list's single tab stop (roving tabindex).
  const [focusedMember, setFocusedMember] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Generated (not hardcoded) so two mounted editors can't collide on the id —
  // same approach as PipelineView's region heading.
  const membersHeadingId = useId();
  // Stable identity so the memoized leaves don't re-render just because the
  // setter prop changed each render.
  const handleEnter = useCallback((id: string) => setHoveredMember(id), []);
  const handleLeave = useCallback(() => setHoveredMember(null), []);
  const handleFocus = useCallback((id: string) => setFocusedMember(id), []);
  const handleBlur = useCallback(() => setFocusedMember(null), []);

  // Pointer wins over focus when both are live, so moving the mouse always
  // highlights what it is pointing at.
  const activeMember = hoveredMember ?? focusedMember;
  // Exactly one row is tabbable — the focused one while focus is inside the
  // list, otherwise the first. So Tab reaches the list in one stop instead of
  // stepping through every member, and ↑/↓ move within it.
  const tabStopId = focusedMember ?? result.members[0]?.id ?? null;

  const forwardBearing = compassDeg(config.targetForwardAngle);

  // Arrow keys rotate the forward vector; Shift takes coarse 15° steps and Home
  // snaps back to north — the same reachability the pointer drag already had.
  const handleForwardKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGCircleElement>) => {
      let deltaDeg = 0;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          deltaDeg = e.shiftKey ? ANGLE_STEP_COARSE_DEG : ANGLE_STEP_DEG;
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          deltaDeg = e.shiftKey ? -ANGLE_STEP_COARSE_DEG : -ANGLE_STEP_DEG;
          break;
        case 'Home':
          e.preventDefault();
          onAngleChange(-Math.PI / 2);
          return;
        default:
          return;
      }
      e.preventDefault();
      onAngleChange(config.targetForwardAngle + deltaDeg * DEG_TO_RAD);
    },
    [config.targetForwardAngle, onAngleChange],
  );

  // Roving-tabindex navigation over the member options. Delegated on the
  // listbox so each memoized row needs no key handler of its own.
  const handleListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    if (options.length === 0) return;
    const current = options.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (e.key) {
      case 'ArrowDown': next = current + 1; break;
      case 'ArrowUp': next = current - 1; break;
      case 'Home': next = 0; break;
      case 'End': next = options.length - 1; break;
      default: return;
    }
    e.preventDefault();
    options[((next % options.length) + options.length) % options.length].focus();
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* SVG diagram */}
      <SurfaceCard className="p-0 overflow-hidden flex-shrink-0">
        {/* `role="group"` (not `img`) — the diagram holds a focusable control, and
            `img` would make its subtree presentational and hide the handle. */}
        <svg
          ref={svgRef}
          role="group"
          aria-label={`Formation diagram: ${result.members.length} squad members around the target, forward direction ${forwardBearing.toFixed(0)} degrees`}
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

          {/* Drag handle — also a keyboard slider: focusable, arrow-key rotatable,
              and reporting its bearing so it is operable and readable without a
              pointer. `focus-ring-outline` uses `outline`, which (unlike the
              box-shadow rings) renders on SVG elements. */}
          <circle
            cx={arrowEndX} cy={arrowEndY}
            r={10}
            fill={ACCENT_CYAN}
            fillOpacity={0.15}
            stroke={ACCENT_CYAN}
            strokeWidth={1.5}
            className="cursor-grab focus-ring-outline"
            tabIndex={0}
            role="slider"
            aria-label="Target forward direction"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(forwardBearing)}
            aria-valuetext={`${forwardBearing.toFixed(0)} degrees, ${compassCardinal(forwardBearing)}`}
            onPointerDown={onPointerDown}
            onKeyDown={handleForwardKeyDown}
            data-testid="squad-forward-drag"
          />
          <text
            x={SVG_CENTER + Math.cos(config.targetForwardAngle) * (DRAW_RADIUS * 0.45)}
            y={SVG_CENTER + Math.sin(config.targetForwardAngle) * (DRAW_RADIUS * 0.45) - 8}
            textAnchor="middle"
            className="text-[11px] font-mono font-bold"
            fill={ACCENT_CYAN}
            opacity={0.8}
            aria-hidden="true"
          >
            Forward {forwardBearing.toFixed(0)}°
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
              isActive={activeMember === member.id}
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
          <h4 className="text-xs font-bold text-text" id={membersHeadingId}>Squad Members</h4>
          {/* Listbox + roving tabindex: the per-member detail that the SVG only
              reveals on hover is reachable here by Tab, then ↑/↓/Home/End. */}
          <div
            ref={listRef}
            role="listbox"
            aria-labelledby={membersHeadingId}
            onKeyDown={handleListKeyDown}
            className="space-y-1.5"
            data-testid="squad-member-list"
          >
            {result.members.map(member => (
              <SquadMemberRow
                key={member.id}
                member={member}
                isActive={activeMember === member.id}
                tabIndex={tabStopId === member.id ? 0 : -1}
                onEnter={handleEnter}
                onLeave={handleLeave}
                onFocus={handleFocus}
                onBlur={handleBlur}
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
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Drag the cyan arrow to rotate the target&apos;s forward direction — or focus
            it and use <kbd className="font-mono">←</kbd>/<kbd className="font-mono">→</kbd>{' '}
            ({ANGLE_STEP_DEG}° steps, <kbd className="font-mono">Shift</kbd> for{' '}
            {ANGLE_STEP_COARSE_DEG}°, <kbd className="font-mono">Home</kbd> to face north).
            The AI Director reallocates positions by priority: high-priority roles
            (Tank, Aggressor) claim first, then Flankers and Support adjust around them.
          </span>
        </div>
      </div>
    </div>
  );
}
