/**
 * File Watcher SSE Endpoint
 *
 * GET /api/filesystem/watch?projectPath=...
 *   Starts watching the Source/ directory and streams FileChangeEvents via SSE.
 *
 * POST /api/filesystem/watch { action: 'status' }
 *   Returns current watcher state.
 */

import { NextRequest } from 'next/server';
import {
  startWatching,
  stopWatching,
  subscribe,
  getWatcherState,
  type FileChangeEvent,
} from '@/lib/file-watcher';
import { apiSuccess, apiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('projectPath');

  if (!projectPath) {
    return new Response('projectPath query parameter required', { status: 400 });
  }

  const started = startWatching(decodeURIComponent(projectPath));
  if (!started) {
    return new Response('Failed to watch — Source/ directory not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  let isStreamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));
      } catch { /* ignore */ }

      // Subscribe to file changes
      const unsubscribe = subscribe((events: FileChangeEvent[]) => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'changes', events })}\n\n`));
        } catch {
          isStreamClosed = true;
          unsubscribe();
        }
      });

      // Send keepalive every 30s
      const keepalive = setInterval(() => {
        if (isStreamClosed) {
          clearInterval(keepalive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          isStreamClosed = true;
          clearInterval(keepalive);
          unsubscribe();
        }
      }, 30_000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        isStreamClosed = true;
        clearInterval(keepalive);
        unsubscribe();
        // Stop watching if no more subscribers
        const state = getWatcherState();
        if (state.subscriberCount <= 0) {
          stopWatching();
        }
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'status':
        return apiSuccess(getWatcherState());

      case 'stop':
        stopWatching();
        return apiSuccess({ stopped: true });

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error');
  }
}
