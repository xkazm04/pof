'use client';

import { useState } from 'react';
import { Image as ImageIcon, Loader2, Send } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { useCRUD } from '@/hooks/useCRUD';
import { useIsMounted } from '@/hooks/useIsMounted';
import { StatusTag } from '@/components/ui/StatusTag';
import type { ImageProviderCapability, TwoDGenerateResult } from '@/lib/visual-gen/image-providers';
import { InlineErrorRetry } from '../../shared/InlineErrorRetry';

/**
 * The app's 2D generation front — the first surface anywhere in PoF that turns a
 * typed prompt into an image.
 *
 * Capability comes from the SERVER (`GET /api/visual-gen/generate-2d`), because a
 * browser cannot read `process.env`: a provider whose key is missing here is disabled
 * WITH that sentence before any submit, rather than accepting a click that will fail
 * upstream. Nothing renders a placeholder that could read as a generated image —
 * the `<img>` exists only once the route reports bytes on disk.
 *
 * Type-only imports from `image-providers` on purpose: the orchestration it also
 * exports reaches for `node:fs` and the provider SDKs and must not enter this bundle.
 */
interface CapabilityPayload {
  providers: ImageProviderCapability[];
  defaultProviderId: string | null;
}

export function Image2DPanel() {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<TwoDGenerateResult | null>(null);
  const isMounted = useIsMounted();

  // The shared fetch hook, not a hand-rolled mount effect: it owns the loading /
  // error states and the mounted guard (and keeps this off the
  // `react-hooks/set-state-in-effect` rule).
  const {
    data: { providers, defaultProviderId },
    isLoading,
    error: capsError,
  } = useCRUD<CapabilityPayload>(
    '/api/visual-gen/generate-2d',
    { providers: [], defaultProviderId: null },
    { errorMessage: 'the server did not answer' },
  );
  // An unanswered capability check is NOT "no providers can run" — until it lands,
  // nothing is claimed about any provider and nothing is offered.
  const caps: ImageProviderCapability[] | null = isLoading || capsError ? null : providers;

  const selected =
    caps?.find((p) => p.id === pickedId)
    ?? caps?.find((p) => p.id === defaultProviderId)
    ?? caps?.find((p) => p.executable)
    ?? null;

  /** Why the submit button is off, in the user's terms — or null when it can run. */
  const blockReason: string | null = (() => {
    if (capsError) return `Could not check which 2D providers this server can run: ${capsError}`;
    if (!caps) return 'Checking which 2D providers this server can run…';
    if (!caps.some((p) => p.executable)) {
      return (
        'No 2D provider can run on this server. '
        + caps.map((p) => `${p.name}: ${p.reason ?? 'unavailable'}`).join(' ')
      );
    }
    if (!selected) return 'Pick a provider.';
    if (!selected.executable) return selected.reason ?? `${selected.name} cannot run here.`;
    if (!prompt.trim()) return 'Describe the image first.';
    return null;
  })();
  const canSubmit = blockReason === null && !generating;

  const submit = async () => {
    if (!canSubmit || !selected) return;
    setGenerating(true);
    setGenError(null);
    setResult(null);
    const res = await tryApiFetch<TwoDGenerateResult>('/api/visual-gen/generate-2d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim(), providerId: selected.id }),
    });
    if (!isMounted()) return;
    setGenerating(false);
    // The route's envelope carries the PROVIDER's own reason — surfaced verbatim.
    if (!res.ok) { setGenError(res.error); return; }
    setResult(res.data);
  };

  return (
    <div className="space-y-4" data-testid="image2d-panel">
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">Provider</label>
        {!caps && !capsError && (
          <p className="text-2xs text-text-muted" data-testid="image2d-caps-loading">
            Checking which providers this server holds a key for…
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(caps ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => p.executable && setPickedId(p.id)}
              disabled={!p.executable}
              title={p.reason}
              data-testid={`image2d-provider-${p.id}`}
              data-executable={p.executable}
              className={`relative px-3 py-2 rounded-lg text-left text-xs transition-colors border ${
                selected?.id === p.id
                  ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
                  : p.executable
                    ? 'border-border hover:border-text-muted'
                    : 'border-border opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-text">{p.name}</span>
                {p.executable && <StatusTag level="ok" word="READY" iconClassName="w-2.5 h-2.5" />}
                {!p.executable && (
                  <StatusTag
                    level="bad"
                    word={p.missingKey ? 'NO KEY' : 'NOT WIRED'}
                    iconClassName="w-2.5 h-2.5"
                  />
                )}
              </div>
              <p className="text-text-muted mt-0.5 line-clamp-2">{p.description}</p>
              {!p.executable && <p className="text-amber-400 mt-1">{p.reason}</p>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="image2d-prompt" className="text-xs text-text-muted mb-1.5 block">
          Describe the image
        </label>
        <textarea
          id="image2d-prompt"
          data-testid="image2d-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="a weathered bronze health potion icon, top-down, on a dark background"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text
                     placeholder:text-text-muted focus:outline-none focus:border-[var(--visual-gen)]"
        />
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          data-testid="image2d-submit"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                     bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {generating ? 'Generating…' : `Generate image${selected?.executable ? ` with ${selected.name}` : ''}`}
        </button>
        {blockReason && (
          <p className="text-2xs text-amber-400" data-testid="image2d-submit-block">{blockReason}</p>
        )}
      </div>

      {genError && (
        <div data-testid="image2d-error">
          <InlineErrorRetry dense message={genError} onRetry={() => void submit()} onDismiss={() => setGenError(null)} />
        </div>
      )}

      {result?.url && (
        <div className="space-y-1.5" data-testid="image2d-result">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/visual-gen/image/:name */}
          <img
            src={result.url}
            alt={`generated from: ${prompt.trim()}`}
            data-testid="image2d-image"
            className="w-full rounded-lg border border-border"
          />
          <p className="flex items-center gap-1.5 text-2xs text-text-muted" data-testid="image2d-provenance">
            <ImageIcon size={11} className="text-[var(--visual-gen)]" />
            {result.providerName}
            {result.model ? ` · ${result.model}` : ''} · saved as generated/images/{result.name} · served at{' '}
            {result.url}
          </p>
        </div>
      )}
    </div>
  );
}
