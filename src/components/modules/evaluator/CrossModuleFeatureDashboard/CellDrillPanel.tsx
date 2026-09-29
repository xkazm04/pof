'use client';

import { useEffect, type ReactNode } from 'react';
import { Hammer, X, Lock, CheckCircle2, HelpCircle } from 'lucide-react';
import { MODULE_LABELS } from '@/lib/module-registry';
import { STATUS_SUCCESS, STATUS_BLOCKER, STATUS_NEUTRAL, statusBg, statusBorder } from '@/lib/chart-colors';
import type { DrillReadiness, DrillRow } from '@/lib/evaluator/feature-cell-drill';
import type { PlanItem } from '@/lib/implementation-planner/plan-generator';
import { STATUS_COLORS, STATUS_LABELS } from './constants';
import type { SelectedCell } from './types';

const moduleOf = (key: string) => key.slice(0, key.indexOf('::'));
const nameOf = (key: string) => key.slice(key.indexOf('::') + 2);

/** A dependency key as the user reads it: bare name in-module, `Module / name` across. */
function depLabel(key: string, homeModule: string): string {
  const mod = moduleOf(key);
  return mod === homeModule ? nameOf(key) : `${MODULE_LABELS[mod] ?? mod} / ${nameOf(key)}`;
}

const READINESS: Record<DrillReadiness, { label: string; color: string; Icon: typeof Hammer }> = {
  ready: { label: 'Ready', color: STATUS_SUCCESS, Icon: Hammer },
  blocked: { label: 'Blocked', color: STATUS_BLOCKER, Icon: Lock },
  done: { label: 'Done', color: STATUS_SUCCESS, Icon: CheckCircle2 },
  untracked: { label: 'Not in plan', color: STATUS_NEUTRAL, Icon: HelpCircle },
};

/** The one Build affordance of the Features tab — always an explicit click. */
export function BuildButton({ featureName, title, onClick, disabled, children }: {
  featureName: string;
  title?: string;
  onClick: () => void;
  disabled: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Build ${featureName}`}
      title={title ?? `Build ${featureName}`}
      onClick={onClick}
      className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border focus-ring disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      style={{ backgroundColor: statusBg(STATUS_SUCCESS), borderColor: statusBorder(STATUS_SUCCESS), color: STATUS_SUCCESS }}
    >
      <Hammer className="w-2.5 h-2.5" aria-hidden="true" />
      {children ?? 'Build'}
    </button>
  );
}

function DrillRowView({ row, homeModule, onBuildItem, onBuildKey, isBuilding }: {
  row: DrillRow;
  homeModule: string;
  onBuildItem: (item: PlanItem) => void;
  onBuildKey: (key: string) => void;
  isBuilding: boolean;
}) {
  const r = READINESS[row.readiness];
  return (
    <div role="group" aria-label={row.featureName} className="px-3 py-2 rounded-md hover:bg-surface-hover transition-colors">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: statusBg(r.color), color: r.color }}
        >
          <r.Icon className="w-2.5 h-2.5" aria-hidden="true" />
          {r.label}
        </span>
        <span className="text-xs text-text font-medium flex-1 min-w-0 truncate">{row.featureName}</span>
        {row.impactScore > 0 && (
          <span className="text-2xs text-text-muted flex-shrink-0" title="Impact score: how much building it unblocks">
            impact {row.impactScore}
          </span>
        )}
        {row.buildItem && (
          <BuildButton featureName={row.featureName} disabled={isBuilding} onClick={() => onBuildItem(row.buildItem!)} />
        )}
      </div>
      {row.readiness === 'blocked' && (
        <div className="mt-1 ml-1 space-y-1 text-2xs text-text-muted">
          <div>Waits on: {row.unmetDeps.map((k) => depLabel(k, homeModule)).join(', ')}</div>
          {row.frontier.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span>Build first:</span>
              {row.frontier.map((k) => (
                <BuildButton
                  key={k}
                  featureName={nameOf(k)}
                  title={`Build ${depLabel(k, homeModule)} — moves ${row.featureName} closer to ready`}
                  disabled={isBuilding}
                  onClick={() => onBuildKey(k)}
                >
                  {depLabel(k, homeModule)}
                </BuildButton>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The features behind one heatmap count, in place: ready ones build through the
 * gated plan door, blocked ones name what to build first. Esc or the close
 * button dismisses it.
 */
export function CellDrillPanel({ cell, rows, onBuildItem, onBuildKey, onClose, isBuilding, buildError }: {
  cell: SelectedCell;
  rows: DrillRow[];
  onBuildItem: (item: PlanItem) => void;
  onBuildKey: (key: string) => void;
  onClose: () => void;
  isBuilding: boolean;
  buildError: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = rows.filter((r) => r.readiness === 'ready').length;
  const blocked = rows.filter((r) => r.readiness === 'blocked').length;
  const label = MODULE_LABELS[cell.moduleId] ?? cell.moduleId;
  const statusColor = STATUS_COLORS[cell.status];

  return (
    <section
      data-testid="pof-cell-drill"
      aria-label={`${label} — ${STATUS_LABELS[cell.status]} features`}
      className="bg-surface border rounded-lg p-4"
      style={{ borderColor: statusBorder(statusColor) }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-text">{label}</span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: statusColor }}>
          {STATUS_LABELS[cell.status]}
        </span>
        <span className="text-2xs text-text-muted flex-1">
          {rows.length} feature{rows.length === 1 ? '' : 's'}
          {(ready > 0 || blocked > 0) && ` · ${ready} ready · ${blocked} blocked`}
          {isBuilding && ' · building…'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close features"
          className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors focus-ring"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {buildError && (
        <p role="alert" className="text-2xs mb-2 px-3" style={{ color: STATUS_BLOCKER }}>{buildError}</p>
      )}
      <div className="space-y-1">
        {rows.map((row) => (
          <DrillRowView
            key={row.key}
            row={row}
            homeModule={cell.moduleId}
            onBuildItem={onBuildItem}
            onBuildKey={onBuildKey}
            isBuilding={isBuilding}
          />
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-text-muted italic px-3 py-2">No features with this status</p>
        )}
      </div>
    </section>
  );
}
