'use client';

import { useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, FileWarning, Radio, RefreshCw, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  withOpacity, OPACITY_8, OPACITY_20,
} from '@/lib/chart-colors';
import { tryApiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import { StatusTag } from '@/components/ui/StatusTag';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT } from '../_shared/data';

/* ── The ledger the route returns (mirrors src/lib/animation/reality-ledger.mjs) ─ */

export interface LedgerSummary {
  sourceFiles: number;
  contentAssets: number;
  referenced: number;
  existing: number;
  missing: number;
  emptyShells: number;
  orphans: number;
  runtimeFallbacks: number;
  status: 'green' | 'red';
}

export interface AnimationLedger {
  projectPath?: string;
  summary: LedgerSummary;
  missing: { path: string; kind: string; referencedBy: string[] }[];
  emptyShells: { path: string; kind: string; sizeBytes: number; referencedBy: string[] }[];
  orphans: { path: string; kind: string; sizeBytes: number }[];
  runtimeFallbacks: { signal: string; source: string }[];
}

type PanelState = 'no-project' | 'not-read' | 'reading' | 'read' | 'error';

interface BucketDef {
  key: keyof Pick<LedgerSummary, 'missing' | 'emptyShells' | 'orphans' | 'runtimeFallbacks'>;
  label: string;
  blurb: string;
  color: string;
  Icon: LucideIcon;
}

const BUCKETS: BucketDef[] = [
  { key: 'missing', label: 'Missing', color: STATUS_ERROR, Icon: AlertCircle,
    blurb: 'Referenced by generated C++, absent from Content/.' },
  { key: 'emptyShells', label: 'Empty shells', color: STATUS_WARNING, Icon: FileWarning,
    blurb: 'Present but too small to hold sections or notifies.' },
  { key: 'orphans', label: 'Orphans', color: STATUS_INFO, Icon: Search,
    blurb: 'On disk, referenced by no generated code.' },
  { key: 'runtimeFallbacks', label: 'Runtime fallbacks', color: STATUS_ERROR, Icon: Radio,
    blurb: 'Failure signals found in the project logs.' },
];

/**
 * Animation Reality Ledger.
 *
 * Reconciles four views of the animation system — what the generated UE5 C++
 * references, what exists in `Content/`, whether it is a usable asset or an
 * empty shell, and what the logs say failed at runtime — by calling
 * `GET /api/animation-ledger?projectPath=…` (`src/lib/animation/reality-ledger.mjs`).
 *
 * Two rules this panel exists to keep:
 *  - the read is a **filesystem walk**, so it happens only on an explicit click,
 *    never on mount and never on a poll;
 *  - having read nothing is not a clean bill of health, and the panel says which
 *    of the two it is showing.
 */
export function AnimationRealityLedger() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [ledger, setLedger] = useState<AnimationLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const state: PanelState = !projectPath ? 'no-project'
    : isReading ? 'reading'
      : error ? 'error'
        : ledger ? 'read'
          : 'not-read';

  const run = useCallback(async () => {
    if (!projectPath) return;
    setIsReading(true);
    setError(null);
    const res = await tryApiFetch<AnimationLedger>(
      `/api/animation-ledger?projectPath=${encodeURIComponent(projectPath)}`,
    );
    if (res.ok) {
      setLedger(res.data);
      setError(null);
    } else {
      setLedger(null);
      setError(res.error);
    }
    setIsReading(false);
  }, [projectPath]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader label="Animation Reality Ledger" color={ACCENT} />
        <button
          type="button"
          data-testid="anim-ledger-run"
          onClick={run}
          disabled={!projectPath || isReading}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-surface-deep px-2 py-1 text-xs font-mono uppercase tracking-[0.15em] text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isReading ? 'animate-spin' : ''}`} aria-hidden />
          {ledger ? 'Re-read project' : 'Read project'}
        </button>
      </div>

      <Provenance state={state} projectPath={projectPath} error={error} ledger={ledger} />

      {state === 'read' && ledger && <LedgerBody ledger={ledger} />}
    </BlueprintPanel>
  );
}

/* ── What the panel is currently showing, stated ───────────────────────────── */

function Provenance({ state, projectPath, error, ledger }: {
  state: PanelState; projectPath: string; error: string | null; ledger: AnimationLedger | null;
}) {
  return (
    <div
      data-testid="anim-ledger-state"
      data-state={state}
      className="text-xs font-mono text-text-muted mt-1 mb-3 leading-relaxed"
    >
      {state === 'no-project' && (
        <>
          <span className="font-bold" style={{ color: STATUS_WARNING }}>NOT READ</span>
          {' — '}no UE project path is set, so nothing has been reconciled. This panel is empty because it
          has not looked, not because your animation assets are in order.
        </>
      )}
      {state === 'not-read' && (
        <>
          <span className="font-bold" style={{ color: STATUS_WARNING }}>NOT READ YET</span>
          {' — '}press <span className="text-text">Read project</span> to reconcile what the generated C++
          references against what exists under <span className="text-text">{projectPath}</span>. It walks
          the project, so it runs only when you ask. Until then this panel reports nothing, which is not a
          clean bill of health.
        </>
      )}
      {state === 'reading' && <>Walking Source/ and Content/ under <span className="text-text">{projectPath}</span>…</>}
      {state === 'error' && (
        <>
          <span className="font-bold" style={{ color: STATUS_ERROR }}>READ FAILED</span>
          {' — '}<span className="text-text">{error}</span>. Nothing was reconciled, so no finding below is
          an absence of problems.
        </>
      )}
      {state === 'read' && ledger && (
        <>
          <span className="font-bold" style={{ color: STATUS_SUCCESS }}>SOURCE: </span>
          {ledger.summary.sourceFiles} generated C++/header file{ledger.summary.sourceFiles === 1 ? '' : 's'}
          {' '}and {ledger.summary.contentAssets} asset{ledger.summary.contentAssets === 1 ? '' : 's'} under
          {' '}<span className="text-text">{ledger.projectPath ?? projectPath}</span>;
          {' '}{ledger.summary.existing} of {ledger.summary.referenced} referenced asset
          {ledger.summary.referenced === 1 ? '' : 's'} resolved on disk.
        </>
      )}
    </div>
  );
}

/* ── Findings ──────────────────────────────────────────────────────────────── */

function LedgerBody({ ledger }: { ledger: AnimationLedger }) {
  const red = ledger.summary.status === 'red';
  return (
    <div className="space-y-4">
      <div
        data-testid="anim-ledger-summary"
        data-status={ledger.summary.status}
        className="flex flex-wrap items-center gap-2"
      >
        <StatusTag level={red ? 'bad' : 'ok'} word={red ? 'Out of reality' : 'Reconciled'} />
        {BUCKETS.map((b) => (
          <span
            key={b.key}
            data-testid={`anim-ledger-count-${b.key}`}
            data-count={String(ledger.summary[b.key])}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-mono"
            style={{
              color: b.color,
              backgroundColor: withOpacity(b.color, OPACITY_8),
              border: `1px solid ${withOpacity(b.color, OPACITY_20)}`,
            }}
          >
            <b.Icon className="w-3 h-3 flex-shrink-0" aria-hidden />
            {ledger.summary[b.key]} {b.label}
          </span>
        ))}
      </div>

      {BUCKETS.map((b) => (
        <Bucket key={b.key} def={b} rows={rowsFor(ledger, b.key)} />
      ))}
    </div>
  );
}

interface LedgerRow { primary: string; secondary?: string }

function rowsFor(ledger: AnimationLedger, key: BucketDef['key']): LedgerRow[] {
  switch (key) {
    case 'missing':
      return ledger.missing.map((r) => ({
        primary: r.path,
        secondary: `${r.kind} · referenced by ${r.referencedBy.join(', ') || 'unknown'}`,
      }));
    case 'emptyShells':
      return ledger.emptyShells.map((r) => ({
        primary: r.path,
        secondary: `${r.kind} · ${r.sizeBytes} bytes · referenced by ${r.referencedBy.join(', ') || 'unknown'}`,
      }));
    case 'orphans':
      return ledger.orphans.map((r) => ({ primary: r.path, secondary: `${r.kind} · ${r.sizeBytes} bytes` }));
    case 'runtimeFallbacks':
      return ledger.runtimeFallbacks.map((r) => ({ primary: r.signal, secondary: r.source }));
  }
}

function Bucket({ def, rows }: { def: BucketDef; rows: LedgerRow[] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: def.color }}>
          {def.label}
        </span>
        <span className="text-xs font-mono text-text-muted">{def.blurb}</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-text-muted bg-surface-deep">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden style={{ color: STATUS_SUCCESS }} />
          None found in this read.
        </div>
      ) : (
        rows.map((r, i) => (
          <div
            key={`${r.primary}-${i}`}
            data-testid="anim-ledger-finding"
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              backgroundColor: withOpacity(def.color, OPACITY_8),
              border: `1px solid ${withOpacity(def.color, OPACITY_20)}`,
            }}
          >
            <span className="font-mono font-bold text-text break-all">{r.primary}</span>
            {r.secondary && <span className="font-mono text-text-muted break-all">{r.secondary}</span>}
          </div>
        ))
      )}
    </div>
  );
}
