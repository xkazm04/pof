'use client';

import { useState, useCallback, useEffect } from 'react';
import { Clock, Play, GitCommitHorizontal, CalendarClock, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { useProjectStore } from '@/stores/projectStore';
import { DEFAULT_SCHEDULE, parseTimeOfDay, type BuildSchedule } from '@/lib/packaging/build-scheduler';
import type { BuildProfile } from '@/lib/packaging/build-profiles';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';

interface ScheduleState {
  lastRunAt: string | null;
  lastCommit: string | null;
  lastOutcome: 'success' | 'failed' | 'skipped' | null;
  lastReason: string | null;
  lastBuildId: number | null;
  lastDurationMs: number | null;
}

interface ScheduleStatus {
  schedule: BuildSchedule;
  state: ScheduleState;
  running: boolean;
  describe: string;
  nextRunAt: string | null;
  dueNow: boolean;
  currentHead: string | null;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OUTCOME_COLOR: Record<NonNullable<ScheduleState['lastOutcome']>, string> = {
  success: STATUS_SUCCESS,
  failed: STATUS_ERROR,
  skipped: STATUS_INFO,
};

/**
 * The weekday list after pressing `day`. Empty `days` means EVERY day, so every
 * button reads on: pressing one turns that day off (the other six stay). Turning
 * off the last selected day would produce `[]` - every day, the opposite of the
 * press - so it is refused (null). Selecting the seventh day normalizes to `[]`.
 */
export function nextScheduleDays(days: number[], day: number): number[] | null {
  const current = days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : days;
  const next = current.includes(day)
    ? current.filter((d) => d !== day)
    : [...current, day].sort((a, b) => a - b);
  if (next.length === 0) return null;
  return next.length === 7 ? [] : next;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export function NightlyBuildScheduler({ profiles }: { profiles: BuildProfile[] }) {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // A failed read and a refused write each SAY so - never a silent snap-back to
  // the last-known (or default 'off') schedule.
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The time being typed; committed once on blur / Enter, and only when valid.
  const [timeDraft, setTimeDraft] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const qs = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
      setStatus(await apiFetch<ScheduleStatus>(`/api/packaging/schedule${qs}`));
      setReadError(null);
    } catch (e) {
      // Keep the last-known status on screen, but say it could not be refreshed.
      setReadError(errorText(e));
    }
  }, [projectPath]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll for status while visible (the server cron drives the actual builds).
  useSuspendableEffect(() => {
    const id = setInterval(refresh, UI_TIMEOUTS.schedulePoll);
    return () => clearInterval(id);
  }, [refresh]);

  const schedule = status?.schedule ?? DEFAULT_SCHEDULE;

  const save = useCallback(async (patch: Partial<BuildSchedule>) => {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch('/api/packaging/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', projectPath, projectName, ueVersion, ...patch }),
      });
      await refresh();
    } catch (e) {
      setActionError(`Save failed: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }, [projectPath, projectName, ueVersion, refresh]);

  const runNow = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch('/api/packaging/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-now', projectPath, projectName, ueVersion }),
      });
      await refresh();
    } catch (e) {
      setActionError(`Run now failed: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }, [projectPath, projectName, ueVersion, refresh]);

  const commitTime = () => {
    if (timeDraft === null || busy) return;
    const next = timeDraft;
    if (!parseTimeOfDay(next) || next === schedule.time) { setTimeDraft(null); return; }
    void save({ time: next }).then(() => setTimeDraft(null));
  };

  const toggleDay = (day: number) => {
    const days = nextScheduleDays(schedule.days, day);
    if (days) save({ days });
  };

  const running = status?.running ?? false;
  const outcome = status?.state.lastOutcome ?? null;

  return (
    <div className="rounded border border-border-bright bg-surface-deep/40 p-3 space-y-3" data-testid="pof-nightly-scheduler">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4" style={{ color: MODULE_COLORS.systems }} />
          <span className="text-sm font-semibold text-text">Scheduled Builds</span>
          {running && (
            <span className="flex items-center gap-1 text-2xs" style={{ color: STATUS_INFO }}>
              <Loader2 className="w-3 h-3 animate-spin" /> running
            </span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.enabled}
            disabled={busy}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="accent-violet-500"
            data-testid="pof-nightly-enabled"
          />
          Enabled
        </label>
      </div>

      {/* Config row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="time"
            aria-label="Build time"
            value={timeDraft ?? schedule.time}
            disabled={busy}
            onChange={(e) => setTimeDraft(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTime(); }}
            className="bg-background border border-border-bright rounded px-2 py-1 text-xs text-text font-mono outline-none focus-ring"
            data-testid="pof-nightly-time"
          />
        </div>

        <div className="flex items-center gap-0.5">
          {DAY_LABELS.map((lbl, day) => {
            const on = schedule.days.length === 0 || schedule.days.includes(day);
            const every = schedule.days.length === 0;
            return (
              <button
                key={day}
                data-testid={`pof-nightly-day-${day}`}
                type="button"
                aria-label={DAY_NAMES[day]}
                aria-pressed={on}
                onClick={() => toggleDay(day)}
                disabled={busy}
                title={every ? 'Every day' : undefined}
                className={`w-6 h-6 rounded text-2xs font-medium transition-colors ${
                  on ? 'text-white' : 'text-text-muted border border-border-bright'
                }`}
                style={on ? { background: every ? MODULE_COLORS.systems : `${MODULE_COLORS.systems}cc` } : undefined}
              >
                {lbl}
              </button>
            );
          })}
        </div>

        <select
          value={schedule.profileId ?? ''}
          aria-label="Build profile"
          disabled={busy}
          onChange={(e) => save({ profileId: e.target.value || null })}
          className="bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted outline-none focus-ring"
          data-testid="pof-nightly-profile"
        >
          <option value="">Default profile</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.platform})</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.skipIfUnchanged}
            disabled={busy}
            onChange={(e) => save({ skipIfUnchanged: e.target.checked })}
            className="accent-violet-500"
            data-testid="pof-nightly-skip"
          />
          Skip if unchanged
        </label>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between gap-3 text-2xs text-text-muted flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span>{status?.describe ?? (readError ? 'Schedule unknown' : describePending())}</span>
          {schedule.enabled && <span>Next: <span className="text-text font-mono">{fmtTime(status?.nextRunAt ?? null)}</span></span>}
          <span className="flex items-center gap-1">
            <GitCommitHorizontal className="w-3 h-3" />
            <span className="font-mono">{status?.currentHead ? status.currentHead.slice(0, 8) : 'no git'}</span>
          </span>
          {outcome && (
            <span className="flex items-center gap-1">
              last:
              <span className="font-medium" style={{ color: OUTCOME_COLOR[outcome] }}>{outcome}</span>
              <span className="font-mono">{fmtTime(status?.state.lastRunAt ?? null)}</span>
            </span>
          )}
        </div>
        <button
          onClick={runNow}
          disabled={busy || running || !projectPath}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-white disabled:opacity-40 transition-colors"
          style={{ background: MODULE_COLORS.systems }}
          data-testid="pof-nightly-run-now"
        >
          <Play className="w-3 h-3" /> Run now
        </button>
      </div>

      {(readError || actionError) && (
        <div className="text-2xs" style={{ color: STATUS_ERROR }} role="alert" data-testid="pof-nightly-error">
          {actionError ?? `Could not load the schedule: ${readError}`}
        </div>
      )}

      {outcome && status?.state.lastReason && (
        <div className="text-2xs text-text-muted border-t border-border pt-2">{status.state.lastReason}</div>
      )}
    </div>
  );
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function describePending(): string {
  return 'Scheduled builds off';
}
