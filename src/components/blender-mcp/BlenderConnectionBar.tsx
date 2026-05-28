'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Monitor, Plug, PlugZap, Settings, AlertTriangle } from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import {
  PILL_BY_STATE,
  DOT_BY_STATE,
  CONNECT_BUTTON,
  DISCONNECT_BUTTON,
  ERROR_BANNER,
} from '@/lib/blender-mcp/status-tokens';
import { McpPanelFrame } from './McpPanelFrame';

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

  const statusLabel = connection.connected
    ? `Connected${connection.blenderVersion ? ` (${connection.blenderVersion})` : ''}`
    : isConnecting
      ? 'Connecting…'
      : 'Disconnected';

  const connectDisabledReason = isConnecting
    ? 'Connecting — please wait'
    : undefined;

  const statusPill = (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Blender MCP status: ${statusLabel}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${PILL_BY_STATE[state]}`}
    >
      <span
        aria-hidden="true"
        className={`w-2 h-2 rounded-full ${DOT_BY_STATE[state]}`}
      />
      {statusLabel}
    </span>
  );

  const actions = (
    <>
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="focus-ring inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-surface-tertiary text-text-muted hover:text-text transition-colors"
        title="Connection settings"
        aria-label="Connection settings"
        aria-expanded={showSettings}
      >
        <Settings className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        title={connectDisabledReason}
        aria-label={
          connection.connected
            ? 'Disconnect from Blender MCP'
            : isConnecting
              ? 'Connecting to Blender MCP, please wait'
              : 'Connect to Blender MCP'
        }
        className={`focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-colors ${
          connection.connected ? DISCONNECT_BUTTON : CONNECT_BUTTON
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {connection.connected ? (
          <>
            <Plug className="w-3.5 h-3.5" aria-hidden="true" /> Disconnect
          </>
        ) : (
          <>
            <PlugZap className="w-3.5 h-3.5" aria-hidden="true" /> Connect
          </>
        )}
      </button>
    </>
  );

  return (
    <McpPanelFrame
      title="Blender MCP"
      icon={<Monitor className="w-4 h-4" />}
      status={statusPill}
      actions={actions}
      bodyPadding="none"
    >
      <AnimatePresence initial={false}>
        {lastError && (
          <motion.div
            key="connection-error"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              role="alert"
              aria-live="polite"
              className={`flex items-start gap-2 text-xs leading-snug rounded-md mx-3 mt-2 px-2.5 py-2 ${ERROR_BANNER}`}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{lastError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showSettings && (
          <motion.div
            key="connection-settings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <label htmlFor="blender-mcp-host" className="sr-only">
                Blender MCP host
              </label>
              <input
                id="blender-mcp-host"
                type="text"
                value={editHost}
                onChange={(e) => setEditHost(e.target.value)}
                placeholder="Host"
                aria-label="Blender MCP host"
                className="focus-ring flex-1 bg-surface-tertiary border border-border rounded-md px-2.5 h-8 text-[13px] text-text"
              />
              <label htmlFor="blender-mcp-port" className="sr-only">
                Blender MCP port
              </label>
              <input
                id="blender-mcp-port"
                type="number"
                value={editPort}
                onChange={(e) => setEditPort(e.target.value)}
                placeholder="Port"
                aria-label="Blender MCP port"
                className="focus-ring w-24 bg-surface-tertiary border border-border rounded-md px-2.5 h-8 text-[13px] text-text tabular-nums"
              />
              <button
                type="button"
                onClick={handleSaveSettings}
                aria-label="Save Blender MCP connection settings"
                className="focus-ring h-8 px-3 rounded-md bg-accent/10 text-accent text-[13px] font-semibold hover:bg-accent/20"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* When neither banner nor settings shown, ensure the frame still has a thin bottom gutter */}
      {!lastError && !showSettings && <div className="h-1" aria-hidden="true" />}
    </McpPanelFrame>
  );
}
