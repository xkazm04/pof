import { STATUS_ERROR, STATUS_WARNING, STATUS_INFO } from '@/lib/chart-colors';
import { type WarningSeverity } from '@/lib/state-machine-validator';
import type { EditorState, EditorTransition, DiffResult } from './types';

// ── Diff tracking ──

export function computeDiff(
  prevStates: EditorState[],
  prevTransitions: EditorTransition[],
  currStates: EditorState[],
  currTransitions: EditorTransition[],
): DiffResult {
  const prevStateIds = new Set(prevStates.map((s) => s.id));
  const currStateIds = new Set(currStates.map((s) => s.id));
  const prevTransIds = new Set(prevTransitions.map((t) => t.id));
  const currTransIds = new Set(currTransitions.map((t) => t.id));

  const prevStateMap = new Map(prevStates.map((s) => [s.id, s]));
  const prevTransMap = new Map(prevTransitions.map((t) => [t.id, t]));

  const newStates = currStates.filter((s) => !prevStateIds.has(s.id)).map((s) => s.name);
  const removedStates = prevStates.filter((s) => !currStateIds.has(s.id)).map((s) => s.name);
  const modifiedStates: string[] = [];
  for (const s of currStates) {
    const prev = prevStateMap.get(s.id);
    if (prev && (prev.name !== s.name || prev.priority !== s.priority || prev.flag !== s.flag)) {
      modifiedStates.push(s.name);
    }
  }

  // Resolve endpoint names from BOTH snapshots: a removed transition's state
  // may itself have been removed (removeState cascades to its transitions),
  // so looking it up only in the current states map falls back to a raw id.
  const currStateMap = new Map(currStates.map((s) => [s.id, s]));
  const resolveStateName = (id: string) => currStateMap.get(id)?.name ?? prevStateMap.get(id)?.name ?? id;
  const transitionLabel = (t: EditorTransition) => `${resolveStateName(t.from)} -> ${resolveStateName(t.to)}`;

  const newTransitions = currTransitions.filter((t) => !prevTransIds.has(t.id)).map(transitionLabel);
  const removedTransitions = prevTransitions.filter((t) => !currTransIds.has(t.id)).map(transitionLabel);
  const modifiedTransitions: string[] = [];
  for (const t of currTransitions) {
    const prev = prevTransMap.get(t.id);
    if (prev && (prev.rule !== t.rule || prev.from !== t.from || prev.to !== t.to)) {
      modifiedTransitions.push(transitionLabel(t));
    }
  }

  return { newStates, removedStates, modifiedStates, newTransitions, removedTransitions, modifiedTransitions };
}

// ── Helpers ──

let nextId = 100;
export function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

export function severityColor(severity: WarningSeverity): string {
  if (severity === 'error') return STATUS_ERROR;
  if (severity === 'warning') return STATUS_WARNING;
  return STATUS_INFO;
}
