import { eventBus } from './event-bus';
import { createGuardedLifecycle, type Lifecycle } from './lifecycle';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { SubModuleId } from '@/types/modules';

// ── Event Bus Bridge ──
//
// Subscribes to Zustand stores and emits typed events on the bus.
// Uses Lifecycle protocol for guaranteed init/cleanup.

/** Lifecycle-managed bridge instance. Safe to call init() multiple times (guarded). */
export const eventBusBridgeLifecycle: Lifecycle<void> = createGuardedLifecycle(
  () => createBridgeSubscriptions(),
);

/**
 * Initialize the event bus bridge. Returns a cleanup function.
 * @deprecated Use `eventBusBridgeLifecycle.init()` and `.dispose()` instead.
 */
export function initEventBusBridge(): () => void {
  eventBusBridgeLifecycle.init();
  return () => eventBusBridgeLifecycle.dispose();
}

function createBridgeSubscriptions(): () => void {
  const unsubs: (() => void)[] = [];

  // ── CLI store → bus ──

  let prevRunning: Record<string, boolean> = {};
  let prevTabOrder: string[] = [];

  unsubs.push(
    useCLIPanelStore.subscribe((state) => {
      const nextRunning: Record<string, boolean> = {};

      for (const [tabId, session] of Object.entries(state.sessions)) {
        nextRunning[tabId] = session.isRunning;

        // Detect idle → running transition
        if (prevRunning[tabId] === false && session.isRunning) {
          eventBus.emit('cli.task.started', {
            tabId,
            sessionLabel: session.label,
            moduleId: session.moduleId,
          }, 'cli-store');

          // Record session log entry (fire-and-forget)
          if (session.moduleId && session.sessionKey) {
            recordSessionLogEvent(tabId, session.sessionKey, session.moduleId, 'started');
          }
        }

        // Detect running → stopped transition
        if (prevRunning[tabId] === true && !session.isRunning) {
          eventBus.emit('cli.task.completed', {
            tabId,
            sessionLabel: session.label,
            moduleId: session.moduleId,
            success: session.lastTaskSuccess === true,
          }, 'cli-store');

          // Record session log entry (fire-and-forget)
          if (session.moduleId && session.sessionKey) {
            recordSessionLogEvent(
              tabId, session.sessionKey, session.moduleId, 'completed',
              session.lastTaskSuccess === true,
            );
          }
        }
      }

      // Detect new sessions
      for (const tabId of state.tabOrder) {
        if (!prevTabOrder.includes(tabId)) {
          const session = state.sessions[tabId];
          if (session) {
            eventBus.emit('cli.session.created', {
              tabId,
              sessionLabel: session.label,
              moduleId: session.moduleId,
            }, 'cli-store');
          }
        }
      }

      // Detect removed sessions
      for (const tabId of prevTabOrder) {
        if (!state.tabOrder.includes(tabId)) {
          eventBus.emit('cli.session.removed', { tabId }, 'cli-store');
        }
      }

      prevRunning = nextRunning;
      prevTabOrder = [...state.tabOrder];
    }),
  );

  // ── Evaluator store → bus ──

  let prevScanCount: number | null = null;

  unsubs.push(
    useEvaluatorStore.subscribe((state) => {
      const count = state.scanHistory.length;

      // Skip initial hydration
      if (prevScanCount === null) {
        prevScanCount = count;
        return;
      }

      if (count > prevScanCount && state.lastScan) {
        const scan = state.lastScan;

        eventBus.emit('eval.scan.completed', {
          overallScore: scan.overallScore,
          recommendationCount: scan.recommendations.length,
        }, 'evaluator-store');

        // Surface critical/high recommendations
        for (const rec of scan.recommendations) {
          if (rec.priority === 'critical' || rec.priority === 'high') {
            eventBus.emit('eval.recommendation', {
              title: rec.title,
              description: rec.description,
              moduleId: rec.moduleId,
              priority: rec.priority,
              suggestedPrompt: rec.suggestedPrompt,
            }, 'evaluator-store');
          }
        }
      }

      prevScanCount = count;
    }),
  );

  // ── UE5 bus events → ue5BridgeStore ──

  unsubs.push(
    eventBus.on('ue5.connected', (event) => {
      useUE5BridgeStore.getState().setConnectionState({
        status: 'connected',
        info: { version: event.payload.version, serverName: '' },
        error: null,
        lastConnected: new Date().toISOString(),
        reconnectAttempts: 0,
      });
    }),
  );

  unsubs.push(
    eventBus.on('ue5.disconnected', () => {
      useUE5BridgeStore.getState().setConnectionState({
        status: 'disconnected',
        info: null,
        error: null,
        lastConnected: useUE5BridgeStore.getState().connectionState.lastConnected,
        reconnectAttempts: 0,
      });
    }),
  );

  unsubs.push(
    eventBus.on('ue5.error', (event) => {
      const prev = useUE5BridgeStore.getState().connectionState;
      useUE5BridgeStore.getState().setConnectionState({
        ...prev,
        status: 'error',
        error: event.payload.message,
      });
    }),
  );

  // ── Module store → bus (checklist changes) ──

  let prevChecklist: Record<string, Record<string, boolean>> = {};

  unsubs.push(
    useModuleStore.subscribe((state) => {
      for (const [moduleId, items] of Object.entries(state.checklistProgress)) {
        const prevItems = prevChecklist[moduleId] ?? {};
        for (const [itemId, checked] of Object.entries(items)) {
          if (prevItems[itemId] !== checked) {
            eventBus.emit('checklist.item.changed', {
              moduleId: moduleId as SubModuleId,
              itemId,
              checked,
              source: 'user',
            }, 'module-store');
          }
        }
      }
      // Shallow-copy for next comparison
      const next: Record<string, Record<string, boolean>> = {};
      for (const [k, v] of Object.entries(state.checklistProgress)) {
        next[k] = { ...v };
      }
      prevChecklist = next;
    }),
  );

  return () => {
    for (const unsub of unsubs) unsub();
  };
}

/** Fire-and-forget POST to /api/session-log. Never throws. */
function recordSessionLogEvent(
  tabId: string,
  sessionKey: string,
  moduleId: string,
  event: 'started' | 'completed',
  success?: boolean,
): void {
  const projectPath = useProjectStore.getState().projectPath;
  fetch('/api/session-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'log',
      tabId,
      sessionKey,
      moduleId,
      projectPath: projectPath || '',
      event,
      ...(success !== undefined ? { success } : {}),
    }),
  }).catch(() => {});
}
