import { Tag } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';

export function VersionPanel({ version, onBump }: { version: string; onBump: (type: 'major' | 'minor' | 'patch') => void }) {
  return (
    <div className="rounded border border-border bg-surface-deep/80 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Tag className="w-3 h-3" style={{ color: MODULE_COLORS.systems }} />
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Version</span>
      </div>
      <div className="text-lg font-bold text-text font-mono mb-2">v{version}</div>
      <div className="flex items-center gap-1.5">
        {(['patch', 'minor', 'major'] as const).map((type) => (
          <button
            key={type}
            onClick={() => onBump(type)}
            className="flex-1 py-1 rounded text-2xs font-medium text-text-muted bg-surface-hover hover:bg-border-bright hover:text-text transition-colors capitalize"
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}
