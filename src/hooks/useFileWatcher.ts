/**
 * Client-side hook that connects to the file watcher SSE endpoint,
 * triggers project re-scans on source file changes, and auto-verifies
 * checklist items using semantic C++ header parsing.
 *
 * When a class declaration is detected, the watcher calls the
 * verify-semantic API to check whether the class has the expected
 * members. Items are marked as:
 *   - true (green) when semantic verification returns 'full'
 *   - true + verification='partial' (yellow) when class exists but incomplete
 *   - not checked when the class is a hollow stub
 */

'use client';

import { useRef, useCallback, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { getExpectationsForItem } from '@/lib/checklist-expectations';
import { createLifecycle } from '@/lib/lifecycle';
import { useLifecycle } from '@/hooks/useLifecycle';
import type { FileChangeEvent, ScannedDeclaration } from '@/lib/file-watcher';
import type { VerificationInfo } from '@/stores/moduleStore';
import type { SubModuleId } from '@/types/modules';

interface WatcherStatus {
  connected: boolean;
  lastChangeAt: string | null;
  /** Total file change events received this session */
  changeCount: number;
}

/**
 * Build a map of class name patterns → { subModuleId, checklistItemId }
 * from checklist item labels and descriptions.
 */
function buildVerificationMap(): Map<string, { subModuleId: string; itemId: string }> {
  const map = new Map<string, { subModuleId: string; itemId: string }>();

  for (const [moduleId, mod] of Object.entries(SUB_MODULE_MAP)) {
    const checklist = mod.checklist ?? [];
    for (const item of checklist) {
      const text = `${item.label} ${item.description}`;
      const classMatches = text.match(/\b[AUFE][A-Z]\w{2,}/g);
      if (classMatches) {
        for (const className of classMatches) {
          if (className.length < 5) continue;
          map.set(className, { subModuleId: moduleId, itemId: item.id });
        }
      }
    }
  }

  return map;
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
  const verificationMapRef = useRef<Map<string, { subModuleId: string; itemId: string }> | null>(null);

  const getVerificationMap = useCallback(() => {
    if (!verificationMapRef.current) {
      verificationMapRef.current = buildVerificationMap();
    }
    return verificationMapRef.current;
  }, []);

  /**
   * Run semantic verification for detected items via the API,
   * then update both progress and verification state.
   */
  const semanticVerify = useCallback(async (
    detectedItems: { subModuleId: string; itemId: string }[],
    currentProjectPath: string,
  ) => {
    // Deduplicate
    const unique = new Map<string, { subModuleId: string; itemId: string }>();
    for (const item of detectedItems) {
      unique.set(`${item.subModuleId}::${item.itemId}`, item);
    }

    // Split by whether they have semantic expectations
    const withExpectations = [...unique.values()].filter(
      (item) => getExpectationsForItem(item.itemId) !== null,
    );
    const withoutExpectations = [...unique.values()].filter(
      (item) => getExpectationsForItem(item.itemId) === null,
    );

    const { setChecklistItem, setVerification } = useModuleStore.getState();

    // Items without expectations: name-match auto-verify (backward-compatible)
    for (const item of withoutExpectations) {
      setChecklistItem(item.subModuleId as SubModuleId, item.itemId, true);
    }

    if (withExpectations.length === 0) return;

    // Call semantic verification API
    try {
      const res = await fetch('/api/filesystem/verify-semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: currentProjectPath,
          items: withExpectations.map((i) => ({ itemId: i.itemId })),
        }),
      });

      if (!res.ok) {
        // Fallback: name-match only
        for (const item of withExpectations) {
          setChecklistItem(item.subModuleId as SubModuleId, item.itemId, true);
        }
        return;
      }

      const data = await res.json();
      if (!data.success) return;

      for (const result of data.data.results) {
        const item = withExpectations.find((i) => i.itemId === result.itemId);
        if (!item) continue;

        const verification: VerificationInfo = {
          status: result.status,
          completeness: result.completeness,
          missingMembers: result.missingMembers,
          verifiedAt: Date.now(),
        };

        setVerification(item.subModuleId as SubModuleId, item.itemId, verification);

        if (result.status === 'full') {
          setChecklistItem(item.subModuleId as SubModuleId, item.itemId, true);
        } else if (result.status === 'partial') {
          // Mark as checked but verification shows it's partial
          setChecklistItem(item.subModuleId as SubModuleId, item.itemId, true);
        }
        // 'stub' and 'missing' — don't auto-check (avoids false positives)
      }
    } catch {
      // On network failure, fall back to name-match
      for (const item of withExpectations) {
        setChecklistItem(item.subModuleId as SubModuleId, item.itemId, true);
      }
    }
  }, []);

  // Auto-verify checklist items based on detected declarations
  const autoVerify = useCallback((declarations: ScannedDeclaration[]) => {
    const vMap = getVerificationMap();
    const detected: { subModuleId: string; itemId: string }[] = [];

    for (const decl of declarations) {
      const match = vMap.get(decl.name);
      if (match) {
        detected.push(match);
      }
    }

    if (detected.length > 0 && projectPath) {
      semanticVerify(detected, projectPath);
    }
  }, [getVerificationMap, projectPath, semanticVerify]);

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
