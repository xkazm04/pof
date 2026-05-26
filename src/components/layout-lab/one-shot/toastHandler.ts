'use client';

import { toast } from 'sonner';
import { eventBus } from '@/lib/event-bus';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';

export function setupOneShotToastHandler(): () => void {
  const unsubs: Array<() => void> = [];

  unsubs.push(
    eventBus.on('oneshot.completed', ({ payload }) => {
      const { passed, failed, skipped, deferred, catalogId, entityId, jobName } = payload;
      toast.success(
        `${jobName}: ${passed} passed · ${failed} failed · ${skipped} skipped · ${deferred} deferred`,
        {
          duration: 8000,
          action: {
            label: 'Open',
            onClick: () =>
              useOneShotLabStore.getState().setPendingNavigation({ catalogId, entityId }),
          },
        },
      );
    }),
  );

  unsubs.push(
    eventBus.on('oneshot.failed', ({ payload }) => {
      toast.error(
        `${payload.jobName}: failed at step ${payload.stepIndex + 1}/${payload.totalSteps} — ${payload.error}`,
      );
    }),
  );

  return () => unsubs.forEach((u) => u());
}
