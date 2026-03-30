'use client';

import { useState } from 'react';
import { Monitor, Plug, PlugZap, Settings, AlertTriangle } from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

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

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-medium text-text">Blender MCP</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              connection.connected
                ? 'bg-emerald-500/10 text-emerald-400'
                : isConnecting
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-zinc-500/10 text-zinc-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connection.connected
                  ? 'bg-emerald-400'
                  : isConnecting
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-zinc-400'
              }`}
            />
            {connection.connected
              ? `Connected${connection.blenderVersion ? ` (${connection.blenderVersion})` : ''}`
              : isConnecting
                ? 'Connecting...'
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
              connection.connected
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
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
        <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/5 rounded px-2 py-1.5">
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
