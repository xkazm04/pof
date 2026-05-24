'use client';

import { useState } from 'react';
import { Sparkles, Loader2, ArrowUpRight, Maximize2, Workflow, Brush } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

interface ScenarioResult { albedoUrl?: string; normalUrl?: string; roughnessUrl?: string }
interface ImageResult { imageUrl?: string; generationId?: string }

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

  // Unzoom (outpaint) tile
  const [uzImageId, setUzImageId] = useState('');
  const [uzPrompt, setUzPrompt] = useState('');
  const [uzJob, setUzJob] = useState<string | null>(null);
  const [uzErr, setUzErr] = useState<string | null>(null);
  const [uzLoading, setUzLoading] = useState(false);

  // ControlNet tile
  const [cnPrompt, setCnPrompt] = useState('');
  const [cnImageId, setCnImageId] = useState('');
  const [cnPreproc, setCnPreproc] = useState('67'); // Style Reference
  const [cnResult, setCnResult] = useState<ImageResult | null>(null);
  const [cnErr, setCnErr] = useState<string | null>(null);
  const [cnLoading, setCnLoading] = useState(false);

  // Inpaint tile
  const [ipPrompt, setIpPrompt] = useState('');
  const [ipImageId, setIpImageId] = useState('');
  const [ipMaskId, setIpMaskId] = useState('');
  const [ipResult, setIpResult] = useState<ImageResult | null>(null);
  const [ipErr, setIpErr] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(false);

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

  const runUnzoom = async () => {
    setUzLoading(true); setUzJob(null); setUzErr(null);
    const r = await tryApiFetch<{ unzoomJobId: string }>('/api/leonardo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'unzoom', imageId: uzImageId, prompt: uzPrompt || undefined }),
    });
    if (r.ok) setUzJob(r.data.unzoomJobId);
    else { setUzErr(r.error); logger.warn(`[advanced-texture] unzoom: ${r.error}`); }
    setUzLoading(false);
  };

  const runControlNet = async () => {
    setCnLoading(true); setCnResult(null); setCnErr(null);
    const r = await tryApiFetch<ImageResult>('/api/leonardo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'image',
        prompt: cnPrompt,
        opts: { controlnets: [{ initImageId: cnImageId, initImageType: 'UPLOADED', preprocessorId: Number(cnPreproc) }] },
      }),
    });
    if (r.ok) setCnResult(r.data);
    else { setCnErr(r.error); logger.warn(`[advanced-texture] controlnet: ${r.error}`); }
    setCnLoading(false);
  };

  const runInpaint = async () => {
    setIpLoading(true); setIpResult(null); setIpErr(null);
    const r = await tryApiFetch<ImageResult>('/api/leonardo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'image',
        prompt: ipPrompt,
        opts: { inpaint: { initImageId: ipImageId, maskImageId: ipMaskId || undefined } },
      }),
    });
    if (r.ok) setIpResult(r.data);
    else { setIpErr(r.error); logger.warn(`[advanced-texture] inpaint: ${r.error}`); }
    setIpLoading(false);
  };

  const maps: Array<[string, string | undefined]> = [
    ['pbr-albedo', pbr?.albedoUrl],
    ['pbr-normal', pbr?.normalUrl],
    ['pbr-roughness', pbr?.roughnessUrl],
  ];

  const tileBtn =
    'flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40';
  const tileInput = 'w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs';

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

      {/* Tile C — Unzoom (outpaint) */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-[var(--visual-gen)]">
          <Maximize2 className="w-4 h-4" /> Unzoom (extend borders)
        </header>
        <input
          data-testid="unzoom-image-id"
          value={uzImageId}
          onChange={(e) => setUzImageId(e.target.value)}
          placeholder="Leonardo generated image id"
          className={tileInput}
        />
        <input
          data-testid="unzoom-prompt"
          value={uzPrompt}
          onChange={(e) => setUzPrompt(e.target.value)}
          placeholder="what to paint into the extended region (optional)"
          className={tileInput}
        />
        <button data-testid="unzoom-run" onClick={runUnzoom} disabled={uzLoading || !uzImageId} className={tileBtn}>
          {uzLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Maximize2 className="w-3.5 h-3.5" />}
          Unzoom
        </button>
        {uzErr && <div data-testid="unzoom-error" className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">{uzErr}</div>}
        {uzJob && (
          <div data-testid="unzoom-job" className="text-[11px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1.5">
            Unzoom job started: {uzJob}
          </div>
        )}
      </section>

      {/* Tile D — ControlNet guided generation */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-[var(--visual-gen)]">
          <Workflow className="w-4 h-4" /> ControlNet (guided)
        </header>
        <input
          data-testid="controlnet-prompt"
          value={cnPrompt}
          onChange={(e) => setCnPrompt(e.target.value)}
          placeholder="prompt — e.g. an icon matching this silhouette"
          className={tileInput}
        />
        <input
          data-testid="controlnet-image-id"
          value={cnImageId}
          onChange={(e) => setCnImageId(e.target.value)}
          placeholder="uploaded init image id"
          className={tileInput}
        />
        <select data-testid="controlnet-preprocessor" value={cnPreproc} onChange={(e) => setCnPreproc(e.target.value)} className={tileInput}>
          <option value="67">Style Reference</option>
          <option value="19">Depth</option>
          <option value="20">Normal</option>
          <option value="21">Edge / Canny</option>
          <option value="100">Pose</option>
        </select>
        <button data-testid="controlnet-run" onClick={runControlNet} disabled={cnLoading || !cnPrompt || !cnImageId} className={tileBtn}>
          {cnLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Workflow className="w-3.5 h-3.5" />}
          Generate (ControlNet)
        </button>
        {cnErr && <div data-testid="controlnet-error" className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">{cnErr}</div>}
        {cnResult?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-testid="controlnet-result" src={cnResult.imageUrl} alt="controlnet result" className="w-full aspect-square object-cover rounded border border-white/10" />
        )}
      </section>

      {/* Tile E — Inpaint a region */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-[var(--visual-gen)]">
          <Brush className="w-4 h-4" /> Inpaint (fix a region)
        </header>
        <input
          data-testid="inpaint-prompt"
          value={ipPrompt}
          onChange={(e) => setIpPrompt(e.target.value)}
          placeholder="what to paint into the masked region"
          className={tileInput}
        />
        <input
          data-testid="inpaint-image-id"
          value={ipImageId}
          onChange={(e) => setIpImageId(e.target.value)}
          placeholder="base image id"
          className={tileInput}
        />
        <input
          data-testid="inpaint-mask-id"
          value={ipMaskId}
          onChange={(e) => setIpMaskId(e.target.value)}
          placeholder="mask image id (optional)"
          className={tileInput}
        />
        <button data-testid="inpaint-run" onClick={runInpaint} disabled={ipLoading || !ipPrompt || !ipImageId} className={tileBtn}>
          {ipLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brush className="w-3.5 h-3.5" />}
          Inpaint
        </button>
        {ipErr && <div data-testid="inpaint-error" className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">{ipErr}</div>}
        {ipResult?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-testid="inpaint-result" src={ipResult.imageUrl} alt="inpaint result" className="w-full aspect-square object-cover rounded border border-white/10" />
        )}
      </section>
    </div>
  );
}
