'use client';

import { LayoutGrid, Activity, Plug } from 'lucide-react';
import { useEcwStore, type EcwL1Tab } from '@/stores/ecwStore';

const TABS: Array<{ id: EcwL1Tab; label: string; Icon: typeof LayoutGrid }> = [
  { id: 'catalogs', label: 'Catalogs', Icon: LayoutGrid },
  { id: 'mission-control', label: 'Mission Control', Icon: Activity },
  { id: 'live-state', label: 'Live State', Icon: Plug },
];

/**
 * The 3-tab L1 nav strip rendered inside EcwTopBar. Replaces the legacy
 * 7-category SidebarL1 + 37-module SidebarL2 with a single intent-aligned
 * top-level switch.
 */
export function EcwL1Tabs() {
  const active = useEcwStore((s) => s.activeL1Tab);
  const setActive = useEcwStore((s) => s.setActiveL1Tab);

  return (
    <div role="tablist" aria-label="Workspace" className="flex items-center gap-1">
      {TABS.map(({ id, label, Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={selected}
            onClick={() => setActive(id)}
            className={`focus-ring flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              selected
                ? 'bg-surface text-text'
                : 'text-text-muted hover:text-text hover:bg-surface/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
