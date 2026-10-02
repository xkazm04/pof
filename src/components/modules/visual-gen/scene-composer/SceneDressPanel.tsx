'use client';

import { useEffect, useRef, useState } from 'react';
import { Boxes, ImagePlus, Loader2, ScanSearch } from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useSceneDressStore, type SceneDressStatus } from './useSceneDressStore';
import { DressPlanMap, DressPlanTable } from './DressPlanMap';

/**
 * Dress a set from an image: pick → Decompose (paid, explicit) → review the placed plan →
 * Block out in Blender (explicit, additive, receipted). The store owns every outcome; this
 * panel only renders it.
 */
function statusLine(s: {
  status: SceneDressStatus;
  error: string | null;
  note: string | null;
  buildError: string | null;
  builtCount: number | null;
  placed: number;
  unplaced: number;
}): { text: string; warn: boolean } | null {
  switch (s.status) {
    case 'idle':
      return null;
    case 'decomposing':
      return { text: 'Decomposing the scene…', warn: false };
    case 'failed':
      return { text: `Decompose failed: ${s.error}`, warn: true };
    case 'empty':
      return { text: `No props to place: ${s.note}`, warn: false };
    case 'planned':
      return { text: `${s.placed} placed, ${s.unplaced} unplaced — review, then block out.`, warn: false };
    case 'building':
      return { text: `Blocking out ${s.placed} props in Blender…`, warn: false };
    case 'built':
      return { text: `Blender confirmed ${s.builtCount} proxies in a new collection.`, warn: false };
    case 'build-failed':
      return { text: `Blockout failed: ${s.buildError}`, warn: true };
    case 'unconfirmed':
      return { text: `Blockout not confirmed: ${s.buildError}`, warn: true };
  }
}

export function SceneDressPanel() {
  const connected = useBlenderMCPStore((s) => s.connection.connected);
  const store = useSceneDressStore();
  const { imageDataUrl, imageName, gateCrops, status, plan } = store;
  const [readError, setReadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (!mounted.current) return;
      if (typeof reader.result === 'string') store.setImage(reader.result, file.name);
      else setReadError(`Could not read “${file.name}” — the browser returned no image data.`);
    };
    reader.onerror = () => {
      if (mounted.current) setReadError(`Could not read “${file.name}”.`);
    };
    reader.readAsDataURL(file);
  };

  const busy = status === 'decomposing' || status === 'building';
  const placed = plan?.placed.length ?? 0;
  const line = statusLine({ ...store, placed, unplaced: plan?.unplaced.length ?? 0 });
  const canBuild = connected && placed > 0 && !busy && status !== 'failed' && status !== 'empty';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Reference image"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1 px-3 py-1 rounded bg-surface-tertiary border border-border text-xs text-text hover:bg-surface-hover disabled:opacity-40"
        >
          <ImagePlus className="w-3 h-3" /> {imageName ?? (imageDataUrl ? 'Image loaded' : 'Pick image')}
        </button>
        <label className="flex items-center gap-1 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={gateCrops}
            onChange={(e) => store.setGateCrops(e.target.checked)}
            disabled={busy}
          />
          Gate each prop crop (+1 vision call per prop)
        </label>
        <button
          onClick={() => void store.decompose()}
          disabled={!imageDataUrl || busy}
          className="flex items-center gap-1 px-3 py-1 rounded bg-accent/10 text-accent text-xs hover:bg-accent/20 disabled:opacity-40"
        >
          {status === 'decomposing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
          Decompose
        </button>
      </div>

      {readError && (
        <div role="alert" className="text-xs text-amber-400">
          {readError}
        </div>
      )}

      {line && (
        <div role="status" aria-live="polite" className={`text-xs ${line.warn ? 'text-amber-400' : 'text-text-muted'}`}>
          {line.text}
        </div>
      )}

      {plan && placed + plan.unplaced.length > 0 && (
        <>
          <DressPlanMap plan={plan} />
          <DressPlanTable plan={plan} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => void store.buildBlockout()}
              disabled={!canBuild}
              className="flex items-center gap-1 px-3 py-1 rounded bg-accent/10 text-accent text-xs hover:bg-accent/20 disabled:opacity-40"
            >
              {status === 'building' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Boxes className="w-3 h-3" />}
              Block out in Blender ({placed})
            </button>
            {!connected && <span className="text-xs text-text-muted">Connect Blender to block out.</span>}
          </div>
        </>
      )}
    </div>
  );
}
