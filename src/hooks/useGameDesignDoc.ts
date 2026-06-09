'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useModuleStore } from '@/stores/moduleStore';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

interface UseGameDesignDocResult {
  gdd: GDDDocument | null;
  isLoading: boolean;
  error: string | null;
  generate: () => Promise<void>;
  exportMarkdown: () => Promise<string | null>;
  exportPitch: () => Promise<string | null>;
}

export function useGameDesignDoc(projectName: string): UseGameDesignDocResult {
  const [gdd, setGdd] = useState<GDDDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useIsMounted();

  const getChecklistJson = useCallback((): string => {
    try {
      const progress = useModuleStore.getState().checklistProgress;
      return JSON.stringify(progress);
    } catch { /* ignore */ }
    return '{}';
  }, []);

  const generate = useCallback(async () => {
    if (!projectName) return;
    setIsLoading(true);
    setError(null);
    try {
      const checklist = encodeURIComponent(getChecklistJson());
      const data = await apiFetch<GDDDocument>(
        `/api/game-design-doc?projectName=${encodeURIComponent(projectName)}&checklist=${checklist}`
      );
      if (isMounted()) setGdd(data);
    } catch (err) {
      if (isMounted()) setError(err instanceof Error ? err.message : 'Failed to generate GDD');
    } finally {
      if (isMounted()) setIsLoading(false);
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
    } catch {
      return null;
    }
  }, [projectName, getChecklistJson]);

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
    } catch {
      return null;
    }
  }, [projectName, getChecklistJson]);

  return { gdd, isLoading, error, generate, exportMarkdown, exportPitch };
}
