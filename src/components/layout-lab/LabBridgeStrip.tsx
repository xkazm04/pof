'use client';

/**
 * LabBridgeStrip
 *
 * Compact inline status strip showing the UE bridge connection state.
 * Renders the shared `BridgeStatusIndicator` so semantics (color/label/icon
 * pulse) stay identical to the TopBar pill and the panel badges — only the
 * palette is overridden with lab theme tokens (Blueprint / Studio Dark) so
 * the strip blends into the /layout aesthetic.
 *
 * Clicking the strip opens the Bridge Doctor diagnostic popover so a failed
 * connection turns into a guided fix instead of an opaque error string.
 */

import { BridgeStatusIndicator, type ConnectionStatus } from '@/components/ui/BridgeStatusIndicator';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { BridgeDoctor } from '@/components/bridge-doctor/BridgeDoctor';
import { Z_INDEX } from '@/lib/constants';
import { Button } from './ui/Button';
import { useHeaderPopover } from './hooks/useHeaderPopover';
import type { LabTheme } from './theme';

interface LabBridgeStripProps {
  t: LabTheme;
}

function buildDetail(
  status: ConnectionStatus,
  plugin: ReturnType<typeof usePofBridgeStore.getState>['pluginInfo'],
): string {
  if (status === 'connected' && plugin) {
    const parts: string[] = [`UE ${plugin.engineVersion ?? '?'}`];
    if (plugin.projectName) parts.push(plugin.projectName);
    if (typeof plugin.manifestAssetCount === 'number') {
      parts.push(`${plugin.manifestAssetCount} assets`);
    }
    return parts.join(' · ');
  }
  // Every other state names itself: a bridge that is connecting, reconnecting, in error, or
  // connected before its plugin info arrived must never read "disconnected".
  return `UE bridge · ${STATUS_WORD[status]}`;
}

const STATUS_WORD: Record<ConnectionStatus, string> = {
  connected: 'connected',
  connecting: 'connecting…',
  reconnecting: 'reconnecting…',
  disconnected: 'disconnected',
  error: 'error',
};

export function LabBridgeStrip({ t }: LabBridgeStripProps) {
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);
  const pluginInfo = usePofBridgeStore((s) => s.pluginInfo);
  const detail = buildDetail(connectionStatus, pluginInfo);
  const { open, toggle, panelRef, wrapperProps } = useHeaderPopover();

  const labPalette: Partial<Record<ConnectionStatus, string>> = {
    connected: t.ok,
    connecting: t.warn,
    reconnecting: t.warn,
    disconnected: t.muted,
    error: t.bad,
  };

  return (
    <span {...wrapperProps} style={{ marginLeft: 'auto', position: 'relative' }}>
      <Button
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        // An aria-label replaces the status text inside the button, so the state rides in it.
        ariaLabel={`Open Bridge Doctor diagnostics — ${detail}`}
        title="Open Bridge Doctor"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          minWidth: 0,
        }}
      >
        <BridgeStatusIndicator
          status={connectionStatus}
          variant="strip"
          label={detail}
          paletteOverride={labPalette}
        />
      </Button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Bridge Doctor"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(560px, 92vw)',
            zIndex: Z_INDEX.panel,
          }}
        >
          <BridgeDoctor autoRun />
        </div>
      )}
    </span>
  );
}
