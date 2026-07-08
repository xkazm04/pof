import type { ComponentKind, EQSComponentDef } from './types';
import { KIND_META } from './constants';
import { ComponentCard } from './ComponentCard';

export function GroupSection({ kind, components }: { kind: ComponentKind; components: EQSComponentDef[] }) {
  const km = KIND_META[kind];
  const KindIcon = km.icon;

  if (components.length === 0) return null;

  return (
    <div className="space-y-2" data-testid={`eqs-group-${kind}`}>
      <div className="flex items-center gap-2">
        <span style={{ color: km.color }}><KindIcon className="w-3.5 h-3.5" /></span>
        <h3 className="text-xs font-bold text-text">{km.label}s</h3>
        <span className="text-2xs text-text-muted">({components.length})</span>
      </div>
      <div className="space-y-1.5">
        {components.map((c) => (
          <ComponentCard key={c.id} comp={c} />
        ))}
      </div>
    </div>
  );
}
