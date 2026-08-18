'use client';

import { Loader2, Monitor, X, AlertTriangle } from 'lucide-react';
import { scalePercent } from './exportPlan';
import type { PendingBlenderExport } from './useProceduralLevelWizard';

interface BlenderExportConfirmProps {
  pending: PendingBlenderExport;
  planSummary: string;
  spawnSummary: string;
  exporting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-widest text-violet-400/70">{label}</span>
      <span className="text-xs font-mono text-violet-100" data-testid={testId}>{value}</span>
    </div>
  );
}

/**
 * States what the export will actually contain BEFORE it runs.
 *
 * This step exists because the numbers it shows used to be unobtainable at the
 * moment of decision: the export shipped the capped preview grid, and the only
 * thing that knew about the downscale was a badge in a different component. The
 * operator now reads the exported dimensions, the scale, the seed and the object
 * count, and confirms those — or cancels.
 */
export function BlenderExportConfirm({
  pending, planSummary, spawnSummary, exporting, onConfirm, onCancel,
}: BlenderExportConfirmProps) {
  const { plan } = pending;
  return (
    <div
      data-testid="blender-export-confirm"
      className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3"
    >
      <p
        data-testid="blender-export-headline"
        className={`text-xs leading-relaxed ${plan.isFullSize ? 'text-emerald-300' : 'text-amber-300'}`}
      >
        {planSummary}
      </p>

      <div className="space-y-1.5 border-t border-emerald-500/20 pt-3">
        <Row label="Exported grid" value={`${plan.width} x ${plan.height}`} testId="blender-export-dimensions" />
        <Row label="Requested grid" value={`${plan.requestedWidth} x ${plan.requestedHeight}`} />
        <Row label="Scale" value={scalePercent(plan)} testId="blender-export-scale" />
        <Row label="Algorithm" value={plan.algorithm} />
        <Row
          label="Seed"
          value={`${plan.seedLabel === '' ? '(blank)' : plan.seedLabel} → ${plan.seedValue}`}
          testId="blender-export-seed"
        />
        <Row label="Blender objects" value={plan.objectCount.toLocaleString('en-US')} testId="blender-export-objects" />
      </div>

      <p data-testid="blender-export-spawns" className="text-xs leading-relaxed text-violet-300/70">
        {spawnSummary}
      </p>

      {plan.isHeavy && (
        <p
          data-testid="blender-export-heavy"
          className="flex items-start gap-2 text-xs leading-relaxed text-amber-300/90"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          The script creates one Blender object per non-empty cell. At{' '}
          {plan.objectCount.toLocaleString('en-US')} objects this will take Blender a long time.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onConfirm}
          disabled={exporting}
          data-testid="blender-export-run"
          className="focus-ring-outline flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
          {exporting ? 'Exporting…' : `Confirm ${plan.width}x${plan.height} export`}
        </button>
        <button
          onClick={onCancel}
          disabled={exporting}
          data-testid="blender-export-cancel"
          className="focus-ring-outline flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 border border-violet-900/50 text-violet-300/80"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
