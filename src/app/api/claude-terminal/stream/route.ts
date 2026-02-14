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
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const executionId = searchParams.get('executionId');
  const projectPath = searchParams.get('projectPath');
  const prompt = searchParams.get('prompt');
  const resumeSessionId = searchParams.get('resumeSessionId');

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

      for (const event of execution.events) {
        if (event.type === 'stdout') continue;
        sendEvent(convertEvent(event));
        if (event.type === 'result' || event.type === 'error') {
          closeStream();
          return;
        }
      }

      // If execution already finished during replay
      if (execution.status !== 'running') {
        sendEvent({
          type: execution.status === 'completed' ? 'result' : 'error',
          data: { status: execution.status, sessionId: execution.sessionId },
          timestamp: Date.now(),
        });
        closeStream();
        return;
      }

      // Subscribe to future events (event-driven, no polling)
      const unsubscribe = subscribeToExecution(activeExecutionId!, (cliEvent) => {
        if (isStreamClosed) { unsubscribe?.(); return; }
        if (cliEvent.type === 'stdout') return;
        sendEvent(convertEvent(cliEvent));
        if (cliEvent.type === 'result' || cliEvent.type === 'error') {
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
      const heartbeatInterval = setInterval(() => {
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
      isStreamClosed = true;
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
