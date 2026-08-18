'use client';

import { useMemo, useState } from 'react';
import { Library, Check, X } from 'lucide-react';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { StatusTag } from '@/components/ui/StatusTag';
import { useAudioSetLibrary, type AudioSetOption } from './useAudioSetLibrary';

interface AssetSetPickerProps {
  /** The set this emitter is bound to (`audio_sets.id`), if any. */
  assetSetId: string | null | undefined;
  /** Bind to a set id, or `null` to unbind. */
  onBind: (setId: string | null) => void;
}

/** One line stating what a set's import status really is — never implied. */
function ImportStatus({ option }: { option: AudioSetOption }) {
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
        <span>no UE import recorded</span>
      </span>
    );
}

/**
 * Bind an emitter to a set in the project's own generated-audio library.
 *
 * The emitter's only tie to sound used to be a path the user hand-typed, with a
 * library of really-generated clips one tab away and no edge between them. The
 * binding is an id, so codegen can resolve the set's REAL imported cue path; the
 * raw path box below stays as the manual override.
 *
 * Nothing here is a promise that the sound exists in UE — a set with no recorded
 * import says exactly that, in the picker and in the generated C++.
 */
export function AssetSetPicker({ assetSetId, onBind }: AssetSetPickerProps) {
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState('');

  // Fetch when the user is browsing, or when a binding exists that must be named.
  const { options, isLoading, error, retry } = useAudioSetLibrary(browsing || Boolean(assetSetId));

  const bound = useMemo(
    () => (assetSetId ? options.find((o) => o.id === assetSetId) ?? null : null),
    [assetSetId, options],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
          Library Asset Set
        </label>
        <button
          type="button"
          onClick={() => setBrowsing((b) => !b)}
          className="focus-ring flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text bg-surface border border-border"
        >
          <Library className="w-3 h-3" />
          {browsing ? 'Close' : 'Browse'}
        </button>
      </div>

      {/* What this emitter is bound to, stated plainly. */}
      <div className="px-2 py-1.5 rounded bg-surface border border-border text-2xs text-text-muted-hover">
        {!assetSetId && <span>Not bound — codegen will use the manual path below.</span>}
        {assetSetId && bound && (
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text truncate">{bound.name}</span>
              <button
                type="button"
                onClick={() => onBind(null)}
                aria-label="Unbind asset set"
                className="focus-ring p-0.5 rounded text-text-muted hover:text-text"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="text-text-muted">{bound.clipCount} clip{bound.clipCount === 1 ? '' : 's'}</div>
            <ImportStatus option={bound} />
          </div>
        )}
        {assetSetId && !bound && (
          <span>
            {isLoading
              ? 'Resolving the bound set…'
              : `Bound to set ${assetSetId}, which is not in the library any more.`}
          </span>
        )}
      </div>

      {error && (
        <InlineErrorRetry message={error} onRetry={retry} dense />
      )}

      {browsing && (
        <div className="space-y-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search audio sets"
            placeholder="Search sets…"
            className="field-input focus-ring-inset"
          />
          <div className="max-h-48 overflow-y-auto space-y-1" role="listbox" aria-label="Audio sets">
            {isLoading && <div className="text-2xs text-text-muted px-1 py-1">Reading the library…</div>}
            {!isLoading && options.length === 0 && !error && (
              <div className="text-2xs text-text-muted px-1 py-1">
                The library is empty — generate a set in the Sound Forge first.
              </div>
            )}
            {!isLoading && options.length > 0 && matches.length === 0 && (
              <div className="text-2xs text-text-muted px-1 py-1">No set matches “{query}”.</div>
            )}
            {matches.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={o.id === assetSetId}
                onClick={() => { onBind(o.id); setBrowsing(false); }}
                className="focus-ring-inset w-full text-left px-2 py-1.5 rounded bg-surface border border-border hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-2xs text-text truncate">{o.name}</span>
                  {o.id === assetSetId
                    ? <Check className="w-3 h-3 flex-shrink-0 text-text" />
                    : <span className="text-2xs text-text-muted flex-shrink-0">{o.kind}</span>}
                </div>
                <div className="mt-0.5 text-2xs text-text-muted min-w-0">
                  <ImportStatus option={o} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
