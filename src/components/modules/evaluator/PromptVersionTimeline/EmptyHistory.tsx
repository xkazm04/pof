import { History } from 'lucide-react';

export function EmptyHistory({ prompt = false }: { prompt?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <History className="w-8 h-8 text-text-muted/30 mb-3" />
      <p className="text-sm font-medium text-text-muted mb-1">
        {prompt ? 'Pick a checklist item' : 'No version history'}
      </p>
      <p className="text-xs text-text-muted/70 max-w-xs">
        {prompt
          ? 'Choose an item above to browse its lineage, compare versions, and roll back.'
          : 'Create variants and mutations for this item to build a version timeline.'}
      </p>
    </div>
  );
}
