'use client';

import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { formatBytes } from '@/lib/format';
import { logger } from '@/lib/logger';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';

export function AssetGallery({ activeUrl, onPick }: { activeUrl: string | null; onPick: (a: GeneratedAsset) => void }) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    tryApiFetch<{ assets: GeneratedAsset[] }>('/api/visual-gen/assets').then((r) => {
      if (!live) return;
      if (r.ok) { setAssets(r.data.assets); setError(null); }
      else { setError(r.error); logger.error('asset gallery fetch failed', r.error); }
    });
    return () => { live = false; };
  }, [reload]);

  return (
    <aside className="flex flex-col h-full w-[240px] shrink-0 border-r border-border bg-surface/40 overflow-hidden" aria-label="Generated assets">
      <header className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Boxes size={14} className="text-text-muted" />
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Generated ({assets.length})</span>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {error ? (
          <div className="text-xs text-red-400">
            {error} <button onClick={() => setReload((n) => n + 1)} className="underline">Retry</button>
          </div>
        ) : assets.length === 0 ? (
          <p className="text-2xs text-text-muted p-2">No generated assets yet — run the asset pipeline.</p>
        ) : (
          assets.map((a) => (
            <button
              key={a.name}
              onClick={() => onPick(a)}
              className={`w-full flex items-center gap-2 rounded p-1.5 text-left transition-colors ${
                activeUrl === a.url ? 'bg-[var(--visual-gen)]/15 ring-1 ring-[var(--visual-gen)]' : 'hover:bg-surface'
              }`}
            >
              <div className="h-10 w-10 shrink-0 rounded bg-surface-deep overflow-hidden flex items-center justify-center">
                {a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Boxes size={16} className="text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-text" title={a.name}>{a.name}</div>
                <div className="text-2xs text-text-muted">{formatBytes(a.sizeBytes)}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
