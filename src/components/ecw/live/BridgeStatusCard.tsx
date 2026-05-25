'use client';

import { Plug } from 'lucide-react';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

const COLOR_BY_STATUS: Record<string, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500 animate-pulse',
  reconnecting: 'bg-amber-500 animate-pulse',
  error: 'bg-red-500',
  disconnected: 'bg-text-muted/50',
};

/**
 * Live State header card: bridge connection status + plugin info (version,
 * engine, project, asset count, last sync). Reads `usePofBridgeStore` —
 * the existing bridge store already hosts the connection lifecycle and
 * cached `PofBridgeStatus`. Shell-level connection dot stays in TopBar;
 * this card is the detail.
 */
export function BridgeStatusCard() {
  const status = usePofBridgeStore((s) => s.connectionStatus);
  const info = usePofBridgeStore((s) => s.pluginInfo);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Plug className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Bridge</h2>
        <span
          className={`ml-auto w-2 h-2 rounded-full ${COLOR_BY_STATUS[status] ?? 'bg-text-muted/50'}`}
          aria-label={status}
          title={status}
        />
        <span className="text-xs text-text-muted capitalize">{status}</span>
      </header>

      {info ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-2xs font-mono">
          <dt className="text-text-muted">Plugin</dt>
          <dd className="text-text truncate">v{info.pluginVersion}</dd>
          <dt className="text-text-muted">Engine</dt>
          <dd className="text-text truncate">UE {info.engineVersion}</dd>
          <dt className="text-text-muted">Project</dt>
          <dd className="text-text truncate">{info.projectName}</dd>
          <dt className="text-text-muted">Editor</dt>
          <dd className="text-text capitalize">{info.editorState}{info.pieRunning ? ' · PIE' : ''}</dd>
          <dt className="text-text-muted">Manifest</dt>
          <dd className="text-text">{info.manifestAssetCount.toLocaleString()} assets</dd>
          <dt className="text-text-muted">Synced</dt>
          <dd className="text-text">{new Date(info.manifestLastUpdated).toLocaleTimeString()}</dd>
        </dl>
      ) : (
        <p className="text-xs text-text-muted/70 italic">
          {status === 'disconnected' ? 'Not connected to the PoF Bridge plugin.' : 'Awaiting plugin info…'}
        </p>
      )}
    </section>
  );
}
