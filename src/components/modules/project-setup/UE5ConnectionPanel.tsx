'use client';

import { useState, useCallback } from 'react';
import { PlugZap, Unplug } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Button } from '@/components/ui/Button';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { BridgeStatusIndicator } from '@/components/ui/BridgeStatusIndicator';
import { useUE5Connection } from '@/hooks/useUE5Connection';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { ErrorBanner } from './ErrorBanner';

/**
 * The UE5 Remote Control connection control for Project Setup — and the app's
 * authoritative mount of {@link useUE5Connection}.
 *
 * WHY IT LIVES HERE. Every gate on a live editor points the user at this
 * screen: `/api/ue5-inject-item`'s 503 says "Connect via Project Setup first",
 * and the affix workbench's "Send to UE5" tooltip says the same. Until this
 * panel existed the hook was mounted only inside the debug console, so
 * `useUE5BridgeStore.connectionState` could only reach 'connected' while that
 * one panel happened to be open — the copy pointed at a surface that could not
 * do the job. Mounting the hook here makes the connection observable wherever
 * the product says to connect.
 *
 * WHY IT IS ALWAYS RENDERED. The mount IS the subscription: hiding this panel
 * behind `hasProject` (or any other condition) would close the stream and put
 * the store back to guessing. It renders in every Project Setup state.
 *
 * HONESTY RULE. Before the first SSE frame the panel says `Checking…` and
 * offers no action. It never renders a connected-looking state it has not been
 * told: the pre-stream store default ('disconnected') is a guess, and showing
 * it as "Offline" — or worse, offering CONNECT as though we knew the server was
 * idle — would be a claim the app has not earned.
 */
export function UE5ConnectionPanel() {
  const { status, info, error, isConnected, isStateLive, connect, disconnect } =
    useUE5Connection();
  const host = useUE5BridgeStore((s) => s.host);
  const httpPort = useUE5BridgeStore((s) => s.httpPort);

  const [pending, setPending] = useState<'connect' | 'disconnect' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = useCallback(
    async (kind: 'connect' | 'disconnect') => {
      setPending(kind);
      setActionError(null);
      // The verb's Result is only used for the failure reason. The resulting
      // STATE arrives on the SSE stream — applying the POST response here too
      // would make this component a second writer racing the stream.
      const result = await (kind === 'connect' ? connect() : disconnect());
      setPending(null);
      if (!result.ok) setActionError(result.error);
    },
    [connect, disconnect],
  );

  const handleConnect = useCallback(() => void runAction('connect'), [runAction]);
  const handleDisconnect = useCallback(() => void runAction('disconnect'), [runAction]);

  // `error` is the server's last connection error, carried on the SSE frame;
  // `actionError` is a verb that never reached the server at all.
  const shownError = actionError ?? (isStateLive ? error : null);

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        UE5 Editor Connection
      </h2>
      <SurfaceCard className="p-4" data-testid="pof-ue5-connection-panel">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BridgeStatusIndicator
                status={isStateLive ? status : 'connecting'}
                variant="strip"
                label={isStateLive ? undefined : 'Checking…'}
                title={
                  isStateLive
                    ? 'UE5 Remote Control state, streamed live from the server'
                    : 'Waiting for the first status frame from /api/ue5-bridge/status'
                }
                className="text-sm"
              />
              {/* MicroLabel has a closed prop list (no data-* passthrough), so
                  the endpoint is identified by its text, not a test id. */}
              <MicroLabel mono title="UE5 Remote Control HTTP endpoint">
                {host}:{httpPort}
              </MicroLabel>
            </div>
            <p className="text-sm text-text-muted">
              {!isStateLive
                ? 'Reading the editor connection from the server…'
                : isConnected
                  ? `Remote Control is live${info?.version ? ` on UE ${info.version}` : ''}. Features that push into the running editor — “Send to UE5” in the affix workbench, for one — are unlocked.`
                  : 'The server is not talking to the UE5 editor. Start the editor with the Remote Control plugin enabled, then connect — features that push into a running editor stay disabled until then.'}
            </p>
          </div>

          {/* No action until the stream has told us something: a CONNECT button
              before the first frame would imply we know the server is idle. */}
          {isStateLive && (
            <Button
              data-testid="pof-ue5-connection-action"
              intent={isConnected ? undefined : 'primary'}
              variant={isConnected ? 'outline' : 'solid'}
              onClick={isConnected ? handleDisconnect : handleConnect}
              loading={pending !== null}
              loadingLabel={pending === 'disconnect' ? 'Disconnecting…' : 'Connecting…'}
              leftIcon={
                isConnected ? <Unplug className="w-4 h-4" /> : <PlugZap className="w-4 h-4" />
              }
            >
              {isConnected ? 'Disconnect' : 'Connect to UE5'}
            </Button>
          )}
        </div>

        {shownError && (
          <ErrorBanner
            message={shownError}
            className="mt-3"
            data-testid="pof-ue5-connection-error"
          />
        )}
      </SurfaceCard>
    </div>
  );
}
