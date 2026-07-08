'use client';

import React, { useState } from 'react';
import {
  Camera, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, OPACITY_8, OPACITY_10,
} from '@/lib/chart-colors';
import type { PofTestResult, PofSnapshotDiffReport } from '@/types/pof-bridge';
import type { SuiteRunResult } from './types';
import { testStatusColor, testStatusIcon } from './helpers';

// ═══════════════════════════════════════════════════════════════════════════════
// Results Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface ResultsTabProps {
  history: SuiteRunResult[];
  isRunning: boolean;
  onClear: () => void;
}

export function ResultsTab({ history, isRunning, onClear }: ResultsTabProps) {
  const [expandedRunIdx, setExpandedRunIdx] = useState<number | null>(history.length > 0 ? 0 : null);

  if (history.length === 0 && !isRunning) {
    return (
      <div className="text-center py-8 text-xs text-text-muted">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No test results yet. Run a suite to see results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isRunning && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded text-xs"
          style={{ background: `${ACCENT_CYAN}${OPACITY_10}`, color: ACCENT_CYAN }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Suite is running...</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{history.length} run{history.length !== 1 ? 's' : ''}</span>
        <button
          className="text-xs text-text-muted hover:text-text"
          onClick={onClear}
        >
          Clear History
        </button>
      </div>

      {history.map((run, idx) => {
        const isOpen = expandedRunIdx === idx;
        const StatusIcon = run.status === 'passed' ? CheckCircle2 : run.status === 'failed' ? XCircle : AlertTriangle;
        const statusColor = run.status === 'passed' ? STATUS_SUCCESS : run.status === 'failed' ? STATUS_ERROR : STATUS_WARNING;
        const duration = run.finishedAt - run.startedAt;
        const passedCount = run.testResults.filter((r) => r.status === 'passed').length;
        const totalCount = run.testResults.length;

        return (
          <div key={idx} className="rounded border overflow-hidden" style={{ borderColor: `${statusColor}30` }}>
            <button
              className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-surface-2 transition-colors"
              onClick={() => setExpandedRunIdx(isOpen ? null : idx)}
            >
              {isOpen ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <StatusIcon className="w-3.5 h-3.5" style={{ color: statusColor }} />
              <span className="text-xs font-medium text-text flex-1">{run.suiteName}</span>
              <span className="text-xs font-mono" style={{ color: statusColor }}>
                {passedCount}/{totalCount} passed
              </span>
              <span className="text-xs text-text-muted">{(duration / 1000).toFixed(1)}s</span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t" style={{ borderColor: `${STATUS_NEUTRAL}20` }}>
                {run.testResults.map((result) => (
                  <TestResultCard key={result.testId} result={result} />
                ))}

                {run.snapshotReport && (
                  <SnapshotSummaryRow report={run.snapshotReport} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Single Test Result Card ──────────────────────────────────────────────────

function TestResultCard({ result }: { result: PofTestResult }) {
  const [expanded, setExpanded] = useState(result.status !== 'passed');
  const color = testStatusColor(result.status);
  const passedAsserts = result.assertions.filter((a) => a.status === 'passed').length;
  const iconType = testStatusIcon(result.status);

  return (
    <div className="rounded" style={{ background: `${color}${OPACITY_8}` }}>
      <button
        className="flex items-center gap-2 w-full text-left px-2.5 py-1.5"
        onClick={() => setExpanded((p) => !p)}
      >
        {React.createElement(iconType, {
          className: `w-3.5 h-3.5 shrink-0 ${result.status === 'running' ? 'animate-spin' : ''}`,
          style: { color },
        })}
        <span className="text-xs font-mono text-text flex-1 truncate">{result.testId}</span>
        <span className="text-xs" style={{ color }}>
          {passedAsserts}/{result.assertions.length} assertions
        </span>
        {result.durationMs !== undefined && (
          <span className="text-xs text-text-muted">{result.durationMs}ms</span>
        )}
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-1">
          {/* Assertion details */}
          {result.assertions.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5 text-xs pl-5"
            >
              {a.status === 'passed' ? (
                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" style={{ color: STATUS_SUCCESS }} />
              ) : (
                <XCircle className="w-2.5 h-2.5 shrink-0" style={{ color: STATUS_ERROR }} />
              )}
              <span className="text-text-muted truncate">{a.description}</span>
              {a.status === 'failed' && a.failureReason && (
                <span className="ml-auto shrink-0" style={{ color: STATUS_ERROR }}>
                  {a.actual} (expected {a.expected})
                </span>
              )}
            </div>
          ))}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {result.errors.map((err, i) => (
                <div key={i} className="text-xs pl-5" style={{ color: STATUS_ERROR }}>
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Logs */}
          {result.logs.length > 0 && (
            <div className="mt-1 max-h-20 overflow-y-auto">
              {result.logs.map((log, i) => (
                <div key={i} className="text-xs text-text-muted pl-5 font-mono">
                  <span className="opacity-50">[{log.time.toFixed(2)}s]</span> {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Snapshot Summary Row ─────────────────────────────────────────────────────

function SnapshotSummaryRow({ report }: { report: PofSnapshotDiffReport }) {
  const color = report.overallStatus === 'passed' ? STATUS_SUCCESS : STATUS_ERROR;
  return (
    <div className="rounded px-2.5 py-1.5" style={{ background: `${color}${OPACITY_8}` }}>
      <div className="flex items-center gap-2 text-xs">
        <Camera className="w-3.5 h-3.5" style={{ color }} />
        <span className="font-medium text-text">Snapshot Diff</span>
        <span className="ml-auto text-xs" style={{ color }}>
          {report.summary.passed}/{report.summary.totalPresets} passed
        </span>
      </div>
      {report.results.filter((r) => r.status === 'failed').length > 0 && (
        <div className="mt-1 space-y-0.5">
          {report.results
            .filter((r) => r.status === 'failed')
            .map((r) => (
              <div key={r.presetId} className="text-xs pl-5" style={{ color: STATUS_ERROR }}>
                {r.presetName}: {r.diffPercentage.toFixed(2)}% diff ({r.diffPixelCount} px)
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
