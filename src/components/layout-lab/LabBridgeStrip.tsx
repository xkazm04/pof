'use client';

/**
 * LabBridgeStrip
 *
 * Compact inline status strip showing the UE bridge connection state.
 * Reads from usePofBridgeStore directly (display-only — connection wiring
 * is handled upstream by usePofBridge when the full app shell mounts).
 * Degrades gracefully: shows "disconnected · no UE bridge" when nothing is connected.
 */

import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import type { LabTheme } from './theme';

interface LabBridgeStripProps {
  t: LabTheme;
}

export function LabBridgeStrip({ t }: LabBridgeStripProps) {
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);
  const pluginInfo = usePofBridgeStore((s) => s.pluginInfo);

  // Map PofConnectionStatus → dot color using LabTheme tokens
  let dotColor: string;
  if (connectionStatus === 'connected') {
    dotColor = t.ok;
  } else if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
    dotColor = t.warn;
  } else {
    // 'disconnected' | 'error' → muted
    dotColor = t.muted;
  }

  const isConnected = connectionStatus === 'connected';

  // Build label segments
  let label: string;
  if (isConnected && pluginInfo) {
    const parts: string[] = ['UE'];
    if (pluginInfo.engineVersion) parts[0] = `UE ${pluginInfo.engineVersion}`;
    if (pluginInfo.projectName) parts.push(pluginInfo.projectName);
    if (typeof pluginInfo.manifestAssetCount === 'number') {
      parts.push(`${pluginInfo.manifestAssetCount} assets`);
    }
    label = parts.join(' · ');
  } else {
    label = 'UE bridge · disconnected';
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 'auto',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 14,
        color: isConnected ? t.text : t.muted,
        userSelect: 'none',
      }}
    >
      {/* Status dot */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
