import { memo } from 'react';
import { OPACITY_10 } from '@/lib/chart-colors';
import type { SquadMember } from '@/types/squad-tactics';
import { ROLE_COLORS, ROLE_ICONS } from './constants';
import { flankColor } from './helpers';

export const SquadMemberRow = memo(function SquadMemberRow({
  member, isHovered, onEnter, onLeave,
}: {
  member: SquadMember;
  isHovered: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
}) {
  const RoleIcon = ROLE_ICONS[member.role];
  const color = ROLE_COLORS[member.role];

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
      style={{
        backgroundColor: isHovered ? `${color}${OPACITY_10}` : 'transparent',
        border: `1px solid ${isHovered ? `${color}30` : 'transparent'}`,
      }}
      onPointerEnter={() => onEnter(member.id)}
      onPointerLeave={onLeave}
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
});
