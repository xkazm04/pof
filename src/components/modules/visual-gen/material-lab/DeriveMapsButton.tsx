'use client';

import { useCallback, useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { useMaterialStore, type DeriveMapsOutcome } from './useMaterialStore';
import { TileError } from './TileError';

/**
 * One free click: derive normal + roughness from the loaded albedo through the
 * local `/api/texture-maps` (sharp, no provider, no spend). Only EMPTY slots are
 * filled, each slot then wears its label (see `ProvenanceChip` in PBREditor), and
 * the report names what was skipped and what the albedo cannot produce at all —
 * metalness is a named absence, not silence.
 */
export function DeriveMapsButton() {
  const albedoTexture = useMaterialStore((s) => s.albedoTexture);
  const deriveMapsFromAlbedo = useMaterialStore((s) => s.deriveMapsFromAlbedo);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<DeriveMapsOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setRunning(true);
    setError(null);
    setOutcome(null);
    const result = await deriveMapsFromAlbedo();
    setRunning(false);
    if (result.ok) setOutcome(result.data);
    else setError(result.error);
  }, [deriveMapsFromAlbedo]);

  const disabled = !albedoTexture || running;

  return (
    <div className="space-y-1" data-testid="derive-maps">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={albedoTexture ? 'Free and local: no generation credits are spent' : 'Load an albedo map first'}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-border text-text-muted hover:text-text hover:border-[var(--visual-gen)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
        Derive maps from albedo
      </button>
      {!albedoTexture && (
        <p className="text-2xs text-text-muted">Load an albedo to derive a normal and roughness map from it, free.</p>
      )}
      {error && <TileError error={error} onRetry={handleClick} testId="derive-maps-error" />}
      {outcome && <DeriveReport outcome={outcome} />}
    </div>
  );
}

function DeriveReport({ outcome }: { outcome: DeriveMapsOutcome }) {
  return (
    <ul className="text-2xs text-text-muted space-y-0.5" data-testid="derive-maps-report">
      {outcome.filled.map((f) => (
        <li key={f.channel}>
          Filled {f.channel} ({f.provenance}: {f.method}).
        </li>
      ))}
      {outcome.skipped.map((s) => (
        <li key={s.channel}>Skipped {s.channel}: {s.reason}.</li>
      ))}
      {outcome.refused.map((r) => (
        <li key={r.channel}>Not derived: {r.channel}. The {r.reason}.</li>
      ))}
    </ul>
  );
}
