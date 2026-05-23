'use client';

import { useState } from 'react';
import { Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

interface ScenarioResult { albedoUrl?: string; normalUrl?: string; roughnessUrl?: string }

const isNotConfigured = (e: string | null) => !!e && /not configured/i.test(e);

export function AdvancedTexturePanel() {
  // Scenario PBR tile
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState('');
  const [pbr, setPbr] = useState<ScenarioResult | null>(null);
  const [pbrErr, setPbrErr] = useState<string | null>(null);
  const [pbrLoading, setPbrLoading] = useState(false);

  // Universal Upscaler tile
  const [imageId, setImageId] = useState('');
  const [style, setStyle] = useState('GENERAL');
  const [jobId, setJobId] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [upLoading, setUpLoading] = useState(false);

  const runScenario = async () => {
    setPbrLoading(true); setPbr(null); setPbrErr(null);
    const r = await tryApiFetch<ScenarioResult>('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelId: modelId || undefined }),
    });
    if (r.ok) setPbr(r.data);
    else { setPbrErr(r.error); logger.warn(`[advanced-texture] scenario: ${r.error}`); }
    setPbrLoading(false);
  };

  const runUpscale = async () => {
    setUpLoading(true); setJobId(null); setUpErr(null);
    const r = await tryApiFetch<{ upscaleJobId: string }>('/api/leonardo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'upscale', imageId, style }),
    });
    if (r.ok) setJobId(r.data.upscaleJobId);
    else { setUpErr(r.error); logger.warn(`[advanced-texture] upscale: ${r.error}`); }
    setUpLoading(false);
  };

  const maps: Array<[string, string | undefined]> = [
    ['pbr-albedo', pbr?.albedoUrl],
    ['pbr-normal', pbr?.normalUrl],
    ['pbr-roughness', pbr?.roughnessUrl],
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Tile A — Scenario PBR set */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-[var(--visual-gen)]">
          <Sparkles className="w-4 h-4" /> Scenario PBR set
        </header>
        <textarea
          data-testid="scenario-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="dark fantasy dungeon stone, seamless PBR"
          rows={2}
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        />
        <input
          data-testid="scenario-model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="Scenario model id (optional)"
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        />
        <button
          data-testid="scenario-generate"
          onClick={runScenario}
          disabled={pbrLoading}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40"
        >
          {pbrLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate PBR set
        </button>

        {pbrErr && (
          <div data-testid="scenario-error" className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">
            {isNotConfigured(pbrErr)
              ? 'Configure SCENARIO_API_KEY + SCENARIO_API_SECRET in the app .env to use Scenario PBR generation.'
              : pbrErr}
          </div>
        )}

        {pbr && (
          <div className="grid grid-cols-3 gap-2">
            {maps.map(([id, url]) =>
              url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} data-testid={id} src={url} alt={id} className="w-full aspect-square object-cover rounded border border-white/10" />
              ) : null,
            )}
          </div>
        )}
      </section>

      {/* Tile B — Universal Upscaler */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-[var(--visual-gen)]">
          <ArrowUpRight className="w-4 h-4" /> Universal Upscaler
        </header>
        <input
          data-testid="upscale-image-id"
          value={imageId}
          onChange={(e) => setImageId(e.target.value)}
          placeholder="Leonardo generated image id"
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        />
        <select
          data-testid="upscale-style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        >
          <option value="GENERAL">General</option>
          <option value="ARTISTIC">Artistic</option>
          <option value="REALISTIC">Realistic</option>
        </select>
        <button
          data-testid="upscale-run"
          onClick={runUpscale}
          disabled={upLoading || !imageId}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40"
        >
          {upLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          Upscale
        </button>

        {upErr && (
          <div data-testid="upscale-error" className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">{upErr}</div>
        )}
        {jobId && (
          <div data-testid="upscale-job" className="text-[11px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1.5">
            Upscale job started: {jobId}
          </div>
        )}
      </section>
    </div>
  );
}
