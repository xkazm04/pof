import { withOpacity, OPACITY_8, OPACITY_12 } from '@/lib/chart-colors';
import { ENTITY_STYLES } from './constants';
import type { InlineEntity } from './types';

export function EntityTags({ entities, onNavigate }: {
  entities: InlineEntity[];
  onNavigate?: (moduleId: string) => void;
}) {
  if (entities.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1 ml-5">
      {entities.map((e, i) => {
        const style = ENTITY_STYLES[e.type];
        const Icon = style.icon;
        return (
          <span
            key={`${e.type}-${e.value}-${i}`}
            className="inline-flex items-center gap-1 px-1.5 py-px rounded text-2xs cursor-default hover:brightness-125 transition-all"
            style={{ backgroundColor: withOpacity(style.color, OPACITY_8), color: style.color, border: `1px solid ${withOpacity(style.color, OPACITY_12)}` }}
            title={e.type === 'warning' ? e.value : `${e.type}: ${e.value}`}
            onClick={() => e.moduleId && onNavigate?.(e.moduleId)}
          >
            <Icon className="w-2.5 h-2.5" />
            <span className="max-w-[160px] truncate">{e.value}</span>
          </span>
        );
      })}
    </div>
  );
}
