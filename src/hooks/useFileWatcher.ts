/**
 * Client-side hook that connects to the file watcher SSE endpoint,
 * triggers project re-scans on source file changes, and auto-verifies
 * checklist items using semantic C++ header parsing.
 *
 * Which items a changed class can verify comes from the expectation table
 * (`resolveAffectedItems`, src/lib/checklist-verify-index.ts) — module-scoped,
 * never a bare-name match. The watcher POSTs those {moduleId, itemId} items to
 * verify-semantic and writes ONLY from its verdict:
 *   - 'full' / 'partial' → verification recorded + item ticked
 *   - 'stub' / 'missing' → verification recorded, no tick
 *   - request failed (non-ok, success:false, network) → nothing written (logged)
 */

'use client';

import { useRef, useCallback, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { resolveAffectedItems, type VerifyTarget } from '@/lib/checklist-verify-index';
import { createLifecycle } from '@/lib/lifecycle';
import { useLifecycle } from '@/hooks/useLifecycle';
import { logger } from '@/lib/logger';
import type { FileChangeEvent, ScannedDeclaration } from '@/lib/file-watcher';
import type { VerificationInfo, VerificationStatus } from '@/stores/moduleStore';

interface WatcherStatus {
  connected: boolean;
  lastChangeAt: string | null;
  /** Total file change events received this session */
  changeCount: number;
}

interface VerifyResult {
  moduleId?: string;
  itemId: string;
  status: VerificationStatus | 'no-expectations';
  completeness: number;
  missingMembers: string[];
}

const RECORDED: ReadonlySet<string> = new Set<VerificationStatus>(['full', 'partial', 'stub', 'missing']);
const TICKS: ReadonlySet<string> = new Set<VerificationStatus>(['full', 'partial']);

/**
 * Verify module-scoped items via verify-semantic and record the verdicts.
 * Any failure is a non-event: nothing is ticked or recorded.
 */
async function semanticVerify(items: VerifyTarget[], projectPath: string): Promise<void> {
  let data: { success?: boolean; error?: string; data?: { results?: VerifyResult[]; unreadable?: string[] } };
  try {
    const res = await fetch('/api/filesystem/verify-semantic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, items: items.map(({ moduleId, itemId }) => ({ moduleId, itemId })) }),
    });
    if (!res.ok) {
      logger.warn(`[useFileWatcher] verify-semantic answered ${res.status}; no checklist writes`);
      return;
    }
    data = await res.json();
  } catch (err) {
    logger.warn('[useFileWatcher] verify-semantic failed; no checklist writes', err);
    return;
  }
  if (!data.success || !data.data?.results) {
    logger.warn(`[useFileWatcher] verify-semantic refused: ${data.error ?? 'no results'}; no checklist writes`);
    return;
  }
  if (data.data.unreadable?.length) {
    logger.warn('[useFileWatcher] verify-semantic could not read', data.data.unreadable);
  }

  const asked = new Map(items.map((i) => [`${i.moduleId}::${i.itemId}`, i]));
  const { setChecklistItem, setVerification } = useModuleStore.getState();
  for (const result of data.data.results) {
    const item = asked.get(`${result.moduleId}::${result.itemId}`);
    if (!item || !RECORDED.has(result.status)) continue;
    const verification: VerificationInfo = {
      status: result.status as VerificationStatus,
      completeness: result.completeness,
      missingMembers: result.missingMembers ?? [],
      verifiedAt: Date.now(),
    };
    setVerification(item.moduleId, item.itemId, verification);
    if (TICKS.has(result.status)) setChecklistItem(item.moduleId, item.itemId, true);
  }
}

export function useFileWatcher(): WatcherStatus {
  const projectPath = useProjectStore((s) => s.projectPath);
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const [status, setStatus] = useState<WatcherStatus>({
    connected: false,
    lastChangeAt: null,
    changeCount: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-verify the items whose expectation names a changed class
  const autoVerify = useCallback((declarations: ScannedDeclaration[]) => {
    const items = resolveAffectedItems(declarations);
    if (items.length > 0 && projectPath) {
      void semanticVerify(items, projectPath);
    }
  }, [projectPath]);

  // Handle incoming change events
  const handleChanges = useCallback((events: FileChangeEvent[]) => {
    const allDeclarations: ScannedDeclaration[] = [];
    for (const event of events) {
      if (event.type !== 'deleted' && event.declarations.length > 0) {
        allDeclarations.push(...event.declarations);
      }
    }

    if (allDeclarations.length > 0) {
      autoVerify(allDeclarations);
    }

    // Trigger a project re-scan to update dynamicContext
    const { dynamicContext } = useProjectStore.getState();
    if (dynamicContext) {
      useProjectStore.getState().setProject({
        dynamicContext: { ...dynamicContext, scannedAt: '' },
      });
    }
    useProjectStore.getState().scanProject();

    setStatus((prev) => ({
      ...prev,
      lastChangeAt: new Date().toISOString(),
      changeCount: prev.changeCount + events.length,
    }));
  }, [autoVerify]);

  // Lifecycle-managed EventSource: controlled-monopoly (teardown-before-switch)
  useLifecycle<EventSource | void>(() => {
    if (!projectPath || !isSetupComplete) {
      // Return a no-op lifecycle when not ready
      return { init() {}, isActive() { return false; }, dispose() {} };
    }

    const url = `/api/filesystem/watch?projectPath=${encodeURIComponent(projectPath)}`;

    return createLifecycle<EventSource>(
      () => {
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
              setStatus((prev) => ({ ...prev, connected: true }));
            } else if (data.type === 'changes') {
              handleChanges(data.events as FileChangeEvent[]);
            }
          } catch { /* ignore parse errors */ }
        };

        es.onerror = () => {
          setStatus((prev) => ({ ...prev, connected: false }));
        };

        return es;
      },
      (es) => {
        es.close();
        eventSourceRef.current = null;
        setStatus((prev) => ({ ...prev, connected: false }));
      },
    );
  }, [projectPath, isSetupComplete, handleChanges]);

  return status;
}
