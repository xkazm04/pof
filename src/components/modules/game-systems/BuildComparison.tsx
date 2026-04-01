'use client';

import { useState } from 'react';
import { ArrowLeftRight, ArrowUp, ArrowDown, Clock, HardDrive, AlertTriangle, AlertCircle, Tag, FolderOpen, CheckCircle, XCircle } from 'lucide-react';
import type { BuildRecord } from '@/lib/packaging/build-history-store';

interface BuildComparisonProps {
  builds: BuildRecord[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function DeltaBadge({ a, b, format, invertColor, metricLabel }: { a: number | null; b: number | null; format: (n: number) => string; invertColor?: boolean; metricLabel?: string }) {
  if (a == null || b == null) return <span className="text-2xs text-text-muted">-</span>;
  const diff = b - a;
  if (diff === 0) return <span className="text-2xs text-text-muted">same</span>;
  const positive = diff > 0;
  const isBetter = invertColor ? positive : !positive;
  const color = isBetter ? 'text-green-400' : 'text-red-400';
  const Icon = positive ? ArrowUp : ArrowDown;
  const direction = positive ? 'increased' : 'decreased';
  const ariaLabel = metricLabel
    ? `${metricLabel} ${direction} by ${format(Math.abs(diff))}`
    : `${direction} by ${format(Math.abs(diff))}`;
  return (
    <span className={`text-2xs font-mono inline-flex items-center gap-0.5 ${color}`} aria-label={ariaLabel} title={ariaLabel}>
      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
      {positive ? '+' : ''}{format(diff)}
    </span>
  );
}

function CompareRow({ label, icon, leftVal, rightVal, delta }: {
  label: string;
  icon: React.ReactNode;
  leftVal: React.ReactNode;
  rightVal: React.ReactNode;
  delta?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-1.5 border-b border-border/40 last:border-b-0">
      <div className="text-right">
        <span className="text-xs font-mono text-text-muted">{leftVal}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5 px-2">
        <div className="flex items-center gap-1 text-text-muted">
          {icon}
          <span className="text-2xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        {delta && <div>{delta}</div>}
      </div>
      <div>
        <span className="text-xs font-mono text-text-muted">{rightVal}</span>
      </div>
    </div>
  );
}

export function BuildComparison({ builds }: BuildComparisonProps) {
  const [leftId, setLeftId] = useState<number | null>(builds.length >= 2 ? builds[1].id : null);
  const [rightId, setRightId] = useState<number | null>(builds.length >= 1 ? builds[0].id : null);

  const left = builds.find((b) => b.id === leftId);
  const right = builds.find((b) => b.id === rightId);

  if (builds.length < 2) {
    return (
      <div className="text-center text-text-muted text-xs py-6">
        Need at least 2 builds to compare
      </div>
    );
  }

  const buildOption = (b: BuildRecord) =>
    `#${b.id} ${b.platform} ${b.config} ${b.status === 'success' ? '' : '(failed)'} ${b.version ?? ''}`.trim();

  return (
    <div>
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

        <ArrowLeftRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />

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
              <span className={`inline-flex items-center gap-1 ${left.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {left.status === 'success'
                  ? <CheckCircle className="w-3 h-3" aria-hidden="true" />
                  : <XCircle className="w-3 h-3" aria-hidden="true" />}
                {left.status}
              </span>
            }
            rightVal={
              <span className={`inline-flex items-center gap-1 ${right.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
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
          />

          <CompareRow
            label="Duration"
            icon={<Clock className="w-2.5 h-2.5" />}
            leftVal={left.durationMs != null ? formatDuration(left.durationMs) : '-'}
            rightVal={right.durationMs != null ? formatDuration(right.durationMs) : '-'}
            delta={<DeltaBadge a={left.durationMs} b={right.durationMs} format={(n) => formatDuration(Math.abs(n))} metricLabel="Duration" />}
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
            leftVal={`${left.platform} / ${left.config}`}
            rightVal={`${right.platform} / ${right.config}`}
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
