'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Square, Loader2, CheckCircle, XCircle, Clock,
  RotateCcw, Zap, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';

// ── Types (mirroring API response) ──

type ModuleReviewStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

interface ModuleProgress {
  moduleId: string;
  label: string;
  featureCount: number;
  status: ModuleReviewStatus;
  executionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface BatchState {
  batchId: string;
  status: 'running' | 'completed' | 'error' | 'aborted';
  startedAt: string;
  completedAt: string | null;
  modules: ModuleProgress[];
  currentIndex: number;
}

const ACCENT = '#ef4444';

const STATUS_ICON: Record<ModuleReviewStatus, typeof CheckCircle> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  error: XCircle,
  skipped: ChevronRight,
};

const STATUS_COLOR: Record<ModuleReviewStatus, string> = {
  pending: 'var(--text-muted)',
  running: '#3b82f6',
  completed: '#4ade80',
  error: '#f87171',
  skipped: 'var(--text-muted)',
};

function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

export function BatchReviewPanel() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll batch status
  const pollStatus = useCallback(async () => {
    try {
      const data = await apiFetch<{ batch: BatchState | null }>('/api/feature-matrix/batch-review');
      setBatch(data.batch);
      // Stop polling when done
      if (data.batch && data.batch.status !== 'running') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch { /* silent */ }
  }, []);

  // Initial fetch + start polling if running
  useEffect(() => {
    pollStatus();
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pollStatus]);

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

      // Start polling
      await pollStatus();
      pollRef.current = setInterval(pollStatus, 3000);
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
      await pollStatus();
    } catch { /* silent */ }
  }, [pollStatus]);

  const clearBatch = useCallback(async () => {
    try {
      await apiFetch('/api/feature-matrix/batch-review', { method: 'DELETE' });
      setBatch(null);
    } catch { /* silent */ }
  }, []);

  const isRunning = batch?.status === 'running';

  // Compute progress
  const completed = batch?.modules.filter(m => m.status === 'completed').length ?? 0;
  const errored = batch?.modules.filter(m => m.status === 'error').length ?? 0;
  const total = batch?.modules.length ?? 0;
  const pct = total > 0 ? Math.round(((completed + errored) / total) * 100) : 0;

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
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#f87171] bg-[#f8717112] border border-[#f87171]/20 hover:bg-[#f8717120] transition-all"
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
                backgroundColor: `${ACCENT}18`,
                color: ACCENT,
                border: `1px solid ${ACCENT}35`,
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
        <div className="text-xs text-[#f87171] bg-[#f8717110] border border-[#f87171]/20 rounded-md px-3 py-2">
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
                  <span className="ml-1.5 text-[#4a4e6a]">
                    {formatDuration(batch.startedAt, batch.completedAt)}
                  </span>
                )}
              </span>
              <span className="text-text-muted-hover">{pct}%</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden flex">
              {completed > 0 && (
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${(completed / total) * 100}%`, backgroundColor: '#4ade80', opacity: 0.8 }}
                />
              )}
              {errored > 0 && (
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${(errored / total) * 100}%`, backgroundColor: '#f87171', opacity: 0.8 }}
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
            <div className="space-y-1">
              {batch.modules.map((mod) => {
                const Icon = STATUS_ICON[mod.status];
                const color = STATUS_COLOR[mod.status];
                const isModRunning = mod.status === 'running';

                return (
                  <div
                    key={mod.moduleId}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors"
                    style={{
                      backgroundColor: isModRunning ? '#3b82f608' : 'transparent',
                      border: isModRunning ? '1px solid #3b82f620' : '1px solid transparent',
                    }}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${isModRunning ? 'animate-spin' : ''}`}
                      style={{ color }}
                    />
                    <span className="text-xs text-text flex-1 min-w-0 truncate">
                      {mod.label}
                    </span>
                    <span className="text-2xs text-[#4a4e6a] flex-shrink-0">
                      {mod.featureCount} features
                    </span>
                    {mod.startedAt && mod.completedAt && (
                      <span className="text-2xs text-[#4a4e6a] flex-shrink-0 tabular-nums">
                        {formatDuration(mod.startedAt, mod.completedAt)}
                      </span>
                    )}
                    {mod.error && (
                      <span className="text-2xs text-[#f87171] flex-shrink-0 truncate max-w-[120px]" title={mod.error}>
                        {mod.error}
                      </span>
                    )}
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ color, backgroundColor: color + '15', border: `1px solid ${color}25` }}
                    >
                      {mod.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!batch && !error && (
        <p className="text-xs text-text-muted leading-relaxed">
          Run a feature review across all modules sequentially. Each module&apos;s features will be scanned by Claude and results imported to the database automatically.
        </p>
      )}
    </div>
  );
}
