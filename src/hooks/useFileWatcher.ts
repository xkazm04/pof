/**
 * Client-side hook that connects to the file watcher SSE endpoint,
 * triggers project re-scans on source file changes, and auto-verifies
 * checklist items based on detected UE5 class declarations.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { getModuleChecklist, SUB_MODULE_MAP } from '@/lib/module-registry';
import type { FileChangeEvent, ScannedDeclaration } from '@/lib/file-watcher';

interface WatcherStatus {
  connected: boolean;
  lastChangeAt: string | null;
  /** Total file change events received this session */
  changeCount: number;
}

/**
 * Build a map of class name patterns → { subModuleId, checklistItemId }
 * from checklist item labels and descriptions.
 *
 * For example, checklist item "Create AARPGCharacterBase" maps the class name
 * "AARPGCharacterBase" to that item. This enables auto-verification when
 * the file watcher detects that class was actually created.
 */
function buildVerificationMap(): Map<string, { subModuleId: string; itemId: string }> {
  const map = new Map<string, { subModuleId: string; itemId: string }>();

  for (const [moduleId, mod] of Object.entries(SUB_MODULE_MAP)) {
    const checklist = mod.checklist ?? [];
    for (const item of checklist) {
      // Extract class names from the label and description
      // Pattern: words starting with A/U/F/E followed by uppercase (UE naming convention)
      const text = `${item.label} ${item.description}`;
      const classMatches = text.match(/\b[AUFE][A-Z]\w{2,}/g);
      if (classMatches) {
        for (const className of classMatches) {
          // Avoid false positives on common English words
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

  // Lazy-build verification map
  const getVerificationMap = useCallback(() => {
    if (!verificationMapRef.current) {
      verificationMapRef.current = buildVerificationMap();
    }
    return verificationMapRef.current;
  }, []);

  // Auto-verify checklist items based on detected declarations
  const autoVerify = useCallback((declarations: ScannedDeclaration[]) => {
    const vMap = getVerificationMap();
    const setChecklistItem = useModuleStore.getState().setChecklistItem;

    for (const decl of declarations) {
      const match = vMap.get(decl.name);
      if (match) {
        setChecklistItem(match.subModuleId, match.itemId, true);
      }
    }
  }, [getVerificationMap]);

  // Handle incoming change events
  const handleChanges = useCallback((events: FileChangeEvent[]) => {
    // Collect all new declarations for auto-verification
    const allDeclarations: ScannedDeclaration[] = [];
    for (const event of events) {
      if (event.type !== 'deleted' && event.declarations.length > 0) {
        allDeclarations.push(...event.declarations);
      }
    }

    // Auto-verify checklist items
    if (allDeclarations.length > 0) {
      autoVerify(allDeclarations);
    }

    // Trigger a project re-scan to update dynamicContext
    // (invalidate cache by clearing scannedAt so next scanProject() runs fresh)
    const { dynamicContext } = useProjectStore.getState();
    if (dynamicContext) {
      useProjectStore.getState().setProject({
        dynamicContext: { ...dynamicContext, scannedAt: '' },
      });
    }
    // Fire the actual scan
    useProjectStore.getState().scanProject();

    setStatus((prev) => ({
      ...prev,
      lastChangeAt: new Date().toISOString(),
      changeCount: prev.changeCount + events.length,
    }));
  }, [autoVerify]);

  useEffect(() => {
    // Only watch if project is set up and has a path
    if (!projectPath || !isSetupComplete) return;

    const url = `/api/filesystem/watch?projectPath=${encodeURIComponent(projectPath)}`;
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
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setStatus((prev) => ({ ...prev, connected: false }));
    };
  }, [projectPath, isSetupComplete, handleChanges]);

  return status;
}
