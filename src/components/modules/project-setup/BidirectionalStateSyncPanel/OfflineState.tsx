import { ArrowLeftRight } from 'lucide-react';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { UE5ConnectionStatus } from '@/types/ue5-bridge';
import { statusCopy } from '../LiveStateSyncPanel/statusCopy';

export function OfflineState({ autoSync, wsStatus, wsPort }: { autoSync: boolean; wsStatus: UE5ConnectionStatus; wsPort: number }) {
  const copy = statusCopy(wsStatus, wsPort);
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-8 text-text-muted">
      <ArrowLeftRight className="w-8 h-8 opacity-30 mb-3" />
      <p className="text-xs font-medium mb-1">{copy.title}</p>
      <p className="text-2xs opacity-60">{copy.detail}</p>
      {autoSync && (
        <p className="text-2xs mt-2" style={{ color: ACCENT_EMERALD }}>
          Auto-sync is enabled — will connect when HTTP bridge connects
        </p>
      )}
    </div>
  );
}
