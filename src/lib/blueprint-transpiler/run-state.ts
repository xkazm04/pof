/**
 * Transpiler run state — every result is bound to the input it came from.
 *
 * The Blueprint transpiler has two actions (transpile, semantic diff). Each run
 * is stamped with a KEY: the fingerprints of exactly the inputs that action
 * reads. From that one fact the selectors derive what the loose useState bag
 * could not say:
 *   - stale: the current input no longer fingerprints to the result's key, so
 *     the result is a statement about a Blueprint that is no longer on screen
 *     (and says which input moved, `staleBecause`);
 *   - last request wins: a reply whose key is not the running key is dropped;
 *   - errors are per action, never one string shown on both tabs.
 *
 * Pure: no React, no fetch. The session store in `useBlueprintTranspiler` holds
 * one `RunState` per project + surface so an LRU eviction cannot drop it.
 */

import type { BlueprintAsset, TranspileResponse, DiffResponse } from '@/types/blueprint';

export type RunAction = 'transpile' | 'diff';

export interface RunInput {
  blueprintJson: string;
  existingCpp: string;
  /** Target C++ module — decides the header's API macro, so it keys a transpile. */
  moduleName: string;
}

export type InputField = keyof RunInput;

interface RunResults { transpile: TranspileResponse; diff: DiffResponse }

/** The inputs each action reads, in key order. projectName is fixed per record. */
const KEY_FIELDS: { [A in RunAction]: InputField[] } = {
  transpile: ['blueprintJson', 'moduleName'],
  diff: ['blueprintJson', 'existingCpp'],
};

type Run<R> =
  | { status: 'idle' }
  | { status: 'running'; key: string; prev: { key: string; result: R } | null }
  | { status: 'done'; key: string; result: R }
  | { status: 'failed'; key: string; error: string };

export interface RunState {
  input: RunInput;
  runs: { [A in RunAction]: Run<RunResults[A]> };
}

export type RunEvent =
  | { type: 'inputChanged'; patch: Partial<RunInput> }
  | { type: 'started'; action: RunAction; key: string }
  | { type: 'succeeded'; action: 'transpile'; key: string; result: TranspileResponse }
  | { type: 'succeeded'; action: 'diff'; key: string; result: DiffResponse }
  | { type: 'failed'; action: RunAction; key: string; error: string }
  | { type: 'reset' };

// ── Fingerprints ────────────────────────────────────────────────────────────

/** FNV-1a 32-bit plus length: cheap, deterministic, collision-safe enough to tell edits apart. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length.toString(36)}.${(h >>> 0).toString(36)}`;
}

function keyOf(action: RunAction, input: RunInput): string {
  return [action, ...KEY_FIELDS[action].map((f) => fingerprint(input[f]))].join(':');
}

export function transpileKey(blueprintJson: string, moduleName: string): string {
  return keyOf('transpile', { blueprintJson, moduleName, existingCpp: '' });
}

export function diffKey(blueprintJson: string, existingCpp: string): string {
  return keyOf('diff', { blueprintJson, existingCpp, moduleName: '' });
}

/** The key a run of `action` started NOW would carry. */
export function currentKey(state: RunState, action: RunAction): string {
  return keyOf(action, state.input);
}

/** Which inputs moved since `key` was computed ([] = fresh). */
function staleFields(state: RunState, action: RunAction, key: string): InputField[] {
  const parts = key.split(':').slice(1);
  return KEY_FIELDS[action].filter((f, i) => parts[i] !== fingerprint(state.input[f]));
}

// ── Reducer ─────────────────────────────────────────────────────────────────

const IDLE = { status: 'idle' } as const;

export function initialRunState(input: Partial<RunInput> = {}): RunState {
  return {
    input: { blueprintJson: '', existingCpp: '', moduleName: '', ...input },
    runs: { transpile: IDLE, diff: IDLE },
  };
}

function settledOf<R>(run: Run<R>): { key: string; result: R } | null {
  if (run.status === 'done') return { key: run.key, result: run.result };
  if (run.status === 'running') return run.prev;
  return null;
}

function isCurrent(run: Run<unknown>, key: string): boolean {
  return run.status === 'running' && run.key === key;
}

export function runReducer(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'inputChanged':
      return { ...state, input: { ...state.input, ...event.patch } };
    case 'started': {
      const prev = settledOf(state.runs[event.action] as Run<unknown>);
      return { ...state, runs: { ...state.runs, [event.action]: { status: 'running', key: event.key, prev } } };
    }
    case 'succeeded':
      if (!isCurrent(state.runs[event.action], event.key)) return state;
      return { ...state, runs: { ...state.runs, [event.action]: { status: 'done', key: event.key, result: event.result } } };
    case 'failed':
      if (!isCurrent(state.runs[event.action], event.key)) return state;
      return { ...state, runs: { ...state.runs, [event.action]: { status: 'failed', key: event.key, error: event.error } } };
    case 'reset':
      return initialRunState({ moduleName: state.input.moduleName });
  }
}

// ── Selectors ───────────────────────────────────────────────────────────────

export interface RunView<R> {
  result: R | null;
  running: boolean;
  error: string | null;
  /** The shown result (or error) was computed from inputs that have since changed. */
  stale: boolean;
  staleBecause: InputField[];
}

export function selectRun<A extends RunAction>(state: RunState, action: A): RunView<RunResults[A]> {
  const run = state.runs[action] as Run<RunResults[A]>;
  const settled = settledOf(run);
  const basis = run.status === 'failed' ? run.key : settled?.key ?? null;
  const staleBecause = basis ? staleFields(state, action, basis) : [];
  return {
    result: settled?.result ?? null,
    running: run.status === 'running',
    error: run.status === 'failed' ? run.error : null,
    stale: staleBecause.length > 0,
    staleBecause,
  };
}

/**
 * The parse that came back with the newest result for the Blueprint currently
 * on screen — or null. A parse of an older Blueprint is never presented.
 */
export function selectParsed(state: RunState): { asset: BlueprintAsset; summary: string } | null {
  for (const action of ['transpile', 'diff'] as const) {
    const view = selectRun(state, action);
    if (view.result && !view.staleBecause.includes('blueprintJson')) {
      return { asset: view.result.asset, summary: view.result.summary };
    }
  }
  return null;
}
