'use client';

import { useEffect, useCallback } from 'react';
import { LayoutGrid, Activity, Plug } from 'lucide-react';
import { useEcwStore, type EcwL1Tab } from '@/stores/ecwStore';

interface Action {
  id: string;
  label: string;
  Icon: typeof LayoutGrid;
  run: () => void;
}

/**
 * Cross-cutting ⌘K command palette for the ECW shell. Phase 1 ships the basic
 * shell: opens on ⌘K (or Ctrl+K), shows three "Jump to L1 tab" rows, Esc
 * closes. Entity search lands in Phase 3 (catalog-aware), NL intent dispatch
 * lands in Phase 4 (CLI rail integration).
 */
export function EcwCommandPalette() {
  const isOpen = useEcwStore((s) => s.isPaletteOpen);
  const setOpen = useEcwStore((s) => s.setPaletteOpen);
  const setTab = useEcwStore((s) => s.setActiveL1Tab);

  const jumpTo = useCallback(
    (tab: EcwL1Tab) => {
      setTab(tab);
      setOpen(false);
    },
    [setTab, setOpen],
  );

  // Global ⌘K / Ctrl+K toggle + Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useEcwStore.getState().isPaletteOpen);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  if (!isOpen) return null;

  const actions: Action[] = [
    { id: 'jump-catalogs', label: 'Jump to Catalogs', Icon: LayoutGrid, run: () => jumpTo('catalogs') },
    { id: 'jump-mc', label: 'Jump to Mission Control', Icon: Activity, run: () => jumpTo('mission-control') },
    { id: 'jump-live', label: 'Jump to Live State', Icon: Plug, run: () => jumpTo('live-state') },
  ];

  return (
    <div
      role="dialog"
      aria-label="command palette"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-4 rounded-lg border border-border bg-surface-deep shadow-2xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-border/40">
          <input
            autoFocus
            type="text"
            placeholder="Jump to... (entity search lands in Phase 3)"
            className="w-full bg-transparent text-text placeholder:text-text-muted text-sm outline-none"
          />
        </div>
        <div className="py-2">
          <div className="px-4 py-1 text-2xs font-mono uppercase tracking-wider text-text-muted">Jump</div>
          {actions.map((a) => (
            <button
              key={a.id}
              onClick={a.run}
              className="focus-ring w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-text hover:bg-surface/50"
            >
              <a.Icon className="w-4 h-4 text-text-muted" />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
