'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { apiFetch } from '@/lib/api-utils';
import {
  initialRunState, runReducer, selectRun, selectParsed, currentKey,
  type RunAction, type RunEvent, type RunState, type RunView,
} from '@/lib/blueprint-transpiler/run-state';
import type { BlueprintAsset, TranspileResponse, DiffResponse } from '@/types/blueprint';

/**
 * Blueprint transpiler session — one record per project + surface.
 *
 * Input and runs live in a module-scope store (the session-draft pattern of
 * docs/architecture/runtime-patterns.md), not in useState: an LRU eviction that
 * unmounts the view no longer throws away pasted JSON or a result, and a reply
 * that lands after the unmount still settles its run. In-memory by design.
 *
 * Each action is ONE request (the route returns the parse with the result) and
 * reads its input from the store at call time, so no caller passes a stale
 * closure. A second click on an identical in-flight run joins it.
 */

export type TranspilerSurface = 'transpiler' | 'replication';

export interface TranspilerScope {
  projectPath: string;
  surface: TranspilerSurface;
  /** moduleName for a record created now (existing records keep theirs). */
  defaultModule?: string;
}

const records = new Map<string, RunState>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function scopeKey(scope: TranspilerScope): string {
  return `${scope.projectPath}::${scope.surface}`;
}

function read(id: string, defaultModule = ''): RunState {
  let state = records.get(id);
  if (!state) {
    state = initialRunState({ moduleName: defaultModule });
    records.set(id, state);
  }
  return state;
}

function dispatch(id: string, event: RunEvent): void {
  const prev = read(id);
  const next = runReducer(prev, event);
  if (next === prev) return;
  records.set(id, next);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test/reset hook — drops every session record. */
export function resetBlueprintTranspilerSessions(): void {
  records.clear();
  inflight.clear();
}

function runAction(id: string, action: RunAction, projectName?: string): Promise<void> {
  const state = read(id);
  const { blueprintJson, existingCpp, moduleName } = state.input;
  if (!blueprintJson.trim() || (action === 'diff' && !existingCpp.trim())) return Promise.resolve();
  const key = currentKey(state, action);
  const flightId = `${id}|${key}`;
  const joined = inflight.get(flightId);
  const run = state.runs[action];
  if (joined && run.status === 'running' && run.key === key) return joined;

  dispatch(id, { type: 'started', action, key });
  const body = action === 'transpile'
    ? { action, blueprintJson, projectName, moduleName: moduleName || undefined }
    : { action, blueprintJson, existingCpp, projectName };
  const request = apiFetch<TranspileResponse | DiffResponse>('/api/blueprint-transpiler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then((result) => dispatch(id, { type: 'succeeded', action, key, result } as RunEvent))
    .catch((e: unknown) => dispatch(id, {
      type: 'failed', action, key,
      error: e instanceof Error ? e.message : `${action === 'diff' ? 'Diff' : 'Transpile'} failed`,
    }))
    .finally(() => { inflight.delete(flightId); });
  inflight.set(flightId, request);
  return request;
}

export interface UseBlueprintTranspilerResult {
  blueprintJson: string;
  setBlueprintJson: (value: string) => void;
  existingCpp: string;
  setExistingCpp: (value: string) => void;
  moduleName: string;
  setModuleName: (value: string) => void;
  /** Parse of the Blueprint on screen, from the newest result computed for it. */
  asset: BlueprintAsset | null;
  summary: string | null;
  transpileRun: RunView<TranspileResponse>;
  diffRun: RunView<DiffResponse>;
  /** Never rejects: the outcome lands in the run (result or its own error). */
  transpile: (projectName?: string) => Promise<void>;
  diff: (projectName?: string) => Promise<void>;
  reset: () => void;
}

export function useBlueprintTranspiler(scope: TranspilerScope): UseBlueprintTranspilerResult {
  const id = scopeKey(scope);
  const { defaultModule } = scope;
  const state = useSyncExternalStore(
    subscribe,
    () => read(id, defaultModule),
    () => read(id, defaultModule),
  );

  const setBlueprintJson = useCallback((blueprintJson: string) => dispatch(id, { type: 'inputChanged', patch: { blueprintJson } }), [id]);
  const setExistingCpp = useCallback((existingCpp: string) => dispatch(id, { type: 'inputChanged', patch: { existingCpp } }), [id]);
  const setModuleName = useCallback((moduleName: string) => dispatch(id, { type: 'inputChanged', patch: { moduleName } }), [id]);
  const transpile = useCallback((projectName?: string) => runAction(id, 'transpile', projectName), [id]);
  const diff = useCallback((projectName?: string) => runAction(id, 'diff', projectName), [id]);
  const reset = useCallback(() => dispatch(id, { type: 'reset' }), [id]);

  const parsed = selectParsed(state);
  return {
    blueprintJson: state.input.blueprintJson, setBlueprintJson,
    existingCpp: state.input.existingCpp, setExistingCpp,
    moduleName: state.input.moduleName, setModuleName,
    asset: parsed?.asset ?? null,
    summary: parsed?.summary ?? null,
    transpileRun: selectRun(state, 'transpile'),
    diffRun: selectRun(state, 'diff'),
    transpile, diff, reset,
  };
}
