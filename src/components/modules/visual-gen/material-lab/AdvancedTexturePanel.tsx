'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, ArrowUpRight, Maximize2, Workflow, Brush, ArrowRight, Wand2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useMaterialStore, type TextureChannel } from './useMaterialStore';
import type { SeamCheckResult } from '@/lib/visual-gen/seam-check';

interface ScenarioResult { albedoUrl?: string; normalUrl?: string; roughnessUrl?: string; seam?: SeamCheckResult | null }
interface ImageResult { imageUrl?: string; generationId?: string }

/** Reinforcement appended to a reroll prompt to bias Scenario toward a clean tile. */
const SEAMLESS_HINT = 'seamless tileable, no visible seams';

const isNotConfigured = (e: string | null) => !!e && /not configured/i.test(e);

type PbrUrlKey = 'albedoUrl' | 'normalUrl' | 'roughnessUrl';

const PBR_MAP_CHANNELS: Array<{ id: string; channel: TextureChannel; key: PbrUrlKey; label: string }> = [
  { id: 'pbr-albedo', channel: 'albedo', key: 'albedoUrl', label: 'Albedo' },
  { id: 'pbr-normal', channel: 'normal', key: 'normalUrl', label: 'Normal' },
  { id: 'pbr-roughness', channel: 'roughness', key: 'roughnessUrl', label: 'Roughness' },
];

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

  // PBR → editor wiring
  const setTexture = useMaterialStore((s) => s.setTexture);
  const [appliedChannels, setAppliedChannels] = useState<TextureChannel[]>([]);

  const flashApplied = (channels: TextureChannel[]) => {
    setAppliedChannels(channels);
    window.setTimeout(() => setAppliedChannels([]), 1400);
  };

  const goToEditorTab = () => {
    window.dispatchEvent(new CustomEvent('pof-navigate-tab', { detail: { tab: 'editor' } }));
  };

  const applyMap = (channel: TextureChannel, url: string | undefined) => {
    if (!url) return;
    setTexture(channel, url);
    flashApplied([channel]);
    goToEditorTab();
  };

  const applyAllMaps = () => {
    if (!pbr) return;
    const applied: TextureChannel[] = [];
    for (const m of PBR_MAP_CHANNELS) {
      const url = pbr[m.key];
      if (url) {
        setTexture(m.channel, url);
        applied.push(m.channel);
      }
    }
    if (applied.length === 0) return;
    flashApplied(applied);
    goToEditorTab();
  };

  const anyMap = !!(pbr && (pbr.albedoUrl || pbr.normalUrl || pbr.roughnessUrl));

  const generatePbr = async (effectivePrompt: string) => {
    setPbrLoading(true); setPbr(null); setPbrErr(null);
    const r = await tryApiFetch<ScenarioResult>('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: effectivePrompt, modelId: modelId || undefined }),
    });
    if (r.ok) setPbr(r.data);
    else { setPbrErr(r.error); logger.warn(`[advanced-texture] scenario: ${r.error}`); }
    setPbrLoading(false);
  };

  const runScenario = () => generatePbr(prompt);

  // Reroll after a detected seam — re-generate with the seamless hint reinforced
  // (a fresh stochastic roll, biased toward a cleanly-wrapping tile).
  const rerollSeamless = () => {
    const base = prompt.trim();
    const boosted = base.toLowerCase().includes('seamless') ? base : `${base}, ${SEAMLESS_HINT}`;
    return generatePbr(boosted);
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
          <>
            <div className="grid grid-cols-3 gap-2">
              {PBR_MAP_CHANNELS.map(({ id, channel, key, label }) => {
                const url = pbr[key];
                if (!url) return null;
                const justApplied = appliedChannels.includes(channel);
                return (
                  <div key={id} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      data-testid={id}
                      src={url}
                      alt={label}
                      className="w-full aspect-square object-cover rounded border border-white/10"
                    />
                    <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b">
                      <span className="text-[10px] uppercase tracking-wide text-white/80">{label}</span>
                      <motion.button
                        type="button"
                        data-testid={`${id}-send`}
                        onClick={() => applyMap(channel, url)}
                        title={`Use as ${label} map`}
                        animate={justApplied ? { scale: [1, 1.15, 1] } : undefined}
                        transition={{ duration: 0.4 }}
                        className="flex items-center justify-center w-5 h-5 rounded bg-[var(--visual-gen)]/80 text-white hover:bg-[var(--visual-gen)] transition-colors"
                      >
                        {justApplied ? <Check className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </div>
            {pbr.seam?.hasSeam && (
              <div
                data-testid="scenario-seam-badge"
                title={`Wrap-around edge deltas — sides ${Math.round(pbr.seam.horizontal.delta * 100)}%, top/bottom ${Math.round(pbr.seam.vertical.delta * 100)}% (flagged above ${Math.round(pbr.seam.threshold * 100)}%)`}
                className="flex items-center justify-between gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Seam at {pbr.seam.worstEdge ?? 'edge'}
                </span>
                <button
                  type="button"
                  data-testid="scenario-reroll"
                  onClick={rerollSeamless}
                  disabled={pbrLoading}
                  title="Regenerate with the seamless hint reinforced"
                  className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-1 focus-visible:ring-red-400/50"
                >
                  <RefreshCw className={`w-3 h-3 ${pbrLoading ? 'animate-spin' : ''}`} />
                  Reroll seamless
                </button>
              </div>
            )}
            <button
              type="button"
              data-testid="scenario-use-as-material"
              onClick={applyAllMaps}
              disabled={!anyMap}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-[var(--visual-gen)] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Use as material
            </button>
          </>
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
