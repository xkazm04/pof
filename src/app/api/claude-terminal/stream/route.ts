/**
 * Claude Terminal Stream API Route (CLI-based)
 * Event-driven SSE — subscribes to execution events instead of polling.
 */

import { NextRequest } from 'next/server';
import {
  getExecution,
  startExecution,
  subscribeToExecution,
  type CLIExecutionEvent,
} from '@/lib/claude-terminal/cli-service';

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  /**
   * Position of the execution event this frame carries: its index in
   * `execution.events` + 1. Absent on synthesized frames (connected, heartbeat).
   */
  seq?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const executionId = searchParams.get('executionId');
  const projectPath = searchParams.get('projectPath');
  const prompt = searchParams.get('prompt');
  const resumeSessionId = searchParams.get('resumeSessionId');
  // Resume cursor: the last `seq` the client already holds. A re-shown terminal
  // reconnects with it so the replay skips what is on screen (missing = 0 = full replay).
  const after = Math.max(0, Number.parseInt(searchParams.get('after') ?? '0', 10) || 0);

  let activeExecutionId = executionId;

  if (!activeExecutionId && projectPath && prompt) {
    activeExecutionId = startExecution(
      decodeURIComponent(projectPath),
      decodeURIComponent(prompt),
      resumeSessionId ? decodeURIComponent(resumeSessionId) : undefined
    );
  }

  if (!activeExecutionId) {
    return new Response('Execution ID or (projectPath + prompt) required', { status: 400 });
  }

  const encoder = new TextEncoder();
  let isStreamClosed = false;
  // Shared with cancel() below — a client disconnect (tab closed, navigated away)
  // fires ReadableStream's cancel(), a sibling of start() with no access to anything
  // declared inside it. Without these refs, cancel() could only flip isStreamClosed
  // and had to wait for the heartbeat's own next 15s tick, or the subscription's next
  // emitted event, to notice and clean up.
  let unsubscribeRef: (() => void) | null = null;
  let heartbeatIntervalRef: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: SSEEvent) => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          isStreamClosed = true;
        }
      };

      const closeStream = () => {
        if (isStreamClosed) return;
        isStreamClosed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      sendEvent({
        type: 'connected',
        data: { executionId: activeExecutionId },
        timestamp: Date.now(),
      });

      const convertEvent = (cliEvent: CLIExecutionEvent): SSEEvent => {
        switch (cliEvent.type) {
          case 'init':
            return { type: 'connected', data: { executionId: activeExecutionId, sessionId: cliEvent.data.sessionId, model: cliEvent.data.model, tools: cliEvent.data.tools, version: cliEvent.data.version }, timestamp: cliEvent.timestamp };
          case 'text':
            return { type: 'message', data: { type: 'assistant', content: cliEvent.data.content, model: cliEvent.data.model }, timestamp: cliEvent.timestamp };
          case 'tool_use':
            return { type: 'tool_use', data: { toolUseId: cliEvent.data.id, toolName: cliEvent.data.name, toolInput: cliEvent.data.input }, timestamp: cliEvent.timestamp };
          case 'tool_result':
            return { type: 'tool_result', data: { toolUseId: cliEvent.data.toolUseId, content: cliEvent.data.content }, timestamp: cliEvent.timestamp };
          case 'result':
            return { type: 'result', data: { sessionId: cliEvent.data.sessionId, usage: cliEvent.data.usage, durationMs: cliEvent.data.durationMs, totalCostUsd: cliEvent.data.costUsd, isError: cliEvent.data.isError }, timestamp: cliEvent.timestamp };
          case 'error':
            return { type: 'error', data: { error: cliEvent.data.message, exitCode: cliEvent.data.exitCode }, timestamp: cliEvent.timestamp };
          case 'callbacks':
            return { type: 'callbacks', data: { status: cliEvent.data.status, failed: cliEvent.data.failed }, timestamp: cliEvent.timestamp };
          default:
            return { type: 'stdout', data: cliEvent.data, timestamp: cliEvent.timestamp };
        }
      };

      // Replay any events that arrived between startExecution and this SSE connection
      const execution = getExecution(activeExecutionId!);
      if (!execution) {
        sendEvent({ type: 'error', data: { error: 'Execution not found' }, timestamp: Date.now() });
        closeStream();
        return;
      }

      // A run that declared @@CALLBACKs is settled server-side AFTER its result: its
      // stream ends with the `callbacks` frame (the verdict), not with `result`.
      const settlesCallbacks = (execution.callbacks?.length ?? 0) > 0;
      const isTerminal = (type: CLIExecutionEvent['type']) =>
        type === 'error' || type === (settlesCallbacks ? 'callbacks' : 'result');

      for (let i = 0; i < execution.events.length; i++) {
        const event = execution.events[i];
        const seq = i + 1;
        if (event.type === 'stdout' || seq <= after) continue;
        sendEvent({ ...convertEvent(event), seq });
        if (isTerminal(event.type)) {
          closeStream();
          return;
        }
      }

      // A cleanly finished run whose callback settlement is still in flight: wait for it.
      const awaitingSettlement = settlesCallbacks && execution.status === 'completed' && execution.callbackStatus === undefined;

      // If execution already finished during replay
      if (execution.status !== 'running' && !awaitingSettlement) {
        sendEvent({
          type: execution.status === 'completed' ? 'result' : 'error',
          data: { status: execution.status, sessionId: execution.sessionId },
          timestamp: Date.now(),
        });
        closeStream();
        return;
      }

      // Subscribe to future events (event-driven, no polling)
      const unsubscribe = unsubscribeRef = subscribeToExecution(activeExecutionId!, (cliEvent) => {
        if (isStreamClosed) { unsubscribe?.(); return; }
        if (cliEvent.type === 'stdout') return;
        // Live events are appended before listeners run: the position is where it landed.
        const idx = execution.events.lastIndexOf(cliEvent);
        sendEvent(idx >= 0 ? { ...convertEvent(cliEvent), seq: idx + 1 } : convertEvent(cliEvent));
        if (isTerminal(cliEvent.type)) {
          unsubscribe?.();
          closeStream();
        }
      });

      if (!unsubscribe) {
        sendEvent({ type: 'error', data: { error: 'Failed to subscribe to execution' }, timestamp: Date.now() });
        closeStream();
        return;
      }

      // Heartbeat to keep the connection alive
      const heartbeatInterval = heartbeatIntervalRef = setInterval(() => {
        if (isStreamClosed) { clearInterval(heartbeatInterval); unsubscribe(); return; }
        try {
          sendEvent({ type: 'heartbeat', data: { executionId: activeExecutionId, timestamp: Date.now() }, timestamp: Date.now() });
        } catch {
          isStreamClosed = true;
          clearInterval(heartbeatInterval);
          unsubscribe();
        }
      }, 15000);

      // Safety timeout: if execution takes too long, clean up
      setTimeout(() => {
        if (!isStreamClosed) {
          unsubscribe();
          clearInterval(heartbeatInterval);
          closeStream();
        }
      }, 6100000); // Slightly longer than the 100-minute execution timeout
    },
    cancel() {
      // The client disconnected (tab closed, navigated away) — clean up immediately
      // rather than leaving the heartbeat and subscription to notice on their own.
      isStreamClosed = true;
      if (heartbeatIntervalRef) clearInterval(heartbeatIntervalRef);
      unsubscribeRef?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
