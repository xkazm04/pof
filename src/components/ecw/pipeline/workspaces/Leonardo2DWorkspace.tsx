'use client';

import { useState } from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import { STATUS_ERROR } from '@/lib/chart-colors';
import type { TrackWorkspaceProps } from '@/components/ecw/inspector/trackWorkspaceRegistry';

/**
 * 2D art track workspace (ECW Part 3c). Generates concept art for the entity via
 * Leonardo (`POST /api/leonardo {mode:'image'}` — which downloads-then-deletes
 * from the account, returning base64) and shows the results in a gallery. The
 * first track whose tooling actually generates assets, per the e2e vision.
 */
export function Leonardo2DWorkspace({ entity }: TrackWorkspaceProps) {
  const [prompt, setPrompt] = useState(`${entity.name} concept art, ${entity.catalogId} game asset, clean background`);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/leonardo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'image', prompt }),
      }).then((r) => r.json());
      const data = res?.data ?? res;
      if (data?.imageBase64) setImages((g) => [`data:image/jpeg;base64,${data.imageBase64}`, ...g]);
      else if (data?.imageUrl) setImages((g) => [data.imageUrl as string, ...g]);
      else setError(res?.error ?? 'No image returned');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PipelineTrackDetail entity={entity} trackId="art-2d" />
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-mono uppercase tracking-wider text-text-muted">2D Concept Art (Leonardo)</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          aria-label="Concept art prompt"
          className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
        />
        <button
          onClick={generate}
          disabled={busy || prompt.trim().length === 0}
          className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{busy ? 'Generating…' : 'Generate concept'}</span>
        </button>
        {error && <p className="text-2xs font-mono" style={{ color: STATUS_ERROR }}>{error}</p>}
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URIs from generation; next/image adds no value
              <img key={i} src={src} alt={`${entity.name} concept ${i + 1}`} className="rounded border border-border/40 w-full" />
            ))}
          </div>
        ) : (
          !busy && <p className="text-2xs text-text-muted/60">Generated concepts (downloaded then deleted from Leonardo) appear here.</p>
        )}
      </div>
    </div>
  );
}
