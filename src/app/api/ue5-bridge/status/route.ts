/**
 * UE5 Bridge Status SSE Endpoint
 *
 * GET /api/ue5-bridge/status
 *   Streams UE5 connection state changes via Server-Sent Events.
 *   Pushes the initial state immediately, then every subsequent change.
 *   Sends keepalive comments every 30s to prevent proxy/browser timeouts.
 */

import { NextRequest } from 'next/server';
import { ue5Connection } from '@/lib/ue5-bridge/connection-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let isStreamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Push initial state immediately
      try {
        const initial = ue5Connection.getState();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initial)}\n\n`),
        );
      } catch { /* ignore */ }

      // Subscribe to state changes
      const unsubscribe = ue5Connection.onStateChange((state) => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(state)}\n\n`),
          );
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
