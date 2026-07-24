import { memo } from 'react';
import { OPACITY_10 } from '@/lib/chart-colors';
import type { SquadMember } from '@/types/squad-tactics';
import { ROLE_DEFINITIONS } from '@/lib/ai-director/squad-engine';
import { ROLE_COLORS, ROLE_ICONS } from './constants';
import { flankColor } from './helpers';

export const SquadMemberRow = memo(function SquadMemberRow({
  member, isActive, tabIndex, onEnter, onLeave, onFocus, onBlur,
}: {
  member: SquadMember;
  isActive: boolean;
  /** Roving tabindex: 0 for the list's single tab stop, -1 for every other row. */
  tabIndex: number;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onFocus: (id: string) => void;
  onBlur: () => void;
}) {
  const RoleIcon = ROLE_ICONS[member.role];
  const color = ROLE_COLORS[member.role];

  // The score bar and the color-coded flank angle carry meaning visually only,
  // so the option spells the full reading out for assistive tech.
  const label =
    `${member.label}, ${ROLE_DEFINITIONS[member.role].label} — ` +
    `flank ${member.flankAngle.toFixed(0)} degrees, ` +
    `${member.distance.toFixed(0)} UU from target, ` +
    `score ${(member.score * 100).toFixed(0)}%`;

  return (
    <div
      role="option"
      aria-selected={isActive}
      aria-label={label}
      tabIndex={tabIndex}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-default focus-ring-outline"
      style={{
        backgroundColor: isActive ? `${color}${OPACITY_10}` : 'transparent',
        border: `1px solid ${isActive ? `${color}30` : 'transparent'}`,
      }}
      onPointerEnter={() => onEnter(member.id)}
      onPointerLeave={onLeave}
      onFocus={() => onFocus(member.id)}
      onBlur={onBlur}
      data-testid={`squad-member-row-${member.id}`}
    >
      {/* Values below are duplicated in the option's aria-label above, so the
          row's own text is hidden to avoid announcing every figure twice. */}
      <RoleIcon className="w-3.5 h-3.5 shrink-0" style={{ color }} aria-hidden="true" />
      <span aria-hidden="true" className="text-xs font-bold text-text flex-1 min-w-0 truncate">{member.label}</span>
      <span aria-hidden="true" className="text-2xs font-mono shrink-0" style={{ color: flankColor(member.flankAngle) }}>
        {member.flankAngle.toFixed(0)}°
      </span>
      <span aria-hidden="true" className="text-2xs font-mono text-text-muted shrink-0">{member.distance.toFixed(0)} UU</span>
      <div aria-hidden="true" className="w-10 h-2 bg-surface-deep/50 rounded-sm overflow-hidden shrink-0">
        <div
          className="h-full rounded-sm"
          style={{ backgroundColor: color, width: `${member.score * 100}%`, opacity: 0.8 }}
        />
      </div>
    </div>
  );
});
