'use client';

import {
  Crosshair, Settings2, Table2, AlertTriangle,
} from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_EMERALD, STATUS_ERROR, STATUS_WARNING,
  OVERLAY_WHITE,
  withOpacity, OPACITY_25, OPACITY_8,
} from '@/lib/chart-colors';
import type { DodgeParams } from '../_shared/dodge-types';
import { SectionHeader } from '../../unique-tabs/_design';
import { FOCUS_RING_CLASS, focusRingStyle } from '@/lib/ui/focus-ring';
import type { CLILogEntry } from '@/stores/cliOptimizationStore';

type CliStore = {
  log: CLILogEntry[]; isOptimizing: boolean; sidebarOpen: boolean;
  pendingResult: DodgeParams | null;
  addLogEntry: (entry: Omit<CLILogEntry, 'id' | 'timestamp'>) => void;
  startOptimization: () => void; finishOptimization: (result?: DodgeParams) => void;
  toggleSidebar: () => void; applyPendingResult: () => DodgeParams | null;
};

export function HeaderToolbar({ cliStore, params, showFrameData, setShowFrameData, showParams, setShowParams, showHitEditor, setShowHitEditor }: {
  cliStore: CliStore;
  params: DodgeParams;
  showFrameData: boolean; setShowFrameData: (v: boolean) => void;
  showParams: boolean; setShowParams: (v: boolean) => void;
  showHitEditor: boolean; setShowHitEditor: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <SectionHeader icon={Crosshair} label="Interactive Dodge Timeline" color={ACCENT_CYAN} />
      <div className="ml-auto flex items-center gap-1">
        <OptimizeButton cliStore={cliStore} params={params} />
        <ToggleBtn active={showFrameData} onToggle={() => setShowFrameData(!showFrameData)} color={STATUS_WARNING} icon={Table2} title="Toggle frame data table" />
        <ToggleBtn active={showParams} onToggle={() => setShowParams(!showParams)} color={ACCENT_CYAN} icon={Settings2} title="Toggle parameter editor" />
        <ToggleBtn active={showHitEditor} onToggle={() => setShowHitEditor(!showHitEditor)} color={STATUS_ERROR} icon={AlertTriangle} title="Toggle hit marker editor" />
      </div>
    </div>
  );
}

function ToggleBtn({ active, onToggle, color, icon: Icon, title }: {
  active: boolean; onToggle: () => void; color: string;
  icon: React.ComponentType<{ className?: string }>; title: string;
}) {
  return (
    <button onClick={onToggle} className={`p-1.5 rounded-lg border transition-colors ${FOCUS_RING_CLASS}`} title={title}
      style={{ borderColor: active ? `${withOpacity(color, OPACITY_25)}` : withOpacity(OVERLAY_WHITE, OPACITY_8), backgroundColor: active ? `${withOpacity(color, OPACITY_8)}` : 'transparent', color: active ? color : 'var(--text-muted)', ...focusRingStyle(color) }}>
      <Icon className="w-3 h-3" />
    </button>
  );
}

function OptimizeButton({ cliStore, params }: { cliStore: CliStore; params: DodgeParams }) {
  return (
    <button
      onClick={() => {
        cliStore.startOptimization();
        cliStore.addLogEntry({ type: 'info', message: 'Starting dodge parameter optimization...', detail: `Current params: distance=${params.dodgeDistance}, duration=${params.dodgeDuration}, iFrameStart=${params.iFrameStart}` });
        setTimeout(() => { cliStore.addLogEntry({ type: 'change', message: 'Analyzing i-frame window coverage...' }); }, 800);
        setTimeout(() => {
          cliStore.addLogEntry({ type: 'result', message: 'Optimization complete -- suggested adjustments ready', detail: 'Increased i-frame window by 15%, reduced cooldown by 10%' });
          cliStore.finishOptimization({ ...params, iFrameDuration: Math.min(params.iFrameDuration * 1.15, params.dodgeDuration * 0.8), cooldown: params.cooldown * 0.9 });
        }, 2000);
      }}
      disabled={cliStore.isOptimizing}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING_CLASS}`}
      style={{ borderColor: `${withOpacity(ACCENT_EMERALD, OPACITY_25)}`, backgroundColor: `${withOpacity(ACCENT_EMERALD, OPACITY_8)}`, color: ACCENT_EMERALD, ...focusRingStyle(ACCENT_EMERALD) }}
    >
      {cliStore.isOptimizing ? 'Optimizing...' : 'Simulate & Optimize'}
    </button>
  );
}

export type { CliStore };
