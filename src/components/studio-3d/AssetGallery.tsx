'use client';

import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { Rail } from '@/components/layout-lab/ui/Rail';
import { tryApiFetch } from '@/lib/api-utils';
import { formatBytes } from '@/lib/format';
import { logger } from '@/lib/logger';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';

const mono = { fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)' } as const;

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
    <Rail title={`Generated (${assets.length})`} style={{ width: 240, flexShrink: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--lab-s2)', display: 'flex', flexDirection: 'column', gap: 'var(--lab-s2)' }}>
        {error ? (
          <div style={{ ...mono, color: 'var(--lab-bad)' }}>
            {error}{' '}
            <button onClick={() => setReload((n) => n + 1)} style={{ textDecoration: 'underline', color: 'var(--lab-ink)', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>Retry</button>
          </div>
        ) : assets.length === 0 ? (
          <p style={{ ...mono, color: 'var(--lab-muted)', padding: 'var(--lab-s2)', lineHeight: 1.6 }}>No generated assets yet — run the asset pipeline.</p>
        ) : (
          assets.map((a) => {
            const active = activeUrl === a.url;
            return (
              <button
                key={a.name}
                onClick={() => onPick(a)}
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
                  <div style={{ fontFamily: 'var(--lab-font-mono)', fontSize: '10px', color: 'var(--lab-muted)' }}>{formatBytes(a.sizeBytes)}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Rail>
  );
}
