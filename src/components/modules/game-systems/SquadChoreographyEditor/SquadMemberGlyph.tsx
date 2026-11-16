import { memo } from 'react';
import type { SquadMember } from '@/types/squad-tactics';
import { ROLE_COLORS, SVG_CENTER, SVG_SIZE } from './constants';
import { flankColor } from './helpers';

/* ── Memoized member leaves ───────────────────────────────────────────────────
   Highlighting a member is a purely visual O(1) change. By memoizing each
   glyph/row and feeding it an `isActive` boolean, only the previously- and
   newly-active member re-render; every other member, the static SVG subtree and
   the side panels are skipped. "Active" is hover OR keyboard focus of the
   matching row, so the same detail callout is reachable without a pointer. */

/** Callout geometry: 11px monospace advances ~0.6em per glyph; 4px inner padding. */
const CALLOUT_CHAR_PX = 0.6 * 11;
const CALLOUT_PAD = 4;
const CALLOUT_HEIGHT = 36;
const CALLOUT_GAP = 12;

export const SquadMemberGlyph = memo(function SquadMemberGlyph({
  member, scale, isActive, onEnter, onLeave,
}: {
  member: SquadMember;
  scale: number;
  isActive: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
}) {
  const sx = SVG_CENTER + member.position.x * scale;
  const sy = SVG_CENTER + member.position.y * scale;
  const color = ROLE_COLORS[member.role];
  const baseR = 7;
  const r = isActive ? baseR + 3 : baseR;

  // The callout is sized from its own lines (a fixed 90px box clipped the
  // ~20-char flank/distance line) and flips left / clamps vertically so a
  // member near the canvas edge keeps its callout on the canvas.
  const calloutLines = [
    member.label,
    `Flank: ${member.flankAngle.toFixed(0)}° | ${member.distance.toFixed(0)} UU`,
    `Score: ${(member.score * 100).toFixed(0)}%`,
  ];
  const calloutW = Math.ceil(Math.max(...calloutLines.map((l) => l.length)) * CALLOUT_CHAR_PX) + CALLOUT_PAD * 2;
  const rightX = sx + CALLOUT_GAP;
  const calloutX = rightX + calloutW <= SVG_SIZE
    ? rightX
    : Math.max(0, sx - CALLOUT_GAP - calloutW);
  const calloutY = Math.min(Math.max(sy - 20, 0), SVG_SIZE - CALLOUT_HEIGHT);

  return (
    <g
      onPointerEnter={() => onEnter(member.id)}
      onPointerLeave={onLeave}
      data-testid={`squad-member-${member.id}`}
    >
      {/* Connection line to center */}
      <line
        x1={SVG_CENTER} y1={SVG_CENTER}
        x2={sx} y2={sy}
        stroke={color}
        strokeWidth={isActive ? 1.5 : 0.8}
        opacity={isActive ? 0.5 : 0.2}
        strokeDasharray="3 3"
      />

      {/* Flank angle indicator arc */}
      {isActive && (
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
        className="text-[11px] font-mono font-bold fill-[var(--surface-deep)]"
        style={{ pointerEvents: 'none' }}
      >
        {member.role[0].toUpperCase()}
      </text>

      {/* Detail callout — shown while hovered or while the matching row has focus.
          Decorative for AT: the row itself carries the same values in its label. */}
      {isActive && (
        <g>
          <rect
            x={calloutX} y={calloutY}
            width={calloutW} height={CALLOUT_HEIGHT}
            rx={4}
            fill="var(--surface-deep)"
            stroke={color}
            strokeWidth={0.5}
            opacity={0.95}
          />
          <text x={calloutX + CALLOUT_PAD} y={calloutY + 12}
            className="text-[11px] font-mono font-bold" fill={color}
          >
            {calloutLines[0]}
          </text>
          <text x={calloutX + CALLOUT_PAD} y={calloutY + 22}
            className="text-[11px] font-mono fill-[var(--text-muted)]"
          >
            {calloutLines[1]}
          </text>
          <text x={calloutX + CALLOUT_PAD} y={calloutY + 32}
            className="text-[11px] font-mono fill-[var(--text-muted)]"
          >
            {calloutLines[2]}
          </text>
        </g>
      )}
    </g>
  );
});
