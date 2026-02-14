'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AnalyticsDashboard, PromptSuggestion } from '@/types/session-analytics';
import { apiFetch } from '@/lib/api-utils';

const EMPTY_DASHBOARD: AnalyticsDashboard = {
  totalSessions: 0,
  overallSuccessRate: 0,
  totalDurationMs: 0,
  moduleStats: [],
  insights: [],
  qualityScores: [],
  recentSessions: [],
};

// ── Dashboard hook ──

export function useSessionDashboard() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard>(EMPTY_DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AnalyticsDashboard>('/api/session-analytics?action=dashboard');
      if (mountedRef.current) setDashboard(data);
    } catch (err) {
      console.error('useSessionDashboard fetch error:', err);
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load session analytics');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return { dashboard, isLoading, error, retry: fetchDashboard, refetch: fetchDashboard };
}

// ── Prompt suggestions hook ──

export function usePromptSuggestions(moduleId: string) {
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchSuggestions = useCallback(async (prompt: string) => {
    if (!prompt.trim() || !moduleId) {
      setSuggestions([]);
      return;
    }

    // Debounce
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch<{ suggestions: PromptSuggestion[] }>(
          `/api/session-analytics?action=suggestions&moduleId=${encodeURIComponent(moduleId)}&prompt=${encodeURIComponent(prompt)}`
        );
        setSuggestions(data.suggestions ?? []);
      } catch {
        // Silently ignore — suggestions are non-critical
      }
    }, 500);
  }, [moduleId]);

  return { suggestions, fetchSuggestions };
}

// ── Session recorder (fire and forget) ──

export async function recordSessionOutcome(data: {
  moduleId: string;
  sessionKey: string;
  prompt: string;
  hadProjectContext: boolean;
  success: boolean;
  durationMs: number;
  startedAt: string;
}): Promise<void> {
  try {
    await apiFetch<unknown>('/api/session-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        completedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('Failed to record session outcome:', err);
  }
}
