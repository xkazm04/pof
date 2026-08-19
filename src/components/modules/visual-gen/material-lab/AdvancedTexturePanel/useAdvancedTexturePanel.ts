import { useEffect, useRef, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { useMaterialStore, type TextureChannel } from '../useMaterialStore';
import type { ScenarioResult, ImageResult } from './types';
import { SEAMLESS_HINT, PBR_MAP_CHANNELS } from './constants';

export function useAdvancedTexturePanel() {
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

  // Clear the flash timer on unmount (and before re-arming it) — an uncleared
  // one fires setState into a torn-down component. UI_TIMEOUTS.copyFeedback is
  // the house value for this "flash then fade" acknowledgement.
  const flashTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
  }, []);

  const flashApplied = (channels: TextureChannel[]) => {
    setAppliedChannels(channels);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setAppliedChannels([]), UI_TIMEOUTS.copyFeedback);
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

  return {
    prompt, setPrompt, modelId, setModelId, pbr, pbrErr, pbrLoading,
    imageId, setImageId, style, setStyle, jobId, upErr, upLoading,
    uzImageId, setUzImageId, uzPrompt, setUzPrompt, uzJob, uzErr, uzLoading,
    cnPrompt, setCnPrompt, cnImageId, setCnImageId, cnPreproc, setCnPreproc, cnResult, cnErr, cnLoading,
    ipPrompt, setIpPrompt, ipImageId, setIpImageId, ipMaskId, setIpMaskId, ipResult, ipErr, ipLoading,
    appliedChannels,
    applyMap, applyAllMaps, anyMap,
    runScenario, rerollSeamless, runUpscale, runUnzoom, runControlNet, runInpaint,
  };
}
