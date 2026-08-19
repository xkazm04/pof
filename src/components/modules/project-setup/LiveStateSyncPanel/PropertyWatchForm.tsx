import { useState, useCallback, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { PropertyWatchRequest } from '@/types/ue5-bridge';

// ── Property watch form ───────────────────────────────────────────────────

export function PropertyWatchForm({ onAdd }: { onAdd: (req: PropertyWatchRequest) => void }) {
  const [objectPath, setObjectPath] = useState('');
  const [propertyName, setPropertyName] = useState('');

  const hasPath = objectPath.trim().length > 0;
  const hasProperty = propertyName.trim().length > 0;
  const canAdd = hasPath && hasProperty;

  // Say why the button is dead, but only once the user has started — an
  // untouched form shouldn't nag.
  const hint = canAdd || (!hasPath && !hasProperty)
    ? ''
    : hasPath
      ? 'Add a property name to start watching.'
      : 'Add an object path to start watching.';

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} aria-label="Add property watch">
      <div className="flex items-end gap-1.5">
        <div className="flex-1">
          <label htmlFor="lss-watch-object-path" className="text-2xs font-bold text-text-muted uppercase tracking-wider">Object Path</label>
          <input
            id="lss-watch-object-path"
            type="text"
            value={objectPath}
            onChange={(e) => setObjectPath(e.target.value)}
            placeholder="/Game/BP_Player.BP_Player_C"
            aria-describedby="lss-watch-hint"
            className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-subtle focus-ring-inset"
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
            aria-describedby="lss-watch-hint"
            className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-subtle focus-ring-inset"
          />
        </div>
        <button
          type="submit"
          disabled={!canAdd}
          className="px-2 py-1 rounded text-xs font-bold border transition-colors disabled:opacity-40 focus-ring"
          style={{ borderColor: `${ACCENT_EMERALD}40`, color: ACCENT_EMERALD }}
          aria-label="Add property watch"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {/* Always-mounted live region so the hint is announced when it appears. */}
      <p
        id="lss-watch-hint"
        role="status"
        aria-live="polite"
        className="h-4 mt-1 text-2xs text-text-muted/70"
      >
        {hint}
      </p>
    </form>
  );
}
