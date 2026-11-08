'use client';

import { useEffect, useRef } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTaskDAGStore } from '@/stores/taskDAGStore';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { getAppOrigin } from '@/lib/constants';
import { logger } from '@/lib/logger';
import {
  MAX_CONCURRENT_WORKFLOW_NODES,
  buildNodeTask,
  nodeRunSucceeded,
  selectNodesToRun,
  workflowSessionKey,
} from '@/lib/workflow-dispatch';
import type { DAGNode } from '@/types/task-dag';
import type { SubModuleId } from '@/types/modules';

const dag = () => useTaskDAGStore.getState();

/** Reports a node's end only to the run that launched it, and only once. */
function reportNode(executionId: string, nodeId: string, success: boolean): void {
  const execution = dag().activeExecution;
  if (execution?.id !== executionId || execution.nodeStates[nodeId]?.status !== 'running') return;
  dag().markNodeCompleted(nodeId, success);
}

/** One node's CLI session. Mounted for exactly the span the node holds a slot. */
function WorkflowNodeRunner({ executionId, node }: { executionId: string; node: DAGNode }) {
  const sessionKey = workflowSessionKey(executionId, node.id);
  const moduleId = node.moduleId as SubModuleId;
  const accentColor = MODULE_COLORS.evaluator;
  const { execute } = useModuleCLI({
    moduleId,
    sessionKey,
    label: node.label,
    accentColor,
    onComplete: (success, callbackStatus) => {
      reportNode(executionId, node.id, nodeRunSucceeded(success, callbackStatus));
    },
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    const execution = dag().activeExecution;
    // Only a queued node of the live run launches: attaching must never re-dispatch.
    if (execution?.id !== executionId || execution.status !== 'running') return;
    if (execution.nodeStates[node.id]?.status !== 'queued') return;
    startedRef.current = true;

    const fail = (reason: string) => {
      logger.warn(`[workflow] node "${node.label}" failed to launch: ${reason}`);
      reportNode(executionId, node.id, false);
    };

    // The tab exists BEFORE the launch: `running` covers the async prepare, and it is
    // what pins the terminal that will receive the prompt.
    const panel = useCLIPanelStore.getState();
    const tabId = panel.findSessionByKey(sessionKey) ?? panel.createSession({
      label: node.label,
      accentColor,
      moduleId,
      sessionKey,
      projectPath: useProjectStore.getState().projectPath,
    });
    dag().markNodeRunning(node.id, tabId);

    const task = buildNodeTask(node, getAppOrigin());
    if (!task) {
      fail(`task type "${node.taskType}" cannot run from this node`);
      return;
    }
    execute(task, {
      shouldDispatch: () => dag().activeExecution?.id === executionId,
      onDeclined: () => fail('the spend guard was declined'),
    }).catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
  }, [accentColor, execute, executionId, moduleId, node, sessionKey]);

  return null;
}

/**
 * Turns the active workflow's ready nodes into CLI sessions, up to the cap.
 *
 * Mounted once in the shell, outside the module LRU, because a run has to outlive the
 * Evaluator pane. If the shell itself goes away the run is cancelled rather than left
 * "running" with nobody to launch its next node.
 */
export function WorkflowDispatcher() {
  const execution = useTaskDAGStore((s) => s.activeExecution);
  const orchestrator = useTaskDAGStore((s) => s.activeOrchestrator);

  useEffect(() => () => dag().cancelWorkflow(), []);

  if (!execution || !orchestrator) return null;
  return (
    <>
      {selectNodesToRun(execution, MAX_CONCURRENT_WORKFLOW_NODES).map((nodeId) => {
        const node = orchestrator.getNode(nodeId);
        if (!node) return null;
        // retryCount in the key: a retry is a fresh runner, so it launches again.
        const attempt = execution.nodeStates[nodeId]?.retryCount ?? 0;
        return <WorkflowNodeRunner key={`${execution.id}:${nodeId}:${attempt}`} executionId={execution.id} node={node} />;
      })}
    </>
  );
}
