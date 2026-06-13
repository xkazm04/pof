'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Monitor,
  Plug,
  PlugZap,
  Settings,
  RotateCw,
  LifeBuoy,
} from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { classifyConnectionError } from '@/lib/blender-mcp/diagnostics';
import {
  PILL_BY_STATE,
  DOT_BY_STATE,
  CONNECT_BUTTON,
  DISCONNECT_BUTTON,
} from '@/lib/blender-mcp/status-tokens';
import { McpPanelFrame } from './McpPanelFrame';
import { McpErrorBanner } from './McpErrorBanner';
import { BlenderSetupWizard } from './BlenderSetupWizard';

export function BlenderConnectionBar() {
  const {
    connection,
    isConnecting,
    lastError,
    host,
    port,
    autoConnect,
    autoRetrying,
    retryAttempt,
    connect,
    disconnect,
    setSettings,
    setAutoConnect,
    maybeAutoConnect,
    ensureHealthCheck,
    stopHealthCheck,
  } = useBlenderMCPStore();
  const [showSettings, setShowSettings] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editHost, setEditHost] = useState(host);
  const [editPort, setEditPort] = useState(String(port));

  // Honor the persisted autoConnect flag once on mount (idempotent in store).
  useEffect(() => {
    maybeAutoConnect();
  }, [maybeAutoConnect]);

  // The liveness probe is store-managed (mirrors the retryTimer pattern) and is
  // armed on a successful connect. On mount, re-arm it if the connection is
  // already live (e.g. after a remount); on unmount, tear it down so no probe
  // interval leaks. The connection itself is left untouched.
  useEffect(() => {
    ensureHealthCheck();
    return () => stopHealthCheck();
  }, [ensureHealthCheck, stopHealthCheck]);

  const handleConnect = () => {
    if (connection.connected) {
      disconnect();
    } else {
      connect(editHost, Number(editPort));
    }
  };

  const handleSaveSettings = () => {
    setSettings(editHost, Number(editPort), autoConnect);
    setShowSettings(false);
  };

  const state = connection.connected
    ? 'connected'
    : isConnecting || autoRetrying
      ? 'connecting'
      : 'disconnected';

  const statusLabel = connection.connected
    ? `Connected${connection.blenderVersion ? ` (${connection.blenderVersion})` : ''}`
    : isConnecting
      ? 'Connecting…'
      : autoRetrying
        ? `Reconnecting… (attempt ${retryAttempt + 1})`
        : 'Disconnected';

  const connectDisabledReason = isConnecting
    ? 'Connecting — please wait'
    : undefined;

  const diagnosis = lastError
    ? classifyConnectionError(lastError, {
        host: connection.host || host,
        port: connection.port || port,
      })
    : null;

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
      <McpErrorBanner
        show={!!diagnosis}
        motionKey="connection-error"
        action={
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="focus-ring shrink-0 self-start inline-flex items-center gap-1 rounded px-2 h-6 text-2xs font-semibold bg-accent/10 text-accent hover:bg-accent/20"
          >
            <LifeBuoy className="w-3 h-3" aria-hidden="true" />
            Troubleshoot
          </button>
        }
      >
        {diagnosis && (
          <>
            <p className="font-semibold">{diagnosis.title}</p>
            <p className="mt-0.5">{diagnosis.summary}</p>
            {autoRetrying && (
              <p className="mt-1 flex items-center gap-1.5 text-amber-400">
                <RotateCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                Reconnecting… attempt {retryAttempt + 1}
              </p>
            )}
          </>
        )}
      </McpErrorBanner>

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
            <div className="flex flex-col gap-2.5 px-3 py-2.5">
              <div className="flex items-center gap-2">
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
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[13px] text-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoConnect}
                    onChange={(e) => setAutoConnect(e.target.checked)}
                    aria-label="Auto-connect to Blender MCP on launch"
                    className="focus-ring w-4 h-4 rounded border-border accent-accent"
                  />
                  Auto-connect on launch
                </label>
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="focus-ring inline-flex items-center gap-1 rounded px-2 h-7 text-xs font-medium text-text-muted hover:text-text hover:bg-surface-tertiary"
                >
                  <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
                  Setup guide
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* When neither banner nor settings shown, ensure the frame still has a thin bottom gutter */}
      {!diagnosis && !showSettings && <div className="h-1" aria-hidden="true" />}

      <BlenderSetupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </McpPanelFrame>
  );
}
