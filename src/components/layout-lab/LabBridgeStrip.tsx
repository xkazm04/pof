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

import { useCallback, useEffect, useRef, useState } from 'react';
import { BridgeStatusIndicator, type ConnectionStatus } from '@/components/ui/BridgeStatusIndicator';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { BridgeDoctor } from '@/components/bridge-doctor/BridgeDoctor';
import { Z_INDEX } from '@/lib/constants';
import { Button } from './ui/Button';
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
  return 'UE bridge · disconnected';
}

export function LabBridgeStrip({ t }: LabBridgeStripProps) {
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);
  const pluginInfo = usePofBridgeStore((s) => s.pluginInfo);
  const detail = buildDetail(connectionStatus, pluginInfo);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const labPalette: Partial<Record<ConnectionStatus, string>> = {
    connected: t.ok,
    connecting: t.warn,
    reconnecting: t.warn,
    disconnected: t.muted,
    error: t.bad,
  };

  return (
    <span ref={wrapperRef} style={{ marginLeft: 'auto', position: 'relative' }}>
      <Button
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        ariaLabel="Open Bridge Doctor diagnostics"
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
