'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { StatusTag } from '@/components/ui/StatusTag';
import { CATEGORY_KINDS, type EventSoundOption } from '@/lib/audio-event-sound';
import type { EventCategory } from './types';

export interface EventSoundLibrary {
  /** `null` while the library is loading or unreadable. */
  options: readonly EventSoundOption[] | null;
  isLoading: boolean;
  error: string | null;
}

interface EventSoundPickerProps {
  /** Id prefix for this editor's controls. */
  idBase: string;
  category: EventCategory;
  assetSetId: string | null | undefined;
  library: EventSoundLibrary;
  /** When set, only these sets are offered (the tie the suggester refused to break). */
  onlyIds?: readonly string[];
  /** Bind to a set id, or `null` to unbind. */
  onBind: (setId: string | null) => void;
}

function ImportLine({ option }: { option: EventSoundOption }) {
  return option.cuePath
    ? (
      <span className="flex items-center gap-1 min-w-0">
        <StatusTag level="ok" word="imported" iconClassName="w-2.5 h-2.5" />
        <span className="font-mono truncate">{option.cuePath}</span>
      </span>
    )
    : (
      <span className="flex items-center gap-1">
        <StatusTag level="warn" word="not imported" iconClassName="w-2.5 h-2.5" />
        <span>no UE import recorded — the manager gets a labelled placeholder</span>
      </span>
    );
}

/**
 * Bind one event class to a set in the project's generated-audio library. Only
 * kinds the category can play are offered (never tts: no provider serves it).
 * Binding stores an id; "Generate Audio Manager" resolves it to the set's REAL
 * imported cue path or a labelled placeholder. Nothing here plays audio.
 */
export function EventSoundPicker({ idBase, category, assetSetId, library, onlyIds, onBind }: EventSoundPickerProps) {
  const { options, isLoading, error } = library;
  const bound = assetSetId && options ? options.find((o) => o.id === assetSetId) ?? null : null;

  const offered = useMemo(() => {
    const kinds = CATEGORY_KINDS[category] ?? [];
    return (options ?? []).filter((o) => (onlyIds ? onlyIds.includes(o.id) : kinds.includes(o.kind)));
  }, [options, category, onlyIds]);

  return (
    <div className="space-y-2">
      <span id={`${idBase}-sound`} className="block text-sm text-text-muted font-semibold">
        Library sound
      </span>
      <div className="px-3 py-2 rounded-xl bg-surface-deep border border-border text-xs text-text-muted">
        {!assetSetId && <span>Not bound — the manager ships a labelled PLACEHOLDER for this event.</span>}
        {assetSetId && bound && (
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text truncate">{bound.name} · {bound.clipCount} clip{bound.clipCount === 1 ? '' : 's'}</span>
              <button
                type="button"
                onClick={() => onBind(null)}
                aria-label="Unbind library sound"
                className="focus-ring p-0.5 rounded text-text-muted hover:text-text"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
            <ImportLine option={bound} />
          </div>
        )}
        {assetSetId && !bound && (
          <span>
            {options ? `Bound to set ${assetSetId}, which is not in the library any more.` : 'Import status unknown — the library is not readable.'}
          </span>
        )}
      </div>

      {isLoading && <p className="text-xs text-text-muted">Reading the library…</p>}
      {error && <p className="text-xs text-text-muted">Library unreadable — binding is unavailable until it loads.</p>}
      {options && offered.length === 0 && (
        <p className="text-xs text-text-muted">No set of a kind this category can play ({(CATEGORY_KINDS[category] ?? []).join(', ')}).</p>
      )}
      {offered.length > 0 && (
        <div role="listbox" aria-labelledby={`${idBase}-sound`} className="max-h-48 overflow-y-auto space-y-1">
          {offered.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === assetSetId}
              onClick={() => onBind(o.id)}
              className="focus-ring-inset w-full text-left px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-hover"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs text-text truncate">{o.name}</span>
                {o.id === assetSetId
                  ? <Check className="w-3 h-3 flex-shrink-0 text-text" aria-hidden="true" />
                  : <span className="text-xs text-text-muted flex-shrink-0">{o.kind} · {o.clipCount}</span>}
              </div>
              <div className="mt-0.5 text-xs text-text-muted min-w-0"><ImportLine option={o} /></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
