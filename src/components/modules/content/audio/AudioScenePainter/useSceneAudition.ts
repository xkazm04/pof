'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { logger } from '@/lib/logger';
import type { AuditionMix } from '@/lib/audio-scene-audition';

/** Web Audio time constant (seconds) for parameter glides as the listener moves. */
const GLIDE_S = 0.05;
/** Synthesised impulse responses are capped so a long decay stays cheap to build. */
const MAX_IR_S = 4;

interface Voice { url: string; gain: GainNode; filter: BiquadFilterNode; panner: StereoPannerNode }

interface Graph {
  ctx: AudioContext;
  dry: GainNode;
  wet: GainNode;
  convolver: ConvolverNode;
  voices: Map<string, Voice>;
  loading: Set<string>;
  reverbKey: string;
}

/** Exponentially decaying stereo noise: -60 dB at `decayTime`. */
function impulse(ctx: AudioContext, decayTime: number): AudioBuffer {
  const len = Math.max(1, Math.round(ctx.sampleRate * Math.min(MAX_IR_S, Math.max(0.05, decayTime))));
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-6.9 * (i / len));
  }
  return ir;
}

/**
 * The painter's LISTEN mode, live half: one looping source -> gain -> lowpass ->
 * stereo panner per heard emitter, into a dry bus and a convolver reverb whose
 * impulse is synthesised from the active zone's decay. It applies `mix` (from
 * `auditionMix`) and nothing else.
 *
 * Lifecycle (media-resource-lifecycle): nothing is created until `play()` — an
 * explicit click. Moving the listener only glides existing node parameters.
 * `stop()`, unmount AND the keep-alive LRU hiding the module (SuspendContext)
 * all close the context; showing the module again stays silent until Play.
 * The only network call is a GET of `/api/audio-asset` (a file read, no
 * provider, no billing).
 */
export function useSceneAudition(mix: AuditionMix | null) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const mixRef = useRef(mix);
  useEffect(() => { mixRef.current = mix; }, [mix]);
  /** Decoded clips by URL — AudioBuffers are context-independent, so they outlive a stop. */
  const clipCache = useRef(new Map<string, Promise<AudioBuffer>>());

  const loadClip = useCallback((ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const hit = clipCache.current.get(url);
    if (hit) return hit;
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`clip ${url} answered ${r.status}`);
        return r.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes));
    p.catch(() => clipCache.current.delete(url));
    clipCache.current.set(url, p);
    return p;
  }, []);

  const addVoice = useCallback(async (g: Graph, id: string, url: string) => {
    g.loading.add(id);
    try {
      const buffer = await loadClip(g.ctx, url);
      if (graphRef.current !== g) return; // stopped while loading
      const { ctx } = g;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const panner = ctx.createStereoPanner();
      source.connect(gain);
      gain.connect(filter);
      filter.connect(panner);
      panner.connect(g.dry);
      panner.connect(g.convolver);
      source.start();
      g.voices.set(id, { url, gain, filter, panner });
      const h = mixRef.current?.heard[id];
      if (h) {
        gain.gain.setTargetAtTime(h.gain, ctx.currentTime, GLIDE_S);
        filter.frequency.setTargetAtTime(h.lowpassHz, ctx.currentTime, GLIDE_S);
        panner.pan.setTargetAtTime(h.pan, ctx.currentTime, GLIDE_S);
      }
    } catch (e) {
      logger.warn('[audition] clip failed to load', e);
      if (graphRef.current === g) setError('A clip could not be loaded — that emitter stays silent.');
    } finally {
      g.loading.delete(id);
    }
  }, [loadClip]);

  /** Apply a mix to a live graph: glide params in place; only a newly heard emitter adds a voice. */
  const sync = useCallback((g: Graph, m: AuditionMix): Promise<unknown> => {
    const t = g.ctx.currentTime;
    const reverbKey = `${m.reverb.decayTime}|${m.reverb.wetDry}`;
    if (reverbKey !== g.reverbKey) {
      g.reverbKey = reverbKey;
      g.convolver.buffer = impulse(g.ctx, m.reverb.decayTime);
      g.wet.gain.setTargetAtTime(m.reverb.wetDry, t, GLIDE_S);
    }
    const adds: Promise<void>[] = [];
    for (const [id, v] of g.voices) {
      const h = m.heard[id];
      if (h && h.clipUrl !== v.url) { // rebound: retire the old clip, load the new one
        v.gain.disconnect();
        g.voices.delete(id);
        continue;
      }
      v.gain.gain.setTargetAtTime(h ? h.gain : 0, t, GLIDE_S);
      if (!h) continue;
      v.filter.frequency.setTargetAtTime(h.lowpassHz, t, GLIDE_S);
      v.panner.pan.setTargetAtTime(h.pan, t, GLIDE_S);
    }
    for (const [id, h] of Object.entries(m.heard)) {
      if (!g.voices.has(id) && !g.loading.has(id)) adds.push(addVoice(g, id, h.clipUrl));
    }
    return Promise.all(adds);
  }, [addVoice]);

  const stop = useCallback(() => {
    const g = graphRef.current;
    graphRef.current = null;
    if (g) void g.ctx.close();
    setPlaying(false);
  }, []);

  const play = useCallback(async () => {
    if (graphRef.current) return;
    const Ctor = globalThis.AudioContext;
    if (!Ctor) { setError('Web Audio is not available in this browser.'); return; }
    const ctx = new Ctor();
    const dry = ctx.createGain();
    dry.connect(ctx.destination);
    const convolver = ctx.createConvolver();
    const wet = ctx.createGain();
    wet.gain.value = 0;
    convolver.connect(wet);
    wet.connect(ctx.destination);
    const g: Graph = { ctx, dry, wet, convolver, voices: new Map(), loading: new Set(), reverbKey: '' };
    graphRef.current = g;
    setError(null);
    setPlaying(true);
    if (mixRef.current) await sync(g, mixRef.current);
  }, [sync]);

  useEffect(() => {
    const g = graphRef.current;
    if (g && mix) void sync(g, mix);
  }, [mix, sync]);

  // Hidden by the keep-alive LRU, or unmounted: close the context. Shown again:
  // this re-runs and only re-arms the cleanup — it never plays by itself.
  useSuspendableEffect(() => stop, [stop]);

  return { playing, error, play, stop };
}
