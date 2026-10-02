'use client';

import { useEffect, useMemo, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { DetectedEngine } from '@/lib/project-setup/toolchain';
import {
  planNewProject,
  projectsRootFrom,
  type NewProjectPlan,
  type RootEntry,
} from '@/lib/project-setup/newProjectPlan';
import { ok, err, type Result } from '@/types/result';

type RootState =
  | { status: 'loading' }
  | { status: 'ready'; root: string; entries: RootEntry[] }
  | { status: 'error'; reason: string };

function browse<T>(body: Record<string, unknown>): Promise<Result<T, string>> {
  return tryApiFetch<T>('/api/filesystem/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** The real projects root (home via list '~') and its entries — an error, never a default. */
async function readProjectsRoot(): Promise<Result<{ root: string; entries: RootEntry[] }, string>> {
  const home = await browse<{ path?: unknown }>({ action: 'list', path: '~' });
  if (!home.ok) return err(`home directory: ${home.error}`);
  if (typeof home.data?.path !== 'string' || !home.data.path) return err('home directory did not resolve');
  const root = projectsRootFrom(home.data.path);
  const listing = await browse<{ directories?: unknown }>({ action: 'list', path: root });
  if (!listing.ok) return err(`${root}: ${listing.error}`);
  if (!Array.isArray(listing.data?.directories)) return err(`${root}: malformed listing`);
  return ok({ root, entries: listing.data.directories as RootEntry[] });
}

export interface NewProjectPlanState {
  plan: NewProjectPlan;
  /** Installed engines; null while loading or when detection failed. */
  engines: DetectedEngine[] | null;
  root: string | null;
  retry: () => void;
}

/**
 * Start Fresh preflight: resolves the real projects root and its entries plus the
 * installed engines once (read-only browse actions), then plans `name` against
 * them on every keystroke. A failed read keeps `root-unreadable` in the plan.
 */
export function useNewProjectPlan(name: string, ueVersion: string): NewProjectPlanState {
  const [rootState, setRootState] = useState<RootState>({ status: 'loading' });
  const [engines, setEngines] = useState<DetectedEngine[] | null>(null);
  const [enginesDone, setEnginesDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    readProjectsRoot().then((r) => {
      if (cancelled) return;
      setRootState(r.ok ? { status: 'ready', ...r.data } : { status: 'error', reason: r.error });
    });
    browse<{ engines?: DetectedEngine[] }>({ action: 'detect-engines' }).then((r) => {
      if (cancelled) return;
      setEngines(r.ok && Array.isArray(r.data?.engines) ? r.data.engines : null);
      setEnginesDone(true);
    });
    return () => { cancelled = true; };
  }, [attempt]);

  const plan = useMemo(() => {
    const ready = rootState.status === 'ready' ? rootState : null;
    const p = planNewProject({
      name,
      root: ready?.root ?? null,
      entries: ready?.entries ?? null,
      rootError: rootState.status === 'error' ? rootState.reason : null,
      ueVersion,
      engines: enginesDone ? engines : [],
    });
    // While detection is in flight there is nothing to advise yet.
    return enginesDone ? p : { ...p, advisories: [] };
  }, [name, ueVersion, rootState, engines, enginesDone]);

  return {
    plan,
    engines,
    root: rootState.status === 'ready' ? rootState.root : null,
    retry: () => {
      setRootState({ status: 'loading' });
      setEnginesDone(false);
      setAttempt((n) => n + 1);
    },
  };
}
