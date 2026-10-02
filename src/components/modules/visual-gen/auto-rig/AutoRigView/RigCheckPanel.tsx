'use client';

import { useEffect, useState } from 'react';
import { Loader2, ScanSearch } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { GENERATED_ASSETS_ENDPOINT, type GeneratedAsset } from '@/lib/visual-gen/generated-assets';
import {
  RIG_CHECK_ENDPOINT,
  RIG_CHECK_MORPHOLOGIES,
  type RigCheckResponse,
  type RigCheckRow,
} from '@/lib/visual-gen/rig-check';
import type { Morphology } from '@/lib/visual-gen/skeleton-profiles';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';

const STATUS_TONE: Record<RigCheckRow['status'], string> = {
  bound: 'text-emerald-400',
  partial: 'text-rose-500',
  unverifiable: 'text-amber-500',
  'not-applicable': 'text-text-muted',
};

/** `dir::name` — a basename alone is not an identity across provider dirs. */
const keyOf = (a: Pick<GeneratedAsset, 'provider' | 'name'>) => `${a.provider}::${a.name}`;

/**
 * "Check a produced rig": pick a generated GLB, run the free Tier-1 rig gate once
 * (`POST /api/visual-gen/rig-check`), and compare how its real bone names bind to EVERY
 * target skeleton. "Use this target" hands the choice to the tab's preset selector, so
 * the target follows the evidence instead of a static card description.
 */
export function RigCheckPanel({ onSelectPreset, onChecked }: {
  onSelectPreset: (presetId: string) => void;
  onChecked?: (result: RigCheckResponse | null) => void;
}) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [picked, setPicked] = useState('');
  const [morphology, setMorphology] = useState<Morphology>('biped');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RigCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await tryApiFetch<{ assets: GeneratedAsset[] }>(GENERATED_ASSETS_ENDPOINT);
      if (!live) return;
      if (!res.ok) { setListError(res.error); return; }
      const glb = res.data.assets.filter((a) => /\.glb$/i.test(a.name));
      setAssets(glb);
      setPicked((prev) => prev || (glb[0] ? keyOf(glb[0]) : ''));
    })();
    return () => { live = false; };
  }, []);

  const handleCheck = async () => {
    const asset = assets.find((a) => keyOf(a) === picked);
    if (!asset) return;
    setChecking(true);
    setError(null);
    const res = await tryApiFetch<RigCheckResponse>(RIG_CHECK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: asset.name, dir: asset.provider, morphology }),
    });
    const next = res.ok ? res.data : null;
    if (!res.ok) setError(res.error);
    setResult(next);
    onChecked?.(next);
    setChecking(false);
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3" data-testid="rig-check-panel">
      <div>
        <h3 className="text-sm font-medium text-text">Check a produced rig</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Read a generated GLB&apos;s skeleton (free, local — no Blender) and see which target its bone names bind to.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-muted flex-1 min-w-48">
          Generated GLB
          <select
            data-testid="rig-check-asset"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className={`rounded border border-border bg-transparent px-2 py-1 text-xs text-text ${VISUAL_GEN_FOCUS_RING}`}
          >
            {assets.length === 0 && <option value="">No generated GLB found</option>}
            {assets.map((a) => (
              <option key={keyOf(a)} value={keyOf(a)}>{a.name} · {a.providerLabel}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Morphology
          <select
            data-testid="rig-check-morphology"
            value={morphology}
            onChange={(e) => setMorphology(e.target.value as Morphology)}
            className={`rounded border border-border bg-transparent px-2 py-1 text-xs text-text ${VISUAL_GEN_FOCUS_RING}`}
          >
            {RIG_CHECK_MORPHOLOGIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button
          data-testid="rig-check-submit"
          onClick={() => void handleCheck()}
          disabled={!picked || checking}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40 disabled:cursor-not-allowed ${VISUAL_GEN_FOCUS_RING}`}
        >
          {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
          {checking ? 'Checking...' : 'Check rig'}
        </button>
      </div>

      {listError && <p role="alert" className="text-xs text-rose-500">Could not list generated assets: {listError}</p>}
      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
      {result && <RigCheckResult result={result} onSelectPreset={onSelectPreset} />}
    </div>
  );
}

function RigCheckResult({ result, onSelectPreset }: { result: RigCheckResponse; onSelectPreset: (id: string) => void }) {
  const v = result.verdict;
  return (
    <div className="space-y-2" data-testid="rig-check-result">
      <p data-testid="rig-check-state" data-state={result.state} className="text-xs text-text">
        <span className="font-medium">{result.state}</span> — {result.message}
        {v && <span className={v.pass ? ' text-emerald-400' : ' text-rose-500'}> · gate {v.pass ? 'pass' : 'fail'} ({v.score})</span>}
      </p>
      {v && (v.failures.length > 0 || v.warnings.length > 0) && (
        <ul className="text-xs space-y-0.5">
          {v.failures.map((f) => <li key={f} className="text-rose-500">{f}</li>)}
          {v.warnings.map((w) => <li key={w} className="text-amber-500">{w}</li>)}
        </ul>
      )}
      {result.rows.length > 0 && (
        <ul className="divide-y divide-border rounded border border-border">
          {result.rows.map((r) => (
            <li key={r.presetId} data-testid={`rig-check-row-${r.presetId}`} className="flex items-start gap-3 p-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">{r.presetName}</span>
                  <span className={STATUS_TONE[r.status]}>{r.status}</span>
                  {r.kind === 'remap' && <span className="tabular-nums text-text-muted">binds {r.bound}/{r.required}</span>}
                  {result.recommended === r.presetId && <span className="text-[var(--visual-gen)] font-medium">Recommended</span>}
                </div>
                {r.status === 'partial' && (
                  <p className="text-rose-500 mt-0.5">Will not retarget: {r.unboundChains.join(', ')}</p>
                )}
                <p className="text-text-muted mt-0.5">{r.reason}</p>
              </div>
              <button
                data-testid={`rig-check-use-${r.presetId}`}
                onClick={() => onSelectPreset(r.presetId)}
                className={`shrink-0 px-2 py-1 rounded text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 ${VISUAL_GEN_FOCUS_RING}`}
              >
                Use this target
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-text-muted" data-testid="rig-check-recommendation">{result.recommendationReason}</p>
    </div>
  );
}
