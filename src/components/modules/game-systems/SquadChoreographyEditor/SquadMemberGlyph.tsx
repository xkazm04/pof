import { memo } from 'react';
import type { SquadMember } from '@/types/squad-tactics';
import { ROLE_COLORS, SVG_CENTER } from './constants';
import { flankColor } from './helpers';

/* ── Memoized member leaves ───────────────────────────────────────────────────
   Hover is a purely visual O(1) change. By memoizing each glyph/row and feeding
   it an `isHovered` boolean, only the previously- and newly-hovered member
   re-render on a hover change; every other member, the static SVG subtree and
   the side panels are skipped. Identical markup to the former inline maps. */

export const SquadMemberGlyph = memo(function SquadMemberGlyph({
  member, scale, isHovered, onEnter, onLeave,
}: {
  member: SquadMember;
  scale: number;
  isHovered: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
}) {
  const sx = SVG_CENTER + member.position.x * scale;
  const sy = SVG_CENTER + member.position.y * scale;
  const color = ROLE_COLORS[member.role];
  const baseR = 7;
  const r = isHovered ? baseR + 3 : baseR;

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
        className="text-[11px] font-mono font-bold fill-[var(--surface-deep)]"
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
            className="text-[11px] font-mono font-bold" fill={color}
          >
            {member.label}
          </text>
          <text x={sx + 16} y={sy + 2}
            className="text-[11px] font-mono fill-[var(--text-muted)]"
          >
            Flank: {member.flankAngle.toFixed(0)}° | {member.distance.toFixed(0)} UU
          </text>
          <text x={sx + 16} y={sy + 12}
            className="text-[11px] font-mono fill-[var(--text-muted)]"
          >
            Score: {(member.score * 100).toFixed(0)}%
          </text>
        </g>
      )}
    </g>
  );
});
