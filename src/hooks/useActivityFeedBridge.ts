'use client';

import { useEffect, useRef } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';

/**
 * Bridge hook that watches CLI completions and evaluator scans,
 * publishing events to the unified activity feed.
 *
 * Mount once in AppShell.
 */
export function useActivityFeedBridge() {
  const addEvent = useActivityFeedStore((s) => s.addEvent);

  // ── CLI task completion tracking ──
  // We track session running states and detect transitions to stopped.

  const prevSessionStates = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = useCLIPanelStore.subscribe((state) => {
      const prev = prevSessionStates.current;
      const next: Record<string, boolean> = {};

      for (const [tabId, session] of Object.entries(state.sessions)) {
        next[tabId] = session.isRunning;

        // Detect running → stopped transition
        if (prev[tabId] === true && !session.isRunning) {
          const success = session.lastTaskSuccess === true;
          addEvent({
            type: success ? 'cli-complete' : 'cli-error',
            title: session.label || 'CLI Task',
            description: success
              ? `Task completed successfully in ${session.label || 'session'}.`
              : `Task failed in ${session.label || 'session'}.`,
            moduleId: session.moduleId ?? undefined,
            meta: { success },
          });
        }
      }

      prevSessionStates.current = next;
    });

    return unsub;
  }, [addEvent]);

  // ── Evaluator scan tracking ──

  const prevScanCount = useRef<number | null>(null);

  useEffect(() => {
    const unsub = useEvaluatorStore.subscribe((state) => {
      const count = state.scanHistory.length;

      // Skip initial hydration
      if (prevScanCount.current === null) {
        prevScanCount.current = count;
        return;
      }

      if (count > prevScanCount.current && state.lastScan) {
        const scan = state.lastScan;
        addEvent({
          type: 'quality-change',
          title: 'Project Scan Complete',
          description: `Overall score: ${scan.overallScore}/100. ${scan.recommendations.length} recommendations.`,
          meta: { score: scan.overallScore },
        });

        // Surface critical/high recommendations as separate events
        for (const rec of scan.recommendations) {
          if (rec.priority === 'critical' || rec.priority === 'high') {
            addEvent({
              type: 'evaluator-recommendation',
              title: rec.title,
              description: rec.description,
              moduleId: rec.moduleId,
              meta: { priority: rec.priority, prompt: rec.suggestedPrompt },
            });
          }
        }
      }

      prevScanCount.current = count;
    });

    return unsub;
  }, [addEvent]);
}
