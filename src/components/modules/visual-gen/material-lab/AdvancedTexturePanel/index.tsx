'use client';

import { motion } from 'framer-motion';
import { Sparkles, Loader2, ArrowUpRight, Maximize2, Workflow, Brush, ArrowRight, Wand2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { isNotConfigured } from './helpers';
import { PBR_MAP_CHANNELS, tileBtn, tileInput } from './constants';
import { useAdvancedTexturePanel } from './useAdvancedTexturePanel';

export function AdvancedTexturePanel() {
  const {
    prompt, setPrompt, modelId, setModelId, pbr, pbrErr, pbrLoading,
    imageId, setImageId, style, setStyle, jobId, upErr, upLoading,
    uzImageId, setUzImageId, uzPrompt, setUzPrompt, uzJob, uzErr, uzLoading,
    cnPrompt, setCnPrompt, cnImageId, setCnImageId, cnPreproc, setCnPreproc, cnResult, cnErr, cnLoading,
    ipPrompt, setIpPrompt, ipImageId, setIpImageId, ipMaskId, setIpMaskId, ipResult, ipErr, ipLoading,
    appliedChannels,
    applyMap, applyAllMaps, anyMap,
    runScenario, rerollSeamless, runUpscale, runUnzoom, runControlNet, runInpaint,
  } = useAdvancedTexturePanel();

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
