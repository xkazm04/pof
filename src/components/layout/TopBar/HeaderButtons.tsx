'use client';

import { useCallback } from 'react';
import { Search, LayoutDashboard, FlaskConical, Boxes } from 'lucide-react';
import { writeShellPref } from '@/lib/ecw/shell-pref';

// --- New (Blueprint) shell switch ---
// Mirror of the lab's "Legacy shell" button: clears the legacy preference and the
// `?legacy=1` param, then fires popstate so page.tsx's shell gate swaps live.

export function NewShellButton() {
  const handleClick = useCallback(() => {
    writeShellPref('ecw');
    const url = new URL(window.location.href);
    url.searchParams.delete('legacy');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text bg-background border border-border hover:border-border-bright transition-colors focus-ring"
      title="Switch to the new Blueprint shell"
    >
      <LayoutDashboard className="w-3 h-3" aria-hidden="true" />
      <span className="hidden sm:inline">Blueprint</span>
    </button>
  );
}

// --- UE Experiment Lab link (run a concept on UE 5.8, see the output) ---

export function ExperimentLabLink() {
  return (
    <a
      href="/experiment"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text bg-background border border-border hover:border-border-bright transition-colors focus-ring"
      title="UE Experiment Lab — run a concept on UE 5.8 and see the output"
    >
      <FlaskConical className="w-3 h-3" aria-hidden="true" />
      <span className="hidden sm:inline">Experiment</span>
    </a>
  );
}

// --- 3D Studio link (preview generated assets before Unreal) ---

export function Studio3DLink() {
  return (
    <a
      href="/3d"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text bg-background border border-border hover:border-border-bright transition-colors focus-ring"
      title="3D Studio — preview generated assets"
    >
      <Boxes className="w-3 h-3" aria-hidden="true" />
      <span className="hidden sm:inline">3D Studio</span>
    </a>
  );
}

// --- Search trigger ---

export function SearchTrigger() {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  }, []);

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text bg-background border border-border hover:border-border-bright transition-colors focus-ring"
      title="Search (Ctrl+K)"
    >
      <Search className="w-3 h-3" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline-flex items-center px-1 py-px text-2xs bg-surface border border-border rounded font-mono">
        ⌘K
      </kbd>
    </button>
  );
}
