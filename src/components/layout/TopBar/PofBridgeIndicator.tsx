'use client';

import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { BridgeStatusIndicator } from '@/components/ui/BridgeStatusIndicator';

// --- PoF Bridge connection indicator ---
// Thin wrapper around the shared BridgeStatusIndicator so the topbar pill
// stays in lockstep with the lab strip and the project-setup panels.

export function PofBridgeIndicator() {
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);
  const pluginInfo = usePofBridgeStore((s) => s.pluginInfo);

  if (connectionStatus === 'disconnected') return null;

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';
  const label = isConnected
    ? `Bridge v${pluginInfo?.pluginVersion ?? '?'}`
    : isConnecting
      ? 'Bridge…'
      : 'Bridge err';

  const title = pluginInfo
    ? `${pluginInfo.projectName} · UE ${pluginInfo.engineVersion} · ${pluginInfo.manifestAssetCount} assets`
    : 'PoF Bridge';

  return (
    <BridgeStatusIndicator
      status={connectionStatus}
      variant="topbar"
      label={label}
      title={title}
    />
  );
}
