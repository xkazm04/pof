'use client';

import { useEffect } from 'react';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { eventBus } from '@/lib/event-bus';
import { eventBusBridgeLifecycle } from '@/lib/event-bus-bridge';
import { tearsDownObservedWork } from '@/components/layout/ModuleRenderer/helpers';
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

  // ── Shell LRU eviction → activity feed ──
  //
  // This is the registered consumer `nav.module.evicted` was emitted for. Until it
  // existed the channel had NO subscriber in `src/`, so a navigation that unmounted
  // a running CLI session produced one `logger.debug` line and nothing else.
  //
  // Only evictions that destroyed work the shell could OBSERVE are surfaced
  // (`tearsDownObservedWork`). That is not a claim the quiet ones were harmless —
  // the shell cannot see a module's own streams or polls — and the copy below says
  // so rather than implying the feed is a complete ledger of what navigation cost.
  useEffect(() => {
    return eventBus.on('nav.module.evicted', (event: BusEvent<'nav.module.evicted'>) => {
      const { evictedId, label, scope, cap, liveWork, basis } = event.payload;
      if (!tearsDownObservedWork({ evictedId, label, scope, cap, liveWork, basis })) return;

      const what = scope === 'session' ? 'Terminal session' : 'Module';
      addEvent({
        type: 'shell-eviction',
        title: `${what} torn down: ${label}`,
        description:
          (basis === 'forced-over-live-work'
            ? `Only ${cap} panes stay mounted and every candidate had live work, so this one was unmounted anyway`
            : `The ${cap}-pane keep-alive limit unmounted this one`) +
          (liveWork === 'cli-session-running'
            ? ' while a CLI session was still running.'
            : '.') +
          ' Streams and polls a module holds internally are invisible to the shell, so more may have gone with it.',
        moduleId: scope === 'module' ? evictedId : undefined,
      });
    });
  }, [addEvent]);
}
