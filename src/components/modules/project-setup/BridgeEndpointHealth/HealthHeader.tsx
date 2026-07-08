import { Network, RefreshCw, Loader2, Settings } from 'lucide-react';
import { ConnectionStatusBadge, type ConnectionStatus } from '@/components/ui/ConnectionStatusBadge';
import {
  STATUS_SUCCESS, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_10,
} from '@/lib/chart-colors';

interface HealthHeaderProps {
  connectionStatus: string;
  pofPort: number;
  rcPort: number;
  checkedCount: number;
  healthyCount: number;
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  pingAll: () => void;
  pinging: boolean;
  isDisconnected: boolean;
}

export function HealthHeader({
  connectionStatus, pofPort, rcPort, checkedCount, healthyCount,
  showSettings, setShowSettings, pingAll, pinging, isDisconnected,
}: HealthHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
      <div
        className="p-1.5 rounded-lg"
        style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}
      >
        <Network className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text">Bridge Endpoints</h3>
          <ConnectionStatusBadge status={connectionStatus as ConnectionStatus} />
        </div>
        <p className="text-2xs text-text-muted" aria-live="polite">
          <span className="font-mono" style={{ color: ACCENT_EMERALD }}>:{pofPort}</span>
          <span className="mx-1">/pof</span>
          &middot;
          <span className="font-mono ml-1" style={{ color: ACCENT_CYAN }}>:{rcPort}</span>
          <span className="mx-1">/remote</span>
          {checkedCount > 0 && (
            <span className="ml-1">
              &middot; <span style={{ color: healthyCount === checkedCount ? STATUS_SUCCESS : STATUS_WARNING }}>{healthyCount}/{checkedCount} healthy</span>
            </span>
          )}
        </p>
      </div>
      <button
        onClick={() => setShowSettings((s) => !s)}
        className={`p-1.5 rounded-md text-xs transition-colors border border-border/40 ${showSettings ? 'bg-white/5' : 'hover:bg-white/5'}`}
        style={{ color: ACCENT_CYAN }}
        title="Connection settings"
        data-testid="bridge-settings-toggle-btn"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={pingAll}
        disabled={pinging || isDisconnected}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                   border border-border/40 transition-colors
                   enabled:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: ACCENT_CYAN }}
        data-testid="bridge-ping-all-btn"
      >
        {pinging ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        {pinging ? 'Pinging...' : 'Ping All'}
      </button>
    </div>
  );
}
