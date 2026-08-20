'use client';

import { ArrowDownToLine, TriangleAlert } from 'lucide-react';
import {
  ueDungeonParamsFromSpec,
  describeIgnoredFields,
  layoutAgreement,
  PROCGEN_ENGINES,
  type ProcgenSpec,
} from '@/lib/level-design/procgen-spec';

interface ProcgenSpecHandoffProps {
  /** The spec the wizard published. */
  spec: ProcgenSpec;
  /** Fill the panel's fields from the spec's UE projection. */
  onAdopt: (roomCount: number, seed: number) => void;
  disabled?: boolean;
}

/**
 * The wizard's {@link ProcgenSpec} offered to the UE dungeon panel.
 *
 * Both surfaces now speak ONE spec, and this block exists so that shared type
 * cannot be mistaken for a shared level. `ARPGLevelGenerator` reads two of the
 * spec's seven declared inputs; the other five are listed by name and value as
 * DROPPED, every lossy projection step (band collapse, clamp, unsigned seed) is
 * printed, and the parity line states outright that the UE bake will not
 * reproduce the preview grid. Nothing here is derived in the component — it all
 * comes from `procgen-spec`, which is where the honesty is tested.
 */
export function ProcgenSpecHandoff({ spec, onAdopt, disabled }: ProcgenSpecHandoffProps) {
  const params = ueDungeonParamsFromSpec(spec);
  const ignored = describeIgnoredFields('ue-arpg-generator', spec);
  const parity = layoutAgreement('browser-preview', 'ue-arpg-generator');

  return (
    <div
      data-testid="dungeon-spec-handoff"
      className="space-y-3 px-3 py-3 rounded-lg border border-violet-900/40 bg-violet-950/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">From the procgen wizard</p>
          <p className="text-xs text-violet-400/60 mt-0.5" data-testid="dungeon-handoff-summary">
            {spec.algorithm.toUpperCase()} · {spec.gridWidth}x{spec.gridHeight} · rooms{' '}
            {spec.roomCountMin}–{spec.roomCountMax} · seed {spec.seedLabel.trim() === '' ? '(default)' : spec.seedLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdopt(params.roomCount, params.seed)}
          disabled={disabled}
          data-testid="dungeon-adopt-spec"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border border-violet-500/50 text-violet-300 hover:text-violet-100 disabled:opacity-40 focus-ring whitespace-nowrap"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
          Adopt {params.roomCount} rooms / seed {params.seed}
        </button>
      </div>

      {params.notes.length > 0 && (
        <ul data-testid="dungeon-handoff-notes" className="space-y-1">
          {params.notes.map((note) => (
            <li key={note} className="flex gap-1.5 text-xs text-amber-300/80">
              <TriangleAlert className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1">
        <p className="text-xs text-violet-400/70">
          {PROCGEN_ENGINES['ue-arpg-generator'].label} does not read:
        </p>
        <ul data-testid="dungeon-handoff-ignored" className="flex flex-wrap gap-1.5">
          {ignored.map((line) => (
            <li
              key={line}
              className="px-1.5 py-0.5 rounded border border-violet-900/50 text-xs text-violet-400/60 line-through"
            >
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-violet-300/60 leading-relaxed" data-testid="dungeon-handoff-parity">
        <strong className="text-violet-200/80">Independent previews.</strong> {parity.reason}
      </p>
    </div>
  );
}
