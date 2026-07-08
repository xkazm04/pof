import { ArrowLeftRight } from 'lucide-react';
import { ACCENT_EMERALD } from '@/lib/chart-colors';

export function OfflineState({ autoSync }: { autoSync: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-text-muted">
      <ArrowLeftRight className="w-8 h-8 opacity-30 mb-3" />
      <p className="text-xs font-medium mb-1">Not connected to UE5</p>
      <p className="text-2xs opacity-60">
        Connect the WebSocket to push state changes bidirectionally
      </p>
      {autoSync && (
        <p className="text-2xs mt-2" style={{ color: ACCENT_EMERALD }}>
          Auto-sync is enabled — will connect when HTTP bridge connects
        </p>
      )}
    </div>
  );
}
