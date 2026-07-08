import { GripVertical, MousePointerClick, Sword, Shield, Zap } from 'lucide-react';
import type { InteractionMode } from '@/lib/prompts/inventory';
import { STATUS_STALE } from '@/lib/chart-colors';

export function InteractionIcon({ id, enabled }: { id: InteractionMode; enabled: boolean }) {
  const color = enabled ? STATUS_STALE : 'rgba(167,139,250,0.4)';
  const iconClass = `w-4 h-4 flex-shrink-0 transition-colors ${enabled ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`;

  switch (id) {
    case 'drag-drop':
      return <GripVertical className={iconClass} style={{ color }} />;
    case 'right-click-use':
      return <MousePointerClick className={iconClass} style={{ color }} />;
    case 'shift-click-split':
      return <Sword className={iconClass} style={{ color }} />;
    case 'double-click-equip':
      return <Shield className={iconClass} style={{ color }} />;
    case 'ctrl-click-move':
      return <Zap className={iconClass} style={{ color }} />;
    default:
      return null;
  }
}
