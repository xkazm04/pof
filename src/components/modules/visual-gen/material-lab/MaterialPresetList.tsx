'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { useMaterialStore } from './useMaterialStore';
import type { Result } from '@/types/result';

/** A retryable preset action plus what to do once it lands. */
interface Attempt {
  action: () => Promise<Result<unknown, string>>;
  onSuccess?: () => void;
}

/**
 * Saved (persisted) material presets, beside the compiled-in
 * {@link BUILT_IN_PRESETS} chips in {@link PBREditor}.
 *
 * The two are deliberately different surfaces: built-ins are starting points
 * with no delete affordance (they cannot be lost), while everything in this
 * list is a row in the `materials` table and survives a reload.
 *
 * A failed load / save / delete is rendered as an `InlineErrorRetry` carrying
 * the server's own reason, and the retry re-runs the exact failed action — an
 * empty list is only ever shown after a load that actually SUCCEEDED, so
 * "nothing here" can never be a swallowed error.
 */
export function MaterialPresetList() {
  const presets = useMaterialStore((s) => s.presets);
  const presetsLoaded = useMaterialStore((s) => s.presetsLoaded);
  const presetsLoading = useMaterialStore((s) => s.presetsLoading);
  const activePresetId = useMaterialStore((s) => s.activePresetId);
  const loadPresets = useMaterialStore((s) => s.loadPresets);
  const addPreset = useMaterialStore((s) => s.addPreset);
  const loadPreset = useMaterialStore((s) => s.loadPreset);
  const removePreset = useMaterialStore((s) => s.removePreset);

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The action that failed, verbatim, so Retry re-runs exactly it. */
  const retryRef = useRef<Attempt | null>(null);

  const run = useCallback(async (attempt: Attempt) => {
    setBusy(true);
    const result = await attempt.action();
    setBusy(false);
    if (result.ok) {
      setError(null);
      retryRef.current = null;
      attempt.onSuccess?.();
      return;
    }
    retryRef.current = attempt;
    setError(result.error);
  }, []);

  const retry = useCallback(() => {
    const attempt = retryRef.current;
    if (attempt) void run(attempt);
  }, [run]);

  // One-shot fetch on first mount. A SUCCESSFUL load flips `presetsLoaded` so
  // re-entering the tab does not refetch; a failed one leaves it false, so the
  // next mount tries again instead of showing a permanent empty list. State is
  // only touched in the promise continuation, never synchronously in the effect.
  useEffect(() => {
    if (useMaterialStore.getState().presetsLoaded) return;
    void loadPresets().then((result) => {
      if (result.ok) return;
      retryRef.current = { action: loadPresets };
      setError(result.error);
    });
  }, [loadPresets]);

  const doSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void run({ action: () => addPreset(trimmed), onSuccess: () => setName('') });
  }, [addPreset, name, run]);

  const doDelete = useCallback(
    (id: string) => {
      void run({ action: () => removePreset(id) });
    },
    [removePreset, run],
  );

  return (
    <div data-testid="material-preset-list">
      <label className="text-xs text-text-muted mb-1.5 block" htmlFor="material-preset-name">
        Saved Presets
      </label>

      <div className="flex items-center gap-1.5 mb-2">
        <input
          id="material-preset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this material"
          className="focus-ring flex-1 min-w-0 px-2 py-1 text-xs rounded border border-border bg-transparent text-text placeholder:text-text-muted"
        />
        <button
          onClick={doSave}
          disabled={!name.trim() || busy}
          className="focus-ring flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-text-muted hover:text-text hover:border-[var(--visual-gen)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </div>

      {error && (
        <InlineErrorRetry
          dense
          className="mb-2"
          message={error}
          onRetry={retry}
          onDismiss={() => setError(null)}
        />
      )}

      {presetsLoading && !presetsLoaded && (
        <div className="flex items-center gap-1.5 text-2xs text-text-muted">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading saved presets…
        </div>
      )}

      {presetsLoaded && presets.length === 0 && !error && (
        <p className="text-2xs text-text-muted">No saved presets yet — tune the sliders and save one.</p>
      )}

      <ul className="space-y-1">
        {presets.map((preset) => (
          <li key={preset.id} className="flex items-center gap-1.5">
            <button
              onClick={() => loadPreset(preset.id)}
              aria-pressed={activePresetId === preset.id}
              className={`focus-ring flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
                activePresetId === preset.id
                  ? 'border-[var(--visual-gen)] text-text'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: preset.params.baseColor }}
              />
              <span className="truncate">{preset.name}</span>
            </button>
            <button
              onClick={() => doDelete(preset.id)}
              aria-label={`Delete preset ${preset.name}`}
              className="focus-ring p-1 rounded text-text-muted hover:text-text transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
