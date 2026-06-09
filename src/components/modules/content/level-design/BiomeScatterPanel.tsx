'use client';

import { useState, useEffect } from 'react';
import { Trees, Loader2, Dice5 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { ScatterRun } from '@/types/procgen';

interface BiomeScatterPanelProps {
  onGenerate: (density: number, seed: number) => void;
  isGenerating: boolean;
}

export const DENSITY_MIN = 0.1;
export const DENSITY_MAX = 3;

/**
 * Pure validator for the density field. Returns an error string when the raw
 * input is empty, non-numeric (NaN), or outside [DENSITY_MIN, DENSITY_MAX];
 * null when the value is acceptable. Pure so it can be unit-tested in isolation.
 */
export function validateDensity(raw: string): string | null {
  if (raw.trim() === '') return 'Enter a density value';
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Density must be a number';
  if (n < DENSITY_MIN || n > DENSITY_MAX) return `Density must be between ${DENSITY_MIN} and ${DENSITY_MAX}`;
  return null;
}

/**
 * Pure validator for the seed field. Returns an error string when the raw input
 * is empty, non-numeric (NaN), non-integer, or negative; null when acceptable.
 */
export function validateSeed(raw: string): string | null {
  if (raw.trim() === '') return 'Enter a seed';
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Seed must be a number';
  if (!Number.isInteger(n)) return 'Seed must be a whole number';
  if (n < 0) return 'Seed must be 0 or greater';
  return null;
}

export function BiomeScatterPanel({ onGenerate, isGenerating }: BiomeScatterPanelProps) {
  // Inputs are kept as raw strings so out-of-range / cleared (NaN) values can be
  // validated and surfaced inline, rather than silently clamped at generate time.
  const [densityInput, setDensityInput] = useState('1');
  const [seedInput, setSeedInput] = useState('1337');
  const [lastRun, setLastRun] = useState<ScatterRun | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (isGenerating) return;
    let cancelled = false;
    void (async () => {
      const r = await tryApiFetch<ScatterRun | null>('/api/level-design/scatter-result');
      if (cancelled) return;
      if (r.ok) {
        setLastRun(r.data);
        setFetchError(null);
      } else {
        // Surface the failure instead of swallowing it silently.
        setFetchError(r.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGenerating]);

  const densityErr = validateDensity(densityInput);
  const seedErr = validateSeed(seedInput);
  const inputsValid = !densityErr && !seedErr;

  const handleGenerate = () => {
    if (!inputsValid) return; // button is disabled too — guard for safety
    const density = Number(densityInput);
    const seed = Math.floor(Number(seedInput));
    try {
      setGenerateError(null);
      onGenerate(density, seed);
    } catch (e) {
      logger.warn('Biome scatter dispatch failed', e);
      setGenerateError(e instanceof Error ? e.message : 'Failed to start scatter');
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 space-y-6 bg-[#03030a] text-violet-100 font-mono">
      <div className="flex items-center gap-3 border-b border-violet-900/30 pb-4">
        <div className="w-11 h-11 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center">
          <Trees className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase">Biome Scatter (UE)</h3>
          <p className="text-xs text-violet-400/60 uppercase tracking-wider mt-0.5">Drive AARPGVegetationScatter → props on the arena floor</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Density ×</span>
          <input
            type="number" min={DENSITY_MIN} max={DENSITY_MAX} step={0.1} value={densityInput}
            onChange={(e) => setDensityInput(e.target.value)}
            data-testid="scatter-density-input"
            aria-label="Density"
            aria-invalid={!!densityErr}
            aria-describedby="scatter-density-help"
            className={`w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border text-violet-100 outline-none focus:border-violet-500/70 ${densityErr ? 'border-red-500/60' : 'border-violet-900/50'}`}
          />
          <span
            id="scatter-density-help"
            data-testid="scatter-density-help"
            role={densityErr ? 'alert' : undefined}
            className={`block text-[11px] ${densityErr ? 'text-red-400' : 'text-violet-500/70'}`}
          >
            {densityErr ?? `Range ${DENSITY_MIN}–${DENSITY_MAX}`}
          </span>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Seed</span>
          <div className="flex gap-2">
            <input
              type="number" min={0} step={1} value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              data-testid="scatter-seed-input"
              aria-label="Seed"
              aria-invalid={!!seedErr}
              aria-describedby="scatter-seed-help"
              className={`w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border text-violet-100 outline-none focus:border-violet-500/70 ${seedErr ? 'border-red-500/60' : 'border-violet-900/50'}`}
            />
            <button
              type="button"
              onClick={() => setSeedInput(String(Math.floor(Math.random() * 100000)))}
              title="Randomize seed"
              className="px-3 rounded-lg border border-violet-900/50 text-violet-400 hover:text-violet-200"
            >
              <Dice5 className="w-4 h-4" />
            </button>
          </div>
          <span
            id="scatter-seed-help"
            data-testid="scatter-seed-help"
            role={seedErr ? 'alert' : undefined}
            className={`block text-[11px] ${seedErr ? 'text-red-400' : 'text-violet-500/70'}`}
          >
            {seedErr ?? 'Whole number ≥ 0'}
          </span>
        </label>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating || !inputsValid}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40"
        style={{
          backgroundColor: `${MODULE_COLORS.content}20`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}60`,
        }}
      >
        {isGenerating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Scattering…</>
        ) : (
          <><Trees className="w-5 h-5" /> Scatter Props (UE)</>
        )}
      </button>

      {generateError && (
        <div
          role="alert"
          data-testid="scatter-generate-error"
          className="text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
        >
          {generateError}
        </div>
      )}

      {fetchError ? (
        <div
          role="alert"
          data-testid="scatter-fetch-error"
          className="text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
        >
          Could not load last scatter: {fetchError}
        </div>
      ) : (
        <div className="text-xs px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20">
          {lastRun
            ? `Last scatter: ${lastRun.instanceCount} instances (seed ${lastRun.seed}) at ${lastRun.createdAt}`
            : 'No scatter yet. Set density + seed and scatter — props are placed (no-collision) on the arena floor.'}
        </div>
      )}
    </div>
  );
}
