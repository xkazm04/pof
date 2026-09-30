import { Hammer, Zap } from 'lucide-react';
import { MODULE_LABELS } from '@/lib/module-registry';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, OPACITY_10, statusBorder } from '@/lib/chart-colors';
import type { BuildTarget } from './types';

const ACCENT = MODULE_COLORS.evaluator;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What building a target clears, in words ("unblocks 3 features across 3 modules"). */
export function unblockSummary(target: BuildTarget): string {
  const n = target.newlyReady.length;
  if (n === 0) return 'unblocks nothing yet on its own';
  return `unblocks ${plural(n, 'feature')} across ${plural(target.moduleCount, 'module')}`;
}

interface BuildActionProps {
  target: BuildTarget;
  onBuild: (key: string) => void;
  onPreview: (key: string | null) => void;
  disabled: boolean;
}

/** Hover / focus previews the edges a build clears; leaving ends the preview. */
function previewHandlers(key: string, onPreview: (key: string | null) => void) {
  return {
    onMouseEnter: () => onPreview(key),
    onMouseLeave: () => onPreview(null),
    onFocus: () => onPreview(key),
    onBlur: () => onPreview(null),
  };
}

/** The global best next build — shown without selecting anything. */
export function UnblockCallout({ target, onBuild, onPreview, disabled }: BuildActionProps) {
  const moduleLabel = MODULE_LABELS[target.moduleId] ?? target.moduleId;
  return (
    <SurfaceCard className="p-3 flex items-center gap-3 flex-wrap">
      <Zap className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} aria-hidden="true" />
      <p className="flex-1 min-w-0 text-xs text-text-muted">
        <span className="text-text font-semibold">Build {target.featureName}</span>
        <span> ({moduleLabel}) — {unblockSummary(target)}</span>
      </p>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Build ${target.featureName}`}
        title={`Dispatch a feature-fix CLI task for ${moduleLabel} / ${target.featureName}`}
        onClick={() => onBuild(target.key)}
        {...previewHandlers(target.key, onPreview)}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, borderColor: statusBorder(ACCENT), color: ACCENT }}
      >
        <Hammer className="w-3 h-3" aria-hidden="true" />
        Build
      </button>
    </SurfaceCard>
  );
}

interface BuildChipProps extends BuildActionProps {
  /** Show the owning module when it is not the selected one. */
  showModule: boolean;
}

/** One 'Build first' frontier chip on a blocked feature row. */
export function BuildChip({ target, onBuild, onPreview, disabled, showModule }: BuildChipProps) {
  const gain = target.newlyReady.length;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Build ${target.featureName}`}
      title={`Build ${target.featureName} — ${unblockSummary(target)}`}
      onClick={() => onBuild(target.key)}
      {...previewHandlers(target.key, onPreview)}
      className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded border focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, borderColor: statusBorder(ACCENT), color: ACCENT }}
    >
      <Hammer className="w-2.5 h-2.5" aria-hidden="true" />
      {showModule && (
        <span className="text-text-muted">{MODULE_LABELS[target.moduleId] ?? target.moduleId}/</span>
      )}
      {target.featureName}
      {gain > 0 && <span className="text-text-muted"> (+{gain})</span>}
    </button>
  );
}
