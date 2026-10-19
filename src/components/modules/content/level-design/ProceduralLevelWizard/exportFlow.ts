/**
 * The Blender export as ONE state machine, owned by the spec reducer.
 *
 * It used to be three component-local values (a pending plan, an "exporting"
 * flag, a result) guarded only by `disabled` attributes. The wizard unmounts on
 * every tab switch, so a running export lost its outcome; a prepared plan knew
 * nothing about the spec it was built from, so confirming after an edit shipped
 * the old settings under a card stating the old numbers; and a second confirm in
 * the same tick sent twice.
 *
 * idle -> prepared -> sending -> done | failed, plus `stale` for a plan whose
 * spec has since changed. The async fetch stays in the hook and settles through
 * dispatch, which is still valid after the wizard has unmounted.
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import type { ProcgenSpec } from '@/lib/level-design/procgen-spec';
import type { ExportPlan } from './exportPlan';
import type { SpawnPlacement } from './spawnPlacement';

/** A prepared export, held until the operator confirms the size it states. */
export interface PendingBlenderExport {
  plan: ExportPlan;
  placement: SpawnPlacement;
  /** The regenerated full-size grid this export will ship - NOT the preview grid. */
  grid: CellType[][];
}

export type ExportFlow =
  | { status: 'idle' }
  | { status: 'prepared'; pending: PendingBlenderExport; exportKey: string }
  | { status: 'stale'; pending: PendingBlenderExport; exportKey: string }
  | { status: 'sending'; pending: PendingBlenderExport; exportKey: string }
  | { status: 'done'; message: string }
  /** The plan is KEPT so Retry needs no re-prepare. */
  | { status: 'failed'; pending: PendingBlenderExport; exportKey: string; message: string };

export type ExportFlowAction =
  | { type: 'prepared'; pending: PendingBlenderExport; exportKey: string }
  | { type: 'confirm' }
  | { type: 'settled'; ok: boolean; message: string }
  | { type: 'cancel' }
  | { type: 'specChanged'; exportKey: string };

export const IDLE_EXPORT_FLOW: ExportFlow = { status: 'idle' };

/**
 * Everything of the spec that changes what an export ships: the regenerated
 * grid (algorithm, size, room band, corridor width, seed, ensureConnected) and
 * the spawn placement (the gameplay toggles). Level type is not an input of its
 * own - it only moves the size, which is already here.
 */
export function exportKey(spec: ProcgenSpec): string {
  return JSON.stringify([
    spec.algorithm, spec.gridWidth, spec.gridHeight, spec.roomCountMin, spec.roomCountMax,
    spec.corridorWidth, spec.seedLabel, spec.constraints,
  ]);
}

export function exportFlowReducer(flow: ExportFlow, action: ExportFlowAction): ExportFlow {
  switch (action.type) {
    case 'prepared':
      // A send in flight cannot be replaced from under itself.
      if (flow.status === 'sending') return flow;
      return { status: 'prepared', pending: action.pending, exportKey: action.exportKey };
    case 'confirm':
      // Single flight lives here: only a fresh plan, or a failed one, may send.
      if (flow.status === 'prepared' || flow.status === 'failed') {
        return { status: 'sending', pending: flow.pending, exportKey: flow.exportKey };
      }
      return flow;
    case 'settled':
      if (flow.status !== 'sending') return flow;
      return action.ok
        ? { status: 'done', message: action.message }
        : { status: 'failed', pending: flow.pending, exportKey: flow.exportKey, message: action.message };
    case 'cancel':
      return flow.status === 'sending' || flow.status === 'idle' ? flow : IDLE_EXPORT_FLOW;
    case 'specChanged':
      if ((flow.status === 'prepared' || flow.status === 'failed') && flow.exportKey !== action.exportKey) {
        return { status: 'stale', pending: flow.pending, exportKey: flow.exportKey };
      }
      return flow;
  }
}
