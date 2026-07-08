'use client';

import {
  Camera, CheckCircle2, XCircle, Loader2, RotateCcw, AlertTriangle,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_ORANGE, OPACITY_8, OPACITY_10,
} from '@/lib/chart-colors';
import type { PofSnapshotDiffReport, PofSnapshotDiffResult } from '@/types/pof-bridge';
import { snapshotStatusColor } from './helpers';

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshots Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface SnapshotsTabProps {
  diffReport: PofSnapshotDiffReport | null;
  isCapturing: boolean;
  onRefresh: () => Promise<void>;
}

export function SnapshotsTab({ diffReport, isCapturing, onRefresh }: SnapshotsTabProps) {
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

      {!diffReport && !isCapturing && (
        <div className="text-center py-8 text-xs text-text-muted">
          <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No snapshot diff report available.</p>
          <p className="mt-1 opacity-60">
            Configure snapshot presets in your test suite, then run the suite to capture and compare screenshots.
          </p>
        </div>
      )}

      {isCapturing && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded text-xs"
          style={{ background: `${ACCENT_CYAN}${OPACITY_10}`, color: ACCENT_CYAN }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Capturing snapshots...</span>
        </div>
      )}

      {diffReport && (
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
            <div className="ml-auto flex gap-3 text-xs">
              <span style={{ color: STATUS_SUCCESS }}>{diffReport.summary.passed} passed</span>
              <span style={{ color: STATUS_ERROR }}>{diffReport.summary.failed} failed</span>
              {diffReport.summary.noBaseline > 0 && (
                <span style={{ color: STATUS_WARNING }}>{diffReport.summary.noBaseline} no baseline</span>
              )}
            </div>
          </div>

          {/* Per-preset results */}
          {diffReport.results.map((result) => (
            <SnapshotResultRow key={result.presetId} result={result} />
          ))}

          <div className="text-xs text-text-muted text-right">
            Threshold: {diffReport.diffThreshold}% · Generated: {new Date(diffReport.generatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

function SnapshotResultRow({ result }: { result: PofSnapshotDiffResult }) {
  const color = snapshotStatusColor(result.status);
  const Icon = result.status === 'passed' ? CheckCircle2 : result.status === 'failed' ? XCircle : AlertTriangle;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs"
      style={{ background: `${color}${OPACITY_8}` }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <span className="text-text font-medium truncate flex-1">{result.presetName}</span>
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
    </div>
  );
}
