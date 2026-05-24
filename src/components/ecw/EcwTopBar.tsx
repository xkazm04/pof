'use client';

import { Gamepad2, Search, Settings } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';
import { EcwL1Tabs } from './EcwL1Tabs';

/**
 * Slimmer top bar for the ECW shell: brand · 3 L1 tabs · ⌘K palette button ·
 * bridge dot · settings cog. Replaces the legacy ~685-LOC TopBar with a focused
 * navigation strip; status detail moves to Live State (Phase 6).
 */
export function EcwTopBar() {
  const setPaletteOpen = useEcwStore((s) => s.setPaletteOpen);

  return (
    <header className="h-12 flex items-center gap-4 px-4 border-b border-border bg-surface-deep shrink-0">
      <div className="flex items-center gap-2 shrink-0">
        <Gamepad2 className="w-5 h-5 text-[#00ff88]" />
        <span className="text-sm font-bold tracking-wide text-text">PoF</span>
      </div>

      <EcwL1Tabs />

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setPaletteOpen(true)}
          className="focus-ring flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-text hover:bg-surface/50 transition-colors"
          aria-label="Open command palette"
        >
          <Search className="w-4 h-4" />
          <kbd className="text-2xs font-mono px-1.5 py-0.5 rounded border border-border bg-surface">⌘K</kbd>
        </button>

        <span
          className="w-2 h-2 rounded-full bg-emerald-500"
          aria-label="bridge connected"
          title="bridge connected"
        />

        <button
          className="focus-ring p-1.5 rounded text-text-muted hover:text-text hover:bg-surface/50"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
