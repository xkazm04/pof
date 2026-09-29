'use client';

import { useState } from 'react';
import { Wand2, Dices, SlidersHorizontal } from 'lucide-react';
import {
  findLayoutRemedies, type LayoutDiagnosis, type LeverRemedy,
} from '@/lib/level-design/layout-remedies';
import type { PreviewStats } from '@/lib/level-design/procgen-preview';
import type { ProcgenSpec } from '@/lib/level-design/procgen-spec';
import type { SizeParams, GameplayConstraints } from './types';

export interface LayoutRemedyActions {
  setSeed: (seed: string) => void;
  updateSize: (key: keyof SizeParams, value: number) => void;
  toggleConstraint: (key: keyof GameplayConstraints) => void;
}

interface LayoutRemediesProps extends LayoutRemedyActions {
  spec: ProcgenSpec;
}

const SIZE_KEYS = ['gridWidth', 'gridHeight', 'roomCountMin', 'roomCountMax', 'corridorWidth'] as const;

/** Apply a lever through the wizard's own dispatchers — no second writer of the spec. */
function applyLever(spec: ProcgenSpec, remedy: LeverRemedy, act: LayoutRemedyActions) {
  for (const key of SIZE_KEYS) {
    const v = remedy.patch[key];
    if (v !== undefined && v !== spec[key]) act.updateSize(key, v);
  }
  for (const [key, on] of Object.entries(remedy.patch.constraints ?? {}) as [keyof GameplayConstraints, boolean][]) {
    if (spec.constraints[key] !== on) act.toggleConstraint(key);
  }
}

const describeStats = (s: PreviewStats) =>
  `${s.regions} region${s.regions === 1 ? '' : 's'} · ${Math.round(s.connectivity * 100)}% · ${s.roomCount} rooms`;

const ROW = 'w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 text-left text-xs text-violet-100 hover:bg-emerald-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-accent)] transition-colors';

/**
 * "Find a fix" under a fragmented preview. The search runs on the click, never
 * on a drag, and lists only remedies it MEASURED to give one region; the old
 * value stays on every row so applying one is a visible change, not a silent one.
 */
export function LayoutRemedies({ spec, ...act }: LayoutRemediesProps) {
  // The diagnosis belongs to the spec it was computed for; any edit retires it.
  const [result, setResult] = useState<{ spec: ProcgenSpec; diagnosis: LayoutDiagnosis } | null>(null);
  const diagnosis = result?.spec === spec ? result.diagnosis : null;

  if (!diagnosis) {
    return (
      <button
        type="button"
        onClick={() => setResult({ spec, diagnosis: findLayoutRemedies(spec) })}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-900/30 text-xs font-bold uppercase tracking-wider text-violet-200 hover:bg-violet-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-accent)] transition-colors"
        data-testid="layout-remedies-find"
      >
        <Wand2 className="w-3.5 h-3.5" aria-hidden="true" /> Find a fix
      </button>
    );
  }
  if (!diagnosis.needed) return null;

  const { seedScan, remedies, verdict } = diagnosis;
  return (
    <div className="space-y-2 rounded-lg border border-violet-900/40 bg-black/40 p-3" data-testid="layout-remedies">
      <p className="text-xs text-violet-300/80" data-testid="layout-remedies-verdict">{verdict}</p>

      {remedies.length > 0 && (
        <ul className="space-y-1" aria-label="One-lever fixes at this seed">
          {remedies.map((r) => (
            <li key={r.field}>
              <button type="button" className={ROW} onClick={() => applyLever(spec, r, act)} data-testid={`layout-remedy-${r.field}`}>
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  {r.label}
                </span>
                <span className="text-emerald-300/80 font-mono">{describeStats(r.after)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {seedScan.connected.length > 0 && (
        <ul className="space-y-1" aria-label={`Connected seeds after ${seedScan.from}`}>
          {seedScan.connected.map((c) => (
            <li key={c.seedValue}>
              <button type="button" className={ROW} onClick={() => act.setSeed(c.seedLabel)} data-testid="layout-remedy-seed">
                <span className="flex items-center gap-2">
                  <Dices className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  Use seed {c.seedLabel}
                  <span className="text-violet-400/60">(was {spec.seedLabel.trim() === '' ? `default ${seedScan.from}` : spec.seedLabel})</span>
                </span>
                <span className="text-emerald-300/80 font-mono">{describeStats(c.after)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
