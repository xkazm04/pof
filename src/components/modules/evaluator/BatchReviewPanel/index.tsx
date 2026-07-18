'use client';

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MOTION } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import {
  Play, Square, Loader2, RotateCcw, Zap, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL, statusBg, statusBorder, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { formatDurationBetween } from '@/lib/format';
import type { BatchReviewState } from '@/types/batch-review';
import { ACCENT } from './constants';
import { ModuleRow } from './ModuleRow';

export function BatchReviewPanel() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const [batch, setBatch] = useState<BatchReviewState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  // Monotonic poll token: under a slow server an earlier poll can resolve after
  // a later one — only the newest issued poll may commit its snapshot.
  const pollTokenRef = useRef(0);

  // Poll batch status
  const pollStatus = useCallback(async () => {
    const token = ++pollTokenRef.current;
    try {
      const data = await apiFetch<{ batch: BatchReviewState | null }>('/api/feature-matrix/batch-review');
      if (token !== pollTokenRef.current) return; // a newer poll already resolved
      setBatch(data.batch);
    } catch { /* silent */ }
  }, []);

  const isRunning = batch?.status === 'running';

  // Initial fetch (+ refetch on resume). Suspend-aware.
  useSuspendableEffect(() => { pollStatus(); }, [pollStatus]);

  // Own the poll interval from the OBSERVED running state, not the start
  // action. Previously the interval was created only inside startBatch, so a
  // tab switch / remount / page reload during a running batch left the panel
  // frozen at the last-seen percent forever. Driving it off batch.status means
  // the poll always resumes when a running batch is observed.
  useSuspendableEffect(() => {
    if (!isRunning) return;
    const id = setInterval(pollStatus, 3000);
    return () => clearInterval(id);
  }, [isRunning, pollStatus]);

  const startBatch = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      const appOrigin = window.location.origin;
      await apiFetch('/api/feature-matrix/batch-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appOrigin, projectPath, projectName, ueVersion }),
      });
      // Fetch the now-running batch; the interval effect arms itself off the
      // resulting `running` status.
      await pollStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setIsStarting(false);
    }
  }, [pollStatus]);

  const abortBatch = useCallback(async () => {
    try {
      await apiFetch('/api/feature-matrix/batch-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abort' }),
      });
    } catch {
      // The batch may have finished server-side between render and click (the
      // abort then 400s). Fall through to pollStatus so the UI still refreshes
      // instead of staying stuck on a stale "Reviewing…".
    } finally {
      await pollStatus();
    }
  }, [pollStatus]);

  const clearBatch = useCallback(async () => {
    try {
      await apiFetch('/api/feature-matrix/batch-review', { method: 'DELETE' });
      setBatch(null);
    } catch { /* silent */ }
  }, []);

  // Compute progress
  const completed = batch?.modules.filter(m => m.status === 'completed').length ?? 0;
  const errored = batch?.modules.filter(m => m.status === 'error').length ?? 0;
  // Skipped modules are terminal too — count them toward "resolved" so the bar
  // can reach 100% instead of stalling short while the status reads "Complete".
  const skipped = batch?.modules.filter(m => m.status === 'skipped').length ?? 0;
  const total = batch?.modules.length ?? 0;
  const pct = total > 0 ? Math.round(((completed + errored + skipped) / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: ACCENT }} />
          <h3 className="text-sm font-semibold text-text">Batch Review</h3>
          {batch && (
            <span className="text-xs text-text-muted">
              {completed}/{total} modules
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={abortBatch}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all hover:brightness-110"
              style={{
                color: STATUS_ERROR,
                backgroundColor: statusBg(STATUS_ERROR),
                border: `1px solid ${statusBorder(STATUS_ERROR)}`,
              }}
            >
              <Square className="w-3 h-3" />
              Abort
            </button>
          )}
          {batch && !isRunning && (
            <button
              onClick={clearBatch}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-text-muted hover:text-text transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          )}
          {!isRunning && (
            <button
              onClick={startBatch}
              disabled={isStarting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 hover:brightness-110"
              style={{
                backgroundColor: `${ACCENT}${OPACITY_10}`,
                color: ACCENT,
                border: `1px solid ${ACCENT}${OPACITY_30}`,
              }}
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Review All Modules
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="text-xs rounded-md px-3 py-2"
          style={{
            color: STATUS_ERROR,
            backgroundColor: statusBg(STATUS_ERROR),
            border: `1px solid ${statusBorder(STATUS_ERROR)}`,
          }}
        >
          {error}
        </div>
      )}

      {/* Progress bar */}
      {batch && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">
                {isRunning ? 'Reviewing...' : batch.status === 'completed' ? 'Complete' : batch.status === 'aborted' ? 'Aborted' : 'Finished with errors'}
                {batch.startedAt && (
                  <span className="ml-1.5 text-text-muted">
                    {formatDurationBetween(batch.startedAt, batch.completedAt)}
                  </span>
                )}
              </span>
              <span className="text-text-muted-hover">{pct}%</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden flex">
              {completed > 0 && (
                <div
                  className="h-full transition-all duration-slow"
                  style={{ width: `${(completed / total) * 100}%`, backgroundColor: STATUS_SUCCESS, opacity: 0.8 }}
                />
              )}
              {errored > 0 && (
                <div
                  className="h-full transition-all duration-slow"
                  style={{ width: `${(errored / total) * 100}%`, backgroundColor: STATUS_ERROR, opacity: 0.8 }}
                />
              )}
              {skipped > 0 && (
                <div
                  className="h-full transition-all duration-slow"
                  style={{ width: `${(skipped / total) * 100}%`, backgroundColor: STATUS_NEUTRAL, opacity: 0.6 }}
                />
              )}
            </div>
          </div>

          {/* Module list */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-muted-hover transition-colors"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Module details
          </button>

          {expanded && (
            <motion.div
              className="space-y-1"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: MOTION.staggerChildren } },
              }}
            >
              {batch.modules.map((mod) => (
                <ModuleRow key={mod.moduleId} mod={mod} />
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* Empty state */}
      {!batch && !error && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4" style={{ backgroundColor: `${ACCENT}10` }}>
            <Zap className="w-6 h-6" style={{ color: ACCENT }} />
          </div>
          <h3 className="text-sm font-semibold text-text mb-1">Batch Feature Review</h3>
          <p className="text-xs text-text-muted max-w-xs leading-relaxed">
            Scan all modules sequentially with Claude to detect implemented features, quality issues, and generate a comprehensive project status.
          </p>
          <button
            onClick={startBatch}
            disabled={isStarting}
            className="flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: `${ACCENT}14`, color: ACCENT, border: `1px solid ${ACCENT}38` }}
          >
            {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run First Review
          </button>
        </div>
      )}
    </div>
  );
}
