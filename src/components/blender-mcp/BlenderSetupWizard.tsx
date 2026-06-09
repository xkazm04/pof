'use client';

import { useState } from 'react';
import {
  Monitor,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PlugZap,
  RotateCw,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import {
  classifyConnectionError,
  BLENDER_RETRY_MAX_ATTEMPTS,
} from '@/lib/blender-mcp/diagnostics';
import {
  SUCCESS_RESULT,
  ERROR_BANNER,
  CONNECT_BUTTON,
} from '@/lib/blender-mcp/status-tokens';

interface BlenderSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Guided connection wizard for the Blender MCP bridge.
 *
 * Replaces the bare error string with a diagnosed failure mode (Blender not
 * running / addon not installed / wrong port / timeout / unreachable host),
 * plain-language fix steps, an addon-install link, and a live auto-retry
 * status. Lives in a child component so it mounts fresh each time the modal
 * opens (re-seeding the host/port fields from the store).
 */
export function BlenderSetupWizard({ open, onClose }: BlenderSetupWizardProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Blender connection setup"
      icon={<Monitor className="w-4 h-4 text-text-muted" aria-hidden="true" />}
      className="max-w-lg"
    >
      <WizardBody />
    </Modal>
  );
}

function WizardBody() {
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
    setAutoConnect,
  } = useBlenderMCPStore();

  const [editHost, setEditHost] = useState(host);
  const [editPort, setEditPort] = useState(String(port));

  const connected = connection.connected;
  const diagnosis = classifyConnectionError(lastError, {
    host: connection.host || host,
    port: connection.port || port,
  });

  const handleTest = () => {
    connect(editHost.trim() || host, Number(editPort) || port);
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      {connected ? (
        <div
          className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${SUCCESS_RESULT}`}
        >
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-green-400" aria-hidden="true" />
          <div>
            <p className="font-semibold text-text">
              Connected to Blender
              {connection.blenderVersion ? ` ${connection.blenderVersion}` : ''}
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              The MCP bridge is live on {connection.host}:{connection.port}.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${ERROR_BANNER}`}
          >
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">{diagnosis.title}</p>
              <p className="text-xs mt-0.5 leading-snug">{diagnosis.summary}</p>
            </div>
          </div>

          <ol className="flex flex-col gap-2 list-none m-0 p-0">
            {diagnosis.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-text-muted">
                <span
                  aria-hidden="true"
                  className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-tertiary text-text text-xs font-semibold tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>

          {diagnosis.addonInstallUrl && (
            <a
              href={diagnosis.addonInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-center gap-1.5 self-start rounded-md px-2.5 h-8 text-[13px] font-semibold bg-accent/10 text-accent hover:bg-accent/20"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Install the Blender MCP addon
            </a>
          )}

          {autoRetrying && (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-amber-400"
            >
              <RotateCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Auto-retrying… (attempt {retryAttempt + 1} of {BLENDER_RETRY_MAX_ATTEMPTS})
            </p>
          )}
        </div>
      )}

      {/* Connection settings */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="wizard-host" className="text-xs text-text-muted">
              Host
            </label>
            <input
              id="wizard-host"
              type="text"
              value={editHost}
              onChange={(e) => setEditHost(e.target.value)}
              placeholder="localhost"
              className="focus-ring bg-surface-tertiary border border-border rounded-md px-2.5 h-8 text-[13px] text-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="wizard-port" className="text-xs text-text-muted">
              Port
            </label>
            <input
              id="wizard-port"
              type="number"
              value={editPort}
              onChange={(e) => setEditPort(e.target.value)}
              placeholder="9876"
              className="focus-ring w-24 bg-surface-tertiary border border-border rounded-md px-2.5 h-8 text-[13px] text-text tabular-nums"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoConnect}
            onChange={(e) => setAutoConnect(e.target.checked)}
            className="focus-ring w-4 h-4 rounded border-border accent-accent"
          />
          Auto-connect on launch (keeps retrying with backoff)
        </label>

        <button
          type="button"
          onClick={handleTest}
          disabled={isConnecting}
          className={`focus-ring inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-semibold transition-colors ${CONNECT_BUTTON} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Testing…
            </>
          ) : (
            <>
              <PlugZap className="w-4 h-4" aria-hidden="true" />
              Test connection
            </>
          )}
        </button>

        {lastError && !connected && (
          <p className="text-2xs text-text-muted/80 font-mono break-words leading-snug">
            Technical detail: {lastError}
          </p>
        )}
      </div>
    </div>
  );
}
