import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { PropertyWatchRequest } from '@/types/ue5-bridge';

// ── Property watch form ───────────────────────────────────────────────────

export function PropertyWatchForm({ onAdd }: { onAdd: (req: PropertyWatchRequest) => void }) {
  const [objectPath, setObjectPath] = useState('');
  const [propertyName, setPropertyName] = useState('');

  const handleAdd = useCallback(() => {
    if (!objectPath.trim() || !propertyName.trim()) return;
    onAdd({
      watchId: `watch-${Date.now()}`,
      objectPath: objectPath.trim(),
      propertyName: propertyName.trim(),
      intervalMs: 500,
    });
    setObjectPath('');
    setPropertyName('');
  }, [objectPath, propertyName, onAdd]);

  return (
    <div className="flex items-end gap-1.5">
      <div className="flex-1">
        <label htmlFor="lss-watch-object-path" className="text-2xs font-bold text-text-muted uppercase tracking-wider">Object Path</label>
        <input
          id="lss-watch-object-path"
          type="text"
          value={objectPath}
          onChange={(e) => setObjectPath(e.target.value)}
          placeholder="/Game/BP_Player.BP_Player_C"
          className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      <div className="w-32">
        <label htmlFor="lss-watch-property" className="text-2xs font-bold text-text-muted uppercase tracking-wider">Property</label>
        <input
          id="lss-watch-property"
          type="text"
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
          placeholder="MaxHealth"
          className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      <button
        onClick={handleAdd}
        disabled={!objectPath.trim() || !propertyName.trim()}
        className="px-2 py-1 rounded text-xs font-bold border transition-colors disabled:opacity-40"
        style={{ borderColor: `${ACCENT_EMERALD}40`, color: ACCENT_EMERALD }}
        aria-label="Add property watch"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}
