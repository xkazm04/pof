'use client';

import { Swords, MousePointerClick, Target, Users, Box } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { WorldScanResult } from '@/types/quest-generation';
import { STATUS_ERROR, STATUS_INFO, STATUS_SUCCESS, ACCENT_PURPLE } from '@/lib/chart-colors';
import { ACCENT } from './constants';

// ── World scan summary ──

export function WorldScanSummary({ scan, levelDocName }: { scan: WorldScanResult; levelDocName: string | null }) {
  return (
    <SurfaceCard level={2} className="px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Target className="w-3 h-3 text-text-muted" />
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">World Scan</span>
        {levelDocName && (
          <span className="text-2xs font-mono ml-auto" style={{ color: ACCENT }}>{levelDocName}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Swords className="w-3 h-3" style={{ color: STATUS_ERROR }} />
          <span className="text-text">{scan.enemyClasses.length}</span>
          <span className="text-text-muted">enemies</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3" style={{ color: STATUS_INFO }} />
          <span className="text-text">{scan.npcClasses.length}</span>
          <span className="text-text-muted">NPCs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MousePointerClick className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
          <span className="text-text">{scan.interactableClasses.length}</span>
          <span className="text-text-muted">interactables</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Box className="w-3 h-3" style={{ color: ACCENT_PURPLE }} />
          <span className="text-text">{scan.itemClasses.length}</span>
          <span className="text-text-muted">items</span>
        </div>
      </div>
    </SurfaceCard>
  );
}
