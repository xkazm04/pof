'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowUp, ArrowDown, Clock, HardDrive, AlertTriangle, AlertCircle, Tag, FolderOpen, CheckCircle, XCircle } from 'lucide-react';
import type { BuildRecord } from '@/lib/packaging/build-history-store';
import { platformLabel } from '@/lib/packaging/build-profiles';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';
import { formatBytes, formatDuration } from '@/lib/format';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface BuildComparisonProps {
  builds: BuildRecord[];
}

function DeltaBadge({ a, b, format, invertColor, metricLabel }: { a: number | null; b: number | null; format: (n: number) => string; invertColor?: boolean; metricLabel?: string }) {
  if (a == null || b == null) return <span className="text-2xs text-text-muted">-</span>;
  const diff = b - a;
  if (diff === 0) return <span className="text-2xs text-text-muted">same</span>;
  const positive = diff > 0;
  const isBetter = invertColor ? positive : !positive;
  const color = isBetter ? STATUS_SUCCESS : STATUS_ERROR;
  const Icon = positive ? ArrowUp : ArrowDown;
  const direction = positive ? 'increased' : 'decreased';
  const ariaLabel = metricLabel
    ? `${metricLabel} ${direction} by ${format(Math.abs(diff))}`
    : `${direction} by ${format(Math.abs(diff))}`;
  return (
    <span className="text-2xs font-mono inline-flex items-center gap-0.5" style={{ color }} aria-label={ariaLabel} title={ariaLabel}>
      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
      {positive ? '+' : ''}{format(diff)}
    </span>
  );
}

/**
 * One half of a comparison bar pair. The fill is proportional to `value / max`
 * (the larger of the two sides reaches its outer edge) and is anchored toward
 * the center divider via `align`, so the two bars grow outward and the heavier
 * side is felt at a glance. Color is green when this side holds the smaller
 * (better) value, red when it holds the larger, neutral when they tie.
 */
function MetricBar({ pct, color, align }: { pct: number; color: string; align: 'left' | 'right' }) {
  return (
    <div
      className="w-full max-w-[96px] h-1 rounded-full bg-border/40 overflow-hidden flex"
      style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
      aria-hidden="true"
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function CompareRow({ label, icon, leftVal, rightVal, delta, bars }: {
  label: string;
  icon: React.ReactNode;
  leftVal: React.ReactNode;
  rightVal: React.ReactNode;
  delta?: React.ReactNode;
  /** When both values are present, renders a proportional bar pair (smaller = better = green). */
  bars?: { left: number | null; right: number | null };
}) {
  let leftBar: React.ReactNode = null;
  let rightBar: React.ReactNode = null;
  if (bars && bars.left != null && bars.right != null) {
    const { left: bl, right: br } = bars;
    const max = Math.max(bl, br, 1);
    const tie = bl === br;
    leftBar = <MetricBar pct={(bl / max) * 100} color={tie ? STATUS_NEUTRAL : bl < br ? STATUS_SUCCESS : STATUS_ERROR} align="right" />;
    rightBar = <MetricBar pct={(br / max) * 100} color={tie ? STATUS_NEUTRAL : br < bl ? STATUS_SUCCESS : STATUS_ERROR} align="left" />;
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-1.5 border-b border-border/40 last:border-b-0">
      <div className="flex flex-col items-end gap-1 min-w-0">
        <span className="text-xs font-mono text-text-muted">{leftVal}</span>
        {leftBar}
      </div>
      <div className="flex flex-col items-center gap-0.5 px-2">
        <div className="flex items-center gap-1 text-text-muted">
          {icon}
          <span className="text-2xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        {delta && <div>{delta}</div>}
      </div>
      <div className="flex flex-col items-start gap-1 min-w-0">
        <span className="text-xs font-mono text-text-muted">{rightVal}</span>
        {rightBar}
      </div>
    </div>
  );
}

export function BuildComparison({ builds }: BuildComparisonProps) {
  const [leftId, setLeftId] = useState<number | null>(builds.length >= 2 ? builds[1].id : null);
  const [rightId, setRightId] = useState<number | null>(builds.length >= 1 ? builds[0].id : null);

  const left = builds.find((b) => b.id === leftId);
  const right = builds.find((b) => b.id === rightId);

  // Quick-pick comparisons people actually run, each as a {left, right} id pair.
  // `builds` arrives newest-first (created_at DESC). Older build sits on the
  // left (the baseline), newer/worse on the right, so deltas read naturally.
  const quickPicks = useMemo(() => {
    const last = builds[0] ?? null;
    const previous = builds[1] ?? null;
    const lastSuccess = builds.find((b) => b.status === 'success') ?? null;
    const lastFail = builds.find((b) => b.status === 'failed') ?? null;

    // Window the "this week" set to the 7 days leading up to the most recent
    // build (a pure derivation from props — avoids an impure Date.now() in render).
    const cutoff = last ? new Date(last.createdAt).getTime() - WEEK_MS : 0;
    const recentSized = builds.filter(
      (b) => b.sizeBytes != null && new Date(b.createdAt).getTime() >= cutoff,
    );
    let largest: BuildRecord | null = null;
    let smallest: BuildRecord | null = null;
    if (recentSized.length >= 2) {
      largest = recentSized.reduce((a, b) => (b.sizeBytes! > a.sizeBytes! ? b : a));
      smallest = recentSized.reduce((a, b) => (b.sizeBytes! < a.sizeBytes! ? b : a));
    }

    return [
      { label: 'Last vs previous', left: previous, right: last },
      { label: 'Last success vs last fail', left: lastSuccess, right: lastFail },
      { label: 'Largest vs smallest (7d)', left: smallest, right: largest },
    ];
  }, [builds]);

  if (builds.length < 2) {
    return (
      <div className="text-center text-text-muted text-xs py-6">
        Need at least 2 builds to compare
      </div>
    );
  }

  const buildOption = (b: BuildRecord) =>
    `#${b.id} ${platformLabel(b.platform)} ${b.config} ${b.status === 'success' ? '' : '(failed)'} ${b.version ?? ''}`.trim();

  const swap = () => {
    setLeftId(rightId);
    setRightId(leftId);
  };

  return (
    <div>
      {/* Quick-pick chips — one-click both selects */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="text-2xs uppercase tracking-wide text-text-muted mr-0.5">Quick pick</span>
        {quickPicks.map((pick) => {
          const enabled = pick.left != null && pick.right != null && pick.left.id !== pick.right.id;
          const active = enabled && leftId === pick.left!.id && rightId === pick.right!.id;
          return (
            <button
              key={pick.label}
              type="button"
              disabled={!enabled}
              onClick={() => {
                setLeftId(pick.left!.id);
                setRightId(pick.right!.id);
              }}
              title={enabled ? `Compare #${pick.left!.id} vs #${pick.right!.id}` : 'Not enough matching builds'}
              className={`text-2xs px-2 py-0.5 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
                active
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                  : 'border-border-bright text-text-muted enabled:hover:text-text enabled:hover:border-violet-500/40'
              }`}
            >
              {pick.label}
            </button>
          );
        })}
      </div>

      {/* Selectors */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={leftId ?? ''}
          onChange={(e) => setLeftId(Number(e.target.value) || null)}
          className="flex-1 bg-surface-deep border border-border-bright rounded px-2 py-1 text-xs text-text-muted font-mono outline-none focus:border-violet-500/50"
        >
          <option value="">Select build A</option>
          {builds.map((b) => (
            <option key={b.id} value={b.id}>{buildOption(b)}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={swap}
          disabled={leftId == null && rightId == null}
          title="Swap builds A and B"
          aria-label="Swap builds A and B"
          className="flex-shrink-0 p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <select
          value={rightId ?? ''}
          onChange={(e) => setRightId(Number(e.target.value) || null)}
          className="flex-1 bg-surface-deep border border-border-bright rounded px-2 py-1 text-xs text-text-muted font-mono outline-none focus:border-violet-500/50"
        >
          <option value="">Select build B</option>
          {builds.map((b) => (
            <option key={b.id} value={b.id}>{buildOption(b)}</option>
          ))}
        </select>
      </div>

      {/* Comparison table */}
      {left && right ? (
        <div className="rounded border border-border bg-background/60 p-3">
          {/* Build headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-3 pb-2 border-b border-border-bright">
            <div className="text-right">
              <div className="text-xs font-medium text-text">Build #{left.id}</div>
              <div className="text-2xs text-text-muted">{new Date(left.createdAt).toLocaleString()}</div>
            </div>
            <div className="px-3" />
            <div>
              <div className="text-xs font-medium text-text">Build #{right.id}</div>
              <div className="text-2xs text-text-muted">{new Date(right.createdAt).toLocaleString()}</div>
            </div>
          </div>

          <CompareRow
            label="Status"
            icon={<AlertCircle className="w-2.5 h-2.5" />}
            leftVal={
              <span className="inline-flex items-center gap-1" style={{ color: left.status === 'success' ? STATUS_SUCCESS : STATUS_ERROR }}>
                {left.status === 'success'
                  ? <CheckCircle className="w-3 h-3" aria-hidden="true" />
                  : <XCircle className="w-3 h-3" aria-hidden="true" />}
                {left.status}
              </span>
            }
            rightVal={
              <span className="inline-flex items-center gap-1" style={{ color: right.status === 'success' ? STATUS_SUCCESS : STATUS_ERROR }}>
                {right.status === 'success'
                  ? <CheckCircle className="w-3 h-3" aria-hidden="true" />
                  : <XCircle className="w-3 h-3" aria-hidden="true" />}
                {right.status}
              </span>
            }
          />

          <CompareRow
            label="Size"
            icon={<HardDrive className="w-2.5 h-2.5" />}
            leftVal={left.sizeBytes != null ? formatBytes(left.sizeBytes) : '-'}
            rightVal={right.sizeBytes != null ? formatBytes(right.sizeBytes) : '-'}
            delta={<DeltaBadge a={left.sizeBytes} b={right.sizeBytes} format={(n) => formatBytes(Math.abs(n))} metricLabel="Size" />}
            bars={{ left: left.sizeBytes, right: right.sizeBytes }}
          />

          <CompareRow
            label="Duration"
            icon={<Clock className="w-2.5 h-2.5" />}
            leftVal={left.durationMs != null ? formatDuration(left.durationMs) : '-'}
            rightVal={right.durationMs != null ? formatDuration(right.durationMs) : '-'}
            delta={<DeltaBadge a={left.durationMs} b={right.durationMs} format={(n) => formatDuration(Math.abs(n))} metricLabel="Duration" />}
            bars={{ left: left.durationMs, right: right.durationMs }}
          />

          <CompareRow
            label="Version"
            icon={<Tag className="w-2.5 h-2.5" />}
            leftVal={left.version ?? '-'}
            rightVal={right.version ?? '-'}
          />

          <CompareRow
            label="Warnings"
            icon={<AlertTriangle className="w-2.5 h-2.5" />}
            leftVal={left.warningCount}
            rightVal={right.warningCount}
            delta={<DeltaBadge a={left.warningCount} b={right.warningCount} format={(n) => String(Math.abs(n))} metricLabel="Warnings" />}
          />

          <CompareRow
            label="Config"
            icon={<FolderOpen className="w-2.5 h-2.5" />}
            leftVal={`${platformLabel(left.platform)} / ${left.config}`}
            rightVal={`${platformLabel(right.platform)} / ${right.config}`}
          />
        </div>
      ) : (
        <div className="text-center text-text-muted text-xs py-4">
          Select two builds to compare
        </div>
      )}
    </div>
  );
}
