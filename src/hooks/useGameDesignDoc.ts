'use client';

import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useModuleStore } from '@/stores/moduleStore';
import { logger } from '@/lib/logger';
import { normalizeProjectId } from '@/lib/project-id';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

type ChecklistProgress = Record<string, Record<string, boolean>>;

interface UseGameDesignDocResult {
  gdd: GDDDocument | null;
  isLoading: boolean;
  error: string | null;
  exportError: string | null;
  clearExportError: () => void;
  /**
   * Synthesize the GDD — gated. With no argument it no-ops (adopting the cached
   * document) when neither the project nor the checklist changed since the last
   * synthesis; pass `true` to force a fresh one (the Refresh button).
   */
  generate: (force?: boolean) => Promise<void>;
  /** Formats the document instance the caller is holding — never re-synthesizes. */
  exportMarkdown: (doc: GDDDocument) => Promise<string | null>;
  /** Formats the document instance the caller is holding — never re-synthesizes. */
  exportPitch: (doc: GDDDocument) => Promise<string | null>;
}

/**
 * Canonical hash of the checked items, stable across key-order differences.
 * (Mirrors `hashChecklist` in `@/stores/gddComplianceStore` — the same staleness
 * idiom, re-implemented here because that one is store-private.)
 */
function hashChecklist(cp: ChecklistProgress): string {
  return Object.keys(cp)
    .sort()
    .map((m) => `${m}:${Object.keys(cp[m]).filter((k) => cp[m][k]).sort().join(',')}`)
    .join('|');
}

function readChecklist(): ChecklistProgress {
  try {
    return useModuleStore.getState().checklistProgress ?? {};
  } catch {
    return {};
  }
}

/**
 * Module-scoped, in-memory staleness gate.
 *
 * `GameDesignDocView` is conditionally rendered, so every tab switch unmounts
 * and remounts it — component state cannot survive the flip, and a regenerate-
 * on-mount effect therefore paid for a full 7-query synthesis each time. The
 * cache lives beside the hook (not in component state) so a flip back to an
 * unchanged GDD costs zero syntheses. Deliberately NOT persisted: it is a
 * freshness gate, not storage — same contract as the compliance store's.
 */
let docCache: { projectName: string; projectId: string; checklistHash: string; doc: GDDDocument } | null = null;

/** Test-only: drop the in-memory gate so suites don't leak documents into each other. */
export function __resetGddDocCache(): void {
  docCache = null;
}

/**
 * The project id is part of the key, not just the name: the synthesis is SCOPED to
 * it server-side, so serving a cached document across a project switch would show
 * one project another project's feature counts. Two projects can also share a
 * display name — the path is the identity (`normalizeProjectId`).
 */
function cachedDoc(projectName: string, projectId: string, checklistHash: string): GDDDocument | null {
  if (!docCache) return null;
  return docCache.projectName === projectName
    && docCache.projectId === projectId
    && docCache.checklistHash === checklistHash
    ? docCache.doc
    : null;
}

/**
 * @param projectName display title of the document.
 * @param projectPath the ACTIVE project, passed explicitly by the caller (never
 *   inferred server-side) — it scopes the synthesis and keys the staleness gate.
 *   Omitted/blank ⇒ the documented global/legacy view, which says so in the document.
 */
export function useGameDesignDoc(projectName: string, projectPath = ''): UseGameDesignDocResult {
  const projectId = normalizeProjectId(projectPath);
  // Adopt a still-fresh document on the very first render, so a tab flip back
  // shows the GDD without a loading flash and without a server round-trip.
  const [gdd, setGdd] = useState<GDDDocument | null>(
    () => cachedDoc(projectName, projectId, hashChecklist(readChecklist())),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const isMounted = useIsMounted();
  const clearExportError = useCallback(() => setExportError(null), []);
  // Monotonic request token: only the newest generate() may commit its result,
  // so an earlier, slower response can't overwrite a newer one out of order.
  const generateTokenRef = useRef(0);

  const generate = useCallback(async (force = false) => {
    if (!projectName) return;
    const checklist = readChecklist();
    const checklistHash = hashChecklist(checklist);

    if (!force) {
      const fresh = cachedDoc(projectName, projectId, checklistHash);
      if (fresh) {
        // Nothing the GDD is derived from moved — adopt, don't re-synthesize.
        if (isMounted()) {
          setGdd(fresh);
          setError(null);
        }
        return;
      }
    }

    const token = ++generateTokenRef.current;
    setIsLoading(true);
    setError(null);
    try {
      // POST: the checklist is ~300 items — a GET query string is the wrong
      // envelope for it (URL length limits, proxy logs, cache keys).
      const data = await apiFetch<GDDDocument>('/api/game-design-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', projectName, projectPath: projectId, checklist }),
      });
      // A newer generate() started while this was in flight — discard.
      if (token !== generateTokenRef.current) return;
      docCache = { projectName, projectId, checklistHash, doc: data };
      if (isMounted()) setGdd(data);
    } catch (err) {
      if (token !== generateTokenRef.current) return;
      if (isMounted()) setError(err instanceof Error ? err.message : 'Failed to generate GDD');
    } finally {
      if (token === generateTokenRef.current && isMounted()) setIsLoading(false);
    }
  }, [projectName, projectId, isMounted]);

  /**
   * Both exports POST the document the view is rendering. The server formats
   * exactly that instance instead of synthesizing a second one, so .md, the
   * pitch and the client-rendered PDF cannot describe different projects.
   */
  const runExport = useCallback(async <T,>(
    action: 'export-markdown' | 'export-pitch',
    doc: GDDDocument,
    pick: (data: T) => string,
    failure: string,
  ): Promise<string | null> => {
    try {
      const data = await apiFetch<T>('/api/game-design-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, document: doc }),
      });
      return pick(data);
    } catch (err) {
      logger.error(`GDD ${action} failed`, err);
      if (isMounted()) setExportError(failure);
      return null;
    }
  }, [isMounted]);

  const exportMarkdown = useCallback((doc: GDDDocument) => runExport<{ markdown: string }>(
    'export-markdown', doc, (d) => d.markdown, 'Export failed — please try again.',
  ), [runExport]);

  const exportPitch = useCallback((doc: GDDDocument) => runExport<{ html: string }>(
    'export-pitch', doc, (d) => d.html, 'Pitch export failed — please try again.',
  ), [runExport]);

  return { gdd, isLoading, error, exportError, clearExportError, generate, exportMarkdown, exportPitch };
}
