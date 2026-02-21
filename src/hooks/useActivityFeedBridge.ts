'use client';

import { useEffect } from 'react';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { eventBus } from '@/lib/event-bus';
import { eventBusBridgeLifecycle } from '@/lib/event-bus-bridge';
import { useGuardedLifecycle } from '@/hooks/useLifecycle';
import type { BusEvent } from '@/types/event-bus';

/**
 * Bridge that watches event bus channels and publishes
 * to the unified activity feed store.
 *
 * Also initializes the store → event bus bridge on first mount.
 * Mount once in AppShell.
 */
export function useActivityFeedBridge() {
  const addEvent = useActivityFeedStore((s) => s.addEvent);

  // Initialize the store → bus bridge once via Lifecycle protocol
  useGuardedLifecycle(() => eventBusBridgeLifecycle);

  // ── CLI task completion → activity feed ──
  useEffect(() => {
    return eventBus.on('cli.task.completed', (event: BusEvent<'cli.task.completed'>) => {
      const { success, sessionLabel, moduleId } = event.payload;
      addEvent({
        type: success ? 'cli-complete' : 'cli-error',
        title: sessionLabel || 'CLI Task',
        description: success
          ? `Task completed successfully in ${sessionLabel || 'session'}.`
          : `Task failed in ${sessionLabel || 'session'}.`,
        moduleId,
        meta: { success },
      });
    });
  }, [addEvent]);

  // ── Evaluator scan → activity feed ──
  useEffect(() => {
    return eventBus.on('eval.scan.completed', (event: BusEvent<'eval.scan.completed'>) => {
      const { overallScore, recommendationCount } = event.payload;
      addEvent({
        type: 'quality-change',
        title: 'Project Scan Complete',
        description: `Overall score: ${overallScore}/100. ${recommendationCount} recommendations.`,
        meta: { score: overallScore },
      });
    });
  }, [addEvent]);

  // ── Critical/high recommendations → activity feed ──
  useEffect(() => {
    return eventBus.on('eval.recommendation', (event: BusEvent<'eval.recommendation'>) => {
      const { title, description, moduleId, priority, suggestedPrompt } = event.payload;
      addEvent({
        type: 'evaluator-recommendation',
        title,
        description,
        moduleId,
        meta: { priority, prompt: suggestedPrompt },
      });
    });
  }, [addEvent]);
}
