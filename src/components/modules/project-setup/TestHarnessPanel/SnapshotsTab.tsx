'use client';

import { useMemo, useState } from 'react';
import {
  Camera, CheckCircle2, XCircle, Loader2, RotateCcw, AlertTriangle, Stamp,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_VIOLET, OPACITY_8, OPACITY_10,
} from '@/lib/chart-colors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { describeAccept, parsePresetIds, reviewRows, type ReviewRow } from '@/lib/pof-bridge/snapshot-review';
import type { PofSnapshotDiffReport } from '@/types/pof-bridge';
import { snapshotStatusColor } from './helpers';

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshots Tab — the visual-regression loop: capture, read the diff, accept.
// Every bridge call is a click; an accept is confirmed first because it
// overwrites <project>/.pof/snapshots/<id>-baseline.png with no restore.
// ═══════════════════════════════════════════════════════════════════════════════

interface SnapshotsTabProps {
  diffReport: PofSnapshotDiffReport | null;
  isCapturing: boolean;
  /** Preset ids to capture (the active suite's, or a loose list with no suite). */
  presets: string[];
  /** Name of the suite the presets are saved to (null: not saved to a suite). */
  suiteName?: string | null;
  onPresetsChange: (ids: string[]) => void;
  onCapture: (ids: string[]) => Promise<unknown> | void;
  onAccept: (ids: string[]) => Promise<unknown> | void;
  onRefresh: () => Promise<void>;
}

export function SnapshotsTab({
  diffReport, isCapturing, presets, suiteName = null, onPresetsChange, onCapture, onAccept, onRefresh,
}: SnapshotsTabProps) {
  const [draft, setDraft] = useState(() => presets.join(', '));
  const [pendingAccept, setPendingAccept] = useState<string[] | null>(null);
  const review = useMemo(() => (diffReport ? reviewRows(diffReport) : null), [diffReport]);
  const draftIds = parsePresetIds(draft);

  const commitDraft = () => onPresetsChange(draftIds);
  const captureNow = () => {
    commitDraft();
    void onCapture(draftIds);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Visual Regression Diffs</span>
        <button
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text disabled:opacity-40"
          disabled={isCapturing}
          onClick={onRefresh}
        >
          <RotateCcw className={`w-3 h-3 ${isCapturing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Presets + capture */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            aria-label="Snapshot preset ids"
            className="flex-1 min-w-0 px-2 py-1 rounded bg-surface-deep border border-border text-xs font-mono text-text"
            placeholder="main-overview, char-closeup"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
          />
          <button
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium disabled:opacity-40"
            style={{ background: `${ACCENT_VIOLET}${OPACITY_10}`, color: ACCENT_VIOLET }}
            disabled={isCapturing || draftIds.length === 0}
            onClick={captureNow}
          >
            <Camera className="w-3.5 h-3.5" />
            Capture &amp; compare
          </button>
        </div>
        <p className="text-2xs text-text-muted">
          Camera preset ids from the project&apos;s .pof/camera-presets.json
          {suiteName ? ` - saved to "${suiteName}" and captured when it runs.` : ' - no suite selected, so they are not saved.'}
        </p>
      </div>

      {!diffReport && !isCapturing && (
        <div className="text-center py-8 text-xs text-text-muted">
          <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No snapshot diff report yet.</p>
          <p className="mt-1 opacity-60">
            Enter preset ids and Capture &amp; compare, or Refresh to read the plugin&apos;s latest report.
          </p>
        </div>
      )}

      {isCapturing && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded text-xs"
          style={{ background: `${ACCENT_CYAN}${OPACITY_10}`, color: ACCENT_CYAN }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Capturing and reading back the diff...</span>
        </div>
      )}

      {diffReport && review && (
        <div className="space-y-2">
          {/* Summary bar */}
          <div
            className="flex items-center gap-3 px-3 py-2 rounded"
            style={{
              background: `${diffReport.overallStatus === 'passed' ? STATUS_SUCCESS : STATUS_ERROR}${OPACITY_10}`,
            }}
          >
            {diffReport.overallStatus === 'passed' ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
            ) : (
              <XCircle className="w-4 h-4" style={{ color: STATUS_ERROR }} />
            )}
            <span className="text-xs font-medium text-text">
              {diffReport.overallStatus === 'passed' ? 'All snapshots match' : 'Visual regressions detected'}
            </span>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span style={{ color: STATUS_SUCCESS }}>{diffReport.summary.passed} passed</span>
              <span style={{ color: STATUS_ERROR }}>{diffReport.summary.failed} failed</span>
              {diffReport.summary.noBaseline > 0 && (
                <span style={{ color: STATUS_WARNING }}>{diffReport.summary.noBaseline} no baseline</span>
              )}
              {review.bulkLabel && (
                <button
                  className="flex items-center gap-1 px-2 py-0.5 rounded font-medium disabled:opacity-40"
                  style={{ background: `${ACCENT_VIOLET}${OPACITY_10}`, color: ACCENT_VIOLET }}
                  disabled={isCapturing}
                  onClick={() => setPendingAccept(review.acceptable)}
                >
                  {review.bulkLabel}
                </button>
              )}
            </div>
          </div>

          {/* Per-preset results */}
          {review.rows.map((row) => (
            <SnapshotResultRow
              key={row.presetId}
              row={row}
              disabled={isCapturing}
              onAccept={() => setPendingAccept([row.presetId])}
            />
          ))}

          <div className="text-xs text-text-muted text-right">
            Threshold: {diffReport.diffThreshold}% · Generated: {new Date(diffReport.generatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingAccept !== null && diffReport !== null}
        onClose={() => setPendingAccept(null)}
        onConfirm={() => { if (pendingAccept) void onAccept(pendingAccept); }}
        title={`Accept ${pendingAccept?.length ?? 0} as baseline?`}
        description={
          pendingAccept && diffReport
            ? `${describeAccept(diffReport, pendingAccept)}. PoF then recaptures and re-compares to verify.`
            : ''
        }
        confirmLabel="Confirm"
      />
    </div>
  );
}

function SnapshotResultRow({ row, disabled, onAccept }: { row: ReviewRow; disabled: boolean; onAccept: () => void }) {
  const { result } = row;
  const color = snapshotStatusColor(result.status);
  const Icon = result.status === 'passed' ? CheckCircle2 : result.status === 'failed' ? XCircle : AlertTriangle;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs"
      style={{ background: `${color}${OPACITY_8}` }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <span className="text-text font-medium truncate flex-1" title={result.presetId}>{result.presetName}</span>
      {result.status === 'failed' && (
        <span className="text-xs font-mono" style={{ color: STATUS_ERROR }}>
          {result.diffPercentage.toFixed(2)}% ({result.diffPixelCount} px)
        </span>
      )}
      {result.status === 'no-baseline' && (
        <span className="text-xs" style={{ color: STATUS_WARNING }}>No baseline</span>
      )}
      {result.status === 'resolution-mismatch' && (
        <span className="text-xs" style={{ color: ACCENT_ORANGE }}>Resolution mismatch</span>
      )}
      {result.status === 'passed' && (
        <span className="text-xs" style={{ color: STATUS_SUCCESS }}>
          {result.maxPixelDiff}px max diff
        </span>
      )}
      {row.acceptable && (
        <button
          aria-label={`Accept ${result.presetId} as baseline`}
          title={row.overwrites ? 'Replaces the existing baseline image' : 'Creates the first baseline image'}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded font-medium disabled:opacity-40"
          style={{ color: ACCENT_VIOLET }}
          disabled={disabled}
          onClick={onAccept}
        >
          <Stamp className="w-3 h-3" />
          Accept
        </button>
      )}
    </div>
  );
}
