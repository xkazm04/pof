'use client';

import { useCallback, useMemo, useState } from 'react';
import { Download, ShieldCheck, TriangleAlert } from 'lucide-react';
import { downloadBlob } from '@/lib/download';
import { logger } from '@/lib/logger';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import {
  layoutAgreement, previewConfigFromSpec, PROCGEN_ENGINES, type ProcgenSpec,
} from '@/lib/level-design/procgen-spec';
import {
  exportProcgenGrid, procgenGridExportFilename, PROCGEN_GRID_EXPORT_VERSION,
} from '@/lib/level-design/procgen-grid-export';
import { MAX_EXPORT_SIZE } from './ProceduralLevelWizard/exportPlan';

interface ProcgenGridReplayExportProps {
  spec: ProcgenSpec;
  disabled?: boolean;
}

/**
 * The determinism inversion, offered as a button.
 *
 * Every other UE path REGENERATES a layout from the seed, which is why
 * `layoutAgreement` has always answered `false` for the preview vs UE pair.
 * This one ships the preview's own cells as data for
 * `scripts/ue/procgen_replay.py` to replay — so the agreement is exact BY
 * CONSTRUCTION, and the block below states that at the rung it was proven: the
 * data is identical; runtime placement in Unreal is unverified. Both halves are
 * on screen, and neither is derived here — they come from `procgen-spec` and
 * `procgen-grid-export`, which is where they are tested.
 */
export function ProcgenGridReplayExport({ spec, disabled }: ProcgenGridReplayExportProps) {
  const [note, setNote] = useState<string | null>(null);
  const facts = PROCGEN_ENGINES['grid-replay'];
  const parity = useMemo(() => layoutAgreement('browser-preview', 'grid-replay'), []);

  const handleExport = useCallback(() => {
    try {
      // Regenerated at export size from the SAME spec — deterministic, so this
      // is the identical grid the live preview showed at its own scale.
      const preview = generatePreview(previewConfigFromSpec(spec, MAX_EXPORT_SIZE));
      const artifact = exportProcgenGrid(spec, preview);
      const filename = procgenGridExportFilename(spec);
      downloadBlob(new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }), filename);
      setNote(`${filename} — ${artifact.width}x${artifact.height} cells, v${artifact.version}. Replay with: py scripts/ue/procgen_replay.py --grid <file>`);
    } catch (e) {
      logger.warn('Procgen grid export failed', e);
      setNote(e instanceof Error ? e.message : 'Export failed');
    }
  }, [spec]);

  return (
    <div
      data-testid="procgen-grid-replay"
      className="space-y-2 px-3 py-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">{facts.label}</p>
          <p className="text-xs text-indigo-300/60 mt-0.5">{facts.implementation}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={disabled}
          data-testid="procgen-export-grid"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border border-indigo-500/50 text-indigo-200 hover:text-indigo-50 disabled:opacity-40 focus-ring whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Export grid for UE replay
        </button>
      </div>

      <p className="flex gap-1.5 text-xs text-emerald-300/80" data-testid="procgen-replay-proven">
        <ShieldCheck className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>
          <strong className="text-emerald-200/90">Exact by construction.</strong> The replay consumes these cells
          verbatim — it regenerates nothing, so it reads none of the spec&apos;s declared fields (v{PROCGEN_GRID_EXPORT_VERSION} artifact).
        </span>
      </p>

      <p className="flex gap-1.5 text-xs text-amber-300/80" data-testid="procgen-replay-unverified">
        <TriangleAlert className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>{parity.reason}</span>
      </p>

      {note && (
        <p className="text-xs font-mono text-indigo-300/70 break-all" data-testid="procgen-export-note">{note}</p>
      )}
    </div>
  );
}
