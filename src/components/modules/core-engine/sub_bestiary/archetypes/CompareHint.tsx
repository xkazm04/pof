'use client';

import type { ArchetypeConfig } from '../_shared/data';

interface CompareHintProps {
  compareIds: string[];
  compareArchetypes: ArchetypeConfig[];
  toggleCompare: (id: string) => void;
}

export function CompareHint({ compareIds, compareArchetypes, toggleCompare }: CompareHintProps) {
  if (compareIds.length === 0) {
    return <p className="text-xs text-text-muted">Click enemies to compare (up to 4)</p>;
  }
  return (
    <div className="text-sm text-text-muted mb-2">
      Comparing <strong>{compareIds.length}</strong> enemies (max 4).
      {compareArchetypes.map(a => (
        <span key={a.id} className="inline-flex items-center gap-1 ml-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
          <span className="font-bold" style={{ color: a.color }}>{a.label}</span>
        </span>
      ))}
      <button onClick={() => { for (const id of compareIds) toggleCompare(id); }}
        className="ml-2 text-xs text-text-muted underline hover:text-text cursor-pointer">
        Clear
      </button>
    </div>
  );
}
