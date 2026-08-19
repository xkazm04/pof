'use client';

import { useCallback, useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { Rail } from '@/components/layout-lab/ui/Rail';
import { Skeleton } from '@/components/layout-lab/ui/Skeleton';
import { tryApiFetch } from '@/lib/api-utils';
import { formatBytes } from '@/lib/format';
import { logger } from '@/lib/logger';
import { GENERATED_ASSETS_ENDPOINT, type GeneratedAsset } from '@/lib/visual-gen/generated-assets';

const mono = { fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)' } as const;

export function AssetGallery({ activeUrl, onPick }: { activeUrl: string | null; onPick: (a: GeneratedAsset) => void }) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Starts true so the first paint reads as "loading", never as the "no assets" lie.
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    let live = true;
    tryApiFetch<{ assets: GeneratedAsset[] }>(GENERATED_ASSETS_ENDPOINT).then((r) => {
      if (!live) return;
      if (r.ok) { setAssets(r.data.assets); setError(null); }
      else { setError(r.error); logger.error('asset gallery fetch failed', r.error); }
      setLoading(false);
    });
    return () => { live = false; };
  }, [reload]);

  // Retry re-enters the loading state from the event handler (never from the effect body).
  const onRetry = useCallback(() => { setError(null); setLoading(true); setReload((n) => n + 1); }, []);

  return (
    <Rail title={loading ? 'Generated' : `Generated (${assets.length})`} style={{ width: 240, flexShrink: 0 }}>
      <div aria-busy={loading || undefined} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--lab-s2)', display: 'flex', flexDirection: 'column', gap: 'var(--lab-s2)' }}>
        {loading ? (
          <>
            <p style={{ ...mono, color: 'var(--lab-muted)', padding: 'var(--lab-s2)' }}>Loading generated assets…</p>
            {[0, 1, 2].map((i) => <Skeleton key={i} reduce={!!reduce} height={52} radius={0} />)}
          </>
        ) : error ? (
          <div role="alert" style={{ ...mono, color: 'var(--lab-bad)', padding: 'var(--lab-s2)', lineHeight: 1.6 }}>
            <div>Couldn’t load the generated assets.</div>
            <div style={{ color: 'var(--lab-muted)' }}>{error}</div>
            <button type="button" onClick={onRetry} className="focus-ring" style={{ marginTop: 'var(--lab-s2)', textDecoration: 'underline', color: 'var(--lab-ink)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>Retry</button>
          </div>
        ) : assets.length === 0 ? (
          <p style={{ ...mono, color: 'var(--lab-muted)', padding: 'var(--lab-s2)', lineHeight: 1.6 }}>No generated assets yet — run the asset pipeline, or use “Load model” to open a .glb from your computer.</p>
        ) : (
          assets.map((a) => {
            const active = activeUrl === a.url;
            return (
              <button
                key={a.url}
                type="button"
                onClick={() => onPick(a)}
                aria-pressed={active}
                className="focus-ring"
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', padding: 'var(--lab-s2)', textAlign: 'left', cursor: 'pointer',
                  background: active ? 'var(--lab-accent-bg)' : 'var(--lab-panel)',
                  border: `1px solid ${active ? 'var(--lab-accent)' : 'var(--lab-line)'}`,
                  borderRadius: 'var(--lab-r-sm)', transition: 'border-color var(--lab-dur-fast) var(--lab-ease)',
                }}
              >
                <div style={{ height: 40, width: 40, flexShrink: 0, borderRadius: 'var(--lab-r-sm)', overflow: 'hidden', background: 'var(--lab-bg)', border: '1px solid var(--lab-line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.previewUrl} alt="" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Boxes size={16} style={{ color: 'var(--lab-muted)' }} aria-hidden />
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...mono, color: 'var(--lab-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>{a.name}</div>
                  {/* Which generator made it. Basenames repeat across provider dirs (both
                      stores name by timestamp), so the name alone is not an identity. An
                      `_aN` file is labelled as a retry ATTEMPT, never as "rejected" — disk
                      does not record which attempt the job actually delivered. */}
                  <div style={{ ...mono, color: 'var(--lab-muted)' }}>
                    {formatBytes(a.sizeBytes)}
                    {a.providerLabel ? ` · ${a.providerLabel}` : ''}
                    {a.attempt !== undefined ? ` · retry attempt ${a.attempt}` : ''}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Rail>
  );
}
