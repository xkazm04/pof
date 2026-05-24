'use client';

import { Box } from 'lucide-react';

/**
 * Empty-state shown by EntityInspector when no entity is selected.
 */
export function EmptyInspector() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-2 p-8">
      <Box className="w-8 h-8 opacity-50" />
      <p className="text-sm">Select an entity from a catalog to inspect.</p>
    </div>
  );
}
