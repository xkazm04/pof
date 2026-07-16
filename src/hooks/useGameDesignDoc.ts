'use client';

import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useModuleStore } from '@/stores/moduleStore';
import { logger } from '@/lib/logger';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

interface UseGameDesignDocResult {
  gdd: GDDDocument | null;
  isLoading: boolean;
  error: string | null;
  exportError: string | null;
  clearExportError: () => void;
  generate: () => Promise<void>;
  exportMarkdown: () => Promise<string | null>;
  exportPitch: () => Promise<string | null>;
}

export function useGameDesignDoc(projectName: string): UseGameDesignDocResult {
  const [gdd, setGdd] = useState<GDDDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const isMounted = useIsMounted();
  const clearExportError = useCallback(() => setExportError(null), []);
  // Monotonic request token: only the newest generate() may commit its result,
  // so an earlier, slower response can't overwrite a newer one out of order.
  const generateTokenRef = useRef(0);

  const getChecklistJson = useCallback((): string => {
    try {
      const progress = useModuleStore.getState().checklistProgress;
      return JSON.stringify(progress);
    } catch { /* ignore */ }
    return '{}';
  }, []);

  const generate = useCallback(async () => {
    if (!projectName) return;
    const token = ++generateTokenRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const checklist = encodeURIComponent(getChecklistJson());
      const data = await apiFetch<GDDDocument>(
        `/api/game-design-doc?projectName=${encodeURIComponent(projectName)}&checklist=${checklist}`
      );
      // A newer generate() started while this was in flight — discard.
      if (token !== generateTokenRef.current) return;
      if (isMounted()) setGdd(data);
    } catch (err) {
      if (token !== generateTokenRef.current) return;
      if (isMounted()) setError(err instanceof Error ? err.message : 'Failed to generate GDD');
    } finally {
      if (token === generateTokenRef.current && isMounted()) setIsLoading(false);
    }
  }, [projectName, getChecklistJson, isMounted]);

  const exportMarkdown = useCallback(async (): Promise<string | null> => {
    try {
      let checklistProgress = {};
      try {
        checklistProgress = JSON.parse(getChecklistJson());
      } catch { /* ignore */ }

      const data = await apiFetch<{ markdown: string }>('/api/game-design-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export-markdown',
          projectName,
          checklist: checklistProgress,
        }),
      });
      return data.markdown;
    } catch (err) {
      logger.error('GDD export-markdown failed', err);
      if (isMounted()) setExportError('Export failed — please try again.');
      return null;
    }
  }, [projectName, getChecklistJson, isMounted]);

  const exportPitch = useCallback(async (): Promise<string | null> => {
    try {
      let checklistProgress = {};
      try {
        checklistProgress = JSON.parse(getChecklistJson());
      } catch { /* ignore */ }

      const data = await apiFetch<{ html: string }>('/api/game-design-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export-pitch',
          projectName,
          checklist: checklistProgress,
        }),
      });
      return data.html;
    } catch (err) {
      logger.error('GDD export-pitch failed', err);
      if (isMounted()) setExportError('Pitch export failed — please try again.');
      return null;
    }
  }, [projectName, getChecklistJson, isMounted]);

  return { gdd, isLoading, error, exportError, clearExportError, generate, exportMarkdown, exportPitch };
}
