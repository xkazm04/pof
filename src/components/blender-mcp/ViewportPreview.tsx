'use client';

import { useState, useCallback } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

export function ViewportPreview() {
  const { connection, addScreenshot, recentScreenshots } =
    useBlenderMCPStore();
  const [isCapturing, setIsCapturing] = useState(false);

  const captureScreenshot = useCallback(async () => {
    if (!connection.connected) return;
    setIsCapturing(true);
    const result = await tryApiFetch<{ screenshot: string }>(
      '/api/blender-mcp/screenshot',
    );
    if (result.ok && result.data.screenshot) {
      // Convert base64 to object URL for memory efficiency
      const binary = atob(result.data.screenshot);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      addScreenshot(URL.createObjectURL(blob));
    }
    setIsCapturing(false);
  }, [connection.connected, addScreenshot]);

  const latestScreenshot = recentScreenshots[0];

  return (
    <div className="rounded-lg border border-border bg-surface-secondary overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-text">
          Blender Viewport
        </span>
        <button
          onClick={captureScreenshot}
          disabled={!connection.connected || isCapturing}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text disabled:opacity-40 transition-colors"
        >
          {isCapturing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Camera className="w-3 h-3" />
          )}
          Capture
        </button>
      </div>
      <div className="aspect-video bg-black/50 flex items-center justify-center">
        {latestScreenshot ? (
          <img
            src={latestScreenshot}
            alt="Blender viewport"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-xs text-text-muted">
            {connection.connected
              ? 'Click Capture to preview'
              : 'Connect to Blender first'}
          </span>
        )}
      </div>
    </div>
  );
}
