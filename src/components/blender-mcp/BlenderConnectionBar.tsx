'use client';

import { useState } from 'react';
import { Monitor, Plug, PlugZap, Settings, AlertTriangle } from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import {
  PILL_BY_STATE,
  DOT_BY_STATE,
  CONNECT_BUTTON,
  DISCONNECT_BUTTON,
  ERROR_BANNER,
} from '@/lib/blender-mcp/status-tokens';

export function BlenderConnectionBar() {
  const {
    connection,
    isConnecting,
    lastError,
    host,
    port,
    connect,
    disconnect,
    setSettings,
  } = useBlenderMCPStore();
  const [showSettings, setShowSettings] = useState(false);
  const [editHost, setEditHost] = useState(host);
  const [editPort, setEditPort] = useState(String(port));

  const handleConnect = () => {
    if (connection.connected) {
      disconnect();
    } else {
      connect(editHost, Number(editPort));
    }
  };

  const handleSaveSettings = () => {
    setSettings(editHost, Number(editPort), false);
    setShowSettings(false);
  };

  const state = connection.connected
    ? 'connected'
    : isConnecting
      ? 'connecting'
      : 'disconnected';

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-medium text-text">Blender MCP</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PILL_BY_STATE[state]}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${DOT_BY_STATE[state]}`} />
            {connection.connected
              ? `Connected${connection.blenderVersion ? ` (${connection.blenderVersion})` : ''}`
              : isConnecting
                ? 'Connecting…'
                : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-surface-tertiary text-text-muted hover:text-text transition-colors"
            title="Connection settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              connection.connected ? DISCONNECT_BUTTON : CONNECT_BUTTON
            } disabled:opacity-50`}
          >
            {connection.connected ? (
              <>
                <Plug className="w-3 h-3" /> Disconnect
              </>
            ) : (
              <>
                <PlugZap className="w-3 h-3" /> Connect
              </>
            )}
          </button>
        </div>
      </div>

      {lastError && (
        <div className={`flex items-start gap-2 text-[11px] rounded px-2 py-1.5 ${ERROR_BANNER}`}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      {showSettings && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={editHost}
            onChange={(e) => setEditHost(e.target.value)}
            placeholder="Host"
            className="flex-1 bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
          />
          <input
            type="number"
            value={editPort}
            onChange={(e) => setEditPort(e.target.value)}
            placeholder="Port"
            className="w-20 bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
          />
          <button
            onClick={handleSaveSettings}
            className="px-2 py-1 rounded bg-accent/10 text-accent text-xs hover:bg-accent/20"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
