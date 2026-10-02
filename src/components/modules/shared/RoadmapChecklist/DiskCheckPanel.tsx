'use client';

/**
 * "Check against disk" — one click verifies this module's disk-verifiable items
 * against the project's headers now, then lists a verdict per item with the one
 * action each proposes: Mark built (n) ticks every built row, Untick is per regressed
 * row, Finish sends an add-only Claude prompt naming the missing members. Nothing is
 * ticked, unticked or run until the matching button is clicked.
 */

import { HardDrive, Loader2, RefreshCw, Check, Wrench, Undo2 } from 'lucide-react';
import type { ChecklistItem } from '@/types/modules';
import type { VerificationInfo } from '@/stores/moduleStore';
import { buildFinishPrompt, type DiskPlan, type DiskRow, type DiskRowKind } from '@/lib/checklist-disk-check';
import type { DiskCheckState } from './useDiskCheck';

const KIND_LABEL: Record<DiskRowKind, string> = {
  built: 'built, unticked',
  confirmed: 'confirmed',
  partial: 'partial',
  stub: 'stub',
  absent: 'not on disk',
  regressed: 'ticked, not on disk',
};

const KIND_CLASS: Record<DiskRowKind, string> = {
  built: 'bg-status-green-subtle text-green-400',
  confirmed: 'bg-surface-hover text-text-muted',
  partial: 'bg-status-amber-subtle text-yellow-400',
  stub: 'bg-status-amber-subtle text-yellow-400',
  absent: 'bg-surface-hover text-text-muted',
  regressed: 'bg-status-red-subtle text-red-400',
};

const BTN = 'flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium border transition-colors disabled:opacity-50';

export interface DiskCheckPanelProps {
  items: ChecklistItem[];
  verifiableCount: number;
  state: DiskCheckState;
  plan: DiskPlan | null;
  /** Prior verdicts (watcher or earlier checks), for the never-verified disclosure */
  verification?: Record<string, VerificationInfo>;
  verifiableIds?: string[];
  isRunning: boolean;
  accentColor: string;
  onCheck: () => void;
  onApply: (ids: string[]) => void;
  onUntick: (id: string) => void;
  onRunPrompt: (itemId: string, prompt: string) => void;
}

function summary(plan: DiskPlan): string {
  const counts = new Map<DiskRowKind, number>();
  for (const row of plan.rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  const parts = [...counts].map(([kind, n]) => `${n} ${KIND_LABEL[kind]}`);
  if (plan.unverifiable > 0) parts.push(`${plan.unverifiable} not verifiable`);
  return parts.join(' · ');
}

function DiskRowView({ row, item, isRunning, onUntick, onRunPrompt }: {
  row: DiskRow;
  item: ChecklistItem | undefined;
  isRunning: boolean;
  onUntick: (id: string) => void;
  onRunPrompt: (itemId: string, prompt: string) => void;
}) {
  return (
    <li data-testid={`pof-disk-row-${row.itemId}`} className="flex items-center gap-2 py-1 text-2xs">
      <span className="font-mono text-text-muted w-10 flex-shrink-0">{row.itemId}</span>
      <span className="flex-1 min-w-0 truncate text-text" title={item?.label}>{item?.label ?? row.itemId}</span>
      <span className={`px-1.5 py-0.5 rounded ${KIND_CLASS[row.kind]}`}>
        {KIND_LABEL[row.kind]}{row.kind === 'partial' ? ` ${Math.round(row.completeness * 100)}%` : ''}
      </span>
      {row.missingMembers.length > 0 && row.kind !== 'absent' && row.kind !== 'regressed' && (
        <span className="text-yellow-400 truncate max-w-[40%]" title={row.missingMembers.join(', ')}>
          missing: {row.missingMembers.join(', ')}
        </span>
      )}
      {row.action === 'untick' && (
        <button type="button" onClick={() => onUntick(row.itemId)} className={`${BTN} border-border text-red-400 hover:bg-status-red-subtle`}>
          <Undo2 className="w-3 h-3" />
          Untick
        </button>
      )}
      {row.action === 'finish' && row.finish && item && (
        <button
          type="button"
          disabled={isRunning}
          onClick={() => onRunPrompt(row.itemId, buildFinishPrompt(item, row.finish!))}
          title={`Claude adds only: ${row.finish.missingMembers.join(', ') || 'the stub body'} to ${row.finish.className}`}
          className={`${BTN} border-border text-yellow-400 hover:bg-status-amber-subtle`}
        >
          <Wrench className="w-3 h-3" />
          Finish
        </button>
      )}
    </li>
  );
}

export function DiskCheckPanel({
  items, verifiableCount, state, plan, verification, verifiableIds, isRunning, accentColor,
  onCheck, onApply, onUntick, onRunPrompt,
}: DiskCheckPanelProps) {
  if (verifiableCount === 0) return null;
  const neverVerified = verification && verifiableIds
    ? verifiableIds.filter((id) => !verification[id]).length
    : null;
  const checking = state.phase === 'checking';
  const done = state.phase === 'done' && plan;

  return (
    <section data-testid="pof-disk-check" className="rounded-lg border border-border bg-surface px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2 text-2xs">
        <HardDrive className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
        <span className="flex-1 min-w-0 text-text-muted">
          {done
            ? <>Checked now: <span className="text-text">{summary(plan)}</span></>
            : <>
                {verifiableCount} item{verifiableCount === 1 ? '' : 's'} verifiable against your headers
                {neverVerified !== null && neverVerified > 0 && ` · ${neverVerified} never verified`}
              </>}
        </span>
        {done && plan.built.length > 0 && (
          <button
            type="button"
            onClick={() => onApply(plan.built)}
            className={`${BTN} border-border text-green-400 hover:bg-status-green-subtle`}
          >
            <Check className="w-3 h-3" />
            Mark built ({plan.built.length})
          </button>
        )}
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className={`${BTN} border-border text-text-muted hover:text-text hover:bg-surface-hover`}
        >
          {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : done ? <RefreshCw className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
          {done ? 'Re-check' : `Check against disk (${verifiableCount} item${verifiableCount === 1 ? '' : 's'})`}
        </button>
      </div>

      {state.phase === 'error' && (
        <p role="alert" className="text-2xs text-red-400">Check failed: {state.reason}. Nothing was ticked or recorded.</p>
      )}
      {state.phase === 'unavailable' && (
        <p className="text-2xs text-text-muted">Set the UE project path first — the check reads its Source/ headers.</p>
      )}
      {done && (
        <ul className="divide-y divide-border">
          {plan.rows.map((row) => (
            <DiskRowView
              key={row.itemId}
              row={row}
              item={items.find((i) => i.id === row.itemId)}
              isRunning={isRunning}
              onUntick={onUntick}
              onRunPrompt={onRunPrompt}
            />
          ))}
        </ul>
      )}
      {state.phase === 'done' && state.unreadable.length > 0 && (
        <p className="text-2xs text-yellow-400" title={state.unreadable.join('\n')}>
          {state.unreadable.length} header{state.unreadable.length === 1 ? '' : 's'} could not be read and were not checked.
        </p>
      )}
    </section>
  );
}
