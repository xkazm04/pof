import { useState, useCallback, useRef } from 'react';
import { Send } from 'lucide-react';
import { ACCENT_EMERALD, ACCENT_ORANGE } from '@/lib/chart-colors';
import { truncate } from './helpers';

// ── Property editor row ─────────────────────────────────────────────────

export function PropertyEditorRow({
  objectPath,
  propertyName,
  currentValue,
  onPush,
}: {
  objectPath: string;
  propertyName: string;
  currentValue: unknown;
  onPush: (objectPath: string, propertyName: string, value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = useCallback(() => {
    setDraft(typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? ''));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [currentValue]);

  const handlePush = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      parsed = draft; // send as string
    }
    onPush(objectPath, propertyName, parsed);
    setEditing(false);
  }, [draft, objectPath, propertyName, onPush]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePush();
    if (e.key === 'Escape') setEditing(false);
  }, [handlePush]);

  const displayValue = typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? '—');

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/20 group hover:bg-surface/30 transition-colors">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACCENT_EMERALD }} />
      <div className="flex-1 min-w-0">
        <div className="text-2xs font-mono text-text-muted/60 truncate">{objectPath}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-text">{propertyName}</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-32 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
                style={{ borderColor: `${ACCENT_EMERALD}60` }}
              />
              <button
                onClick={handlePush}
                className="p-0.5 rounded"
                title="Push to UE5"
                style={{ color: ACCENT_EMERALD }}
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs font-mono truncate" style={{ color: ACCENT_EMERALD }}>
              {truncate(displayValue, 40)}
            </span>
          )}
        </div>
      </div>
      {!editing && (
        <button
          onClick={handleStartEdit}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center touch-target"
          title="Edit & push to UE5"
          style={{ color: ACCENT_ORANGE }}
        >
          <Send className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
