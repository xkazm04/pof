# Phase 1 · L1 Shell Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the new 3-tab L1 shell (`Catalogs · Mission Control · Live State`) + a CLI Rail container + an upgraded ⌘K palette, all behind a `?ecw=1` URL flag so the new and old shells coexist. After Phase 1, opening `/?ecw=1` boots the new chrome with empty placeholder tab bodies; opening `/` boots the existing app unchanged.

**Architecture:** Additive parallel shell. We do NOT modify `AppShell.tsx`. We add a `NewAppShell.tsx` and a feature-flag gate in `page.tsx`. New shell uses a new `useEcwStore` (separate from `navigationStore` to avoid persisted-state collisions; we'll consolidate in Phase 12). Each L1 tab is a placeholder `div` for now; their content is built in Phases 3 / 5 / 6. The CLI Rail is just chrome (slot for sessions list); two-way binding lands in Phase 4.

**Tech Stack:** Next.js 16, React 19, Zustand v5, Tailwind v4, Framer Motion, lucide-react. Reuses existing `chart-colors`, `focus-ring`, design tokens.

---

## File Structure

### Create

- `src/stores/ecwStore.ts` — new Zustand store for ECW shell state (`activeL1Tab`, `activeCatalogId`, `activeEntityId`, `cliRailMode`, `isPaletteOpen`).
- `src/components/ecw/NewAppShell.tsx` — top-level shell component (replaces AppShell when `?ecw=1`).
- `src/components/ecw/EcwTopBar.tsx` — slimmer top bar: brand · L1 tabs · ⌘K · bridge dot · cog.
- `src/components/ecw/EcwL1Tabs.tsx` — the 3-tab nav strip rendered inside EcwTopBar.
- `src/components/ecw/CliRail.tsx` — collapsible right rail container.
- `src/components/ecw/tabs/CatalogsTabPlaceholder.tsx` — placeholder content for Phases 2+3.
- `src/components/ecw/tabs/MissionControlTabPlaceholder.tsx` — placeholder for Phase 5.
- `src/components/ecw/tabs/LiveStateTabPlaceholder.tsx` — placeholder for Phase 6.
- `src/components/ecw/EcwCommandPalette.tsx` — upgraded ⌘K palette (replaces the legacy GlobalSearchPanel in the ECW shell only; legacy stays untouched).
- `src/__tests__/stores/ecwStore.test.ts` — store unit tests.
- `src/__tests__/components/ecw/NewAppShell.test.tsx` — shell renders 3 tabs + rail.
- `src/__tests__/components/ecw/EcwCommandPalette.test.tsx` — palette opens via ⌘K and shows actionable rows.

### Modify

- `src/app/page.tsx` — read `?ecw=1` URL param; render `NewAppShell` if set, else fall through to current `AppShell`. (Tiny edit.)
- `src/hooks/useKeyboardShortcuts.ts` — keep existing shortcuts working but no-op the Ctrl+1-5 category shortcuts when ECW shell is active (those map to gone categories).

### Do NOT touch

- `src/components/layout/AppShell.tsx`, `SidebarL1.tsx`, `SidebarL2.tsx`, `ModuleRenderer.tsx`, `TopBar.tsx`, `GlobalSearchPanel.tsx`, `Sidebar.tsx` — legacy shell remains the default.
- `src/stores/navigationStore.ts` — legacy nav store untouched.
- `src/lib/catalog/**`, `src/stores/catalogStore.ts`, `src/hooks/useGeneration.ts` — catalog substrate untouched.

---

## Task 1: `ecwStore` — minimal store + tests

**Files:**
- Create: `src/stores/ecwStore.ts`
- Test: `src/__tests__/stores/ecwStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/stores/ecwStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useEcwStore } from '@/stores/ecwStore';

describe('ecwStore', () => {
  beforeEach(() => {
    useEcwStore.setState({
      activeL1Tab: 'catalogs',
      activeCatalogId: null,
      activeEntityId: null,
      cliRailMode: 'auto',
      isPaletteOpen: false,
    });
  });

  it('defaults to catalogs tab', () => {
    expect(useEcwStore.getState().activeL1Tab).toBe('catalogs');
  });

  it('setActiveL1Tab changes the tab', () => {
    useEcwStore.getState().setActiveL1Tab('mission-control');
    expect(useEcwStore.getState().activeL1Tab).toBe('mission-control');
  });

  it('selectEntity sets catalog + entity together', () => {
    useEcwStore.getState().selectEntity('spellbook', 'ga-fireball');
    expect(useEcwStore.getState().activeCatalogId).toBe('spellbook');
    expect(useEcwStore.getState().activeEntityId).toBe('ga-fireball');
  });

  it('selectEntity(null,null) clears selection', () => {
    useEcwStore.getState().selectEntity('spellbook', 'ga-fireball');
    useEcwStore.getState().selectEntity(null, null);
    expect(useEcwStore.getState().activeCatalogId).toBeNull();
    expect(useEcwStore.getState().activeEntityId).toBeNull();
  });

  it('toggleCliRail cycles auto → wide → collapsed → auto', () => {
    expect(useEcwStore.getState().cliRailMode).toBe('auto');
    useEcwStore.getState().toggleCliRail();
    expect(useEcwStore.getState().cliRailMode).toBe('wide');
    useEcwStore.getState().toggleCliRail();
    expect(useEcwStore.getState().cliRailMode).toBe('collapsed');
    useEcwStore.getState().toggleCliRail();
    expect(useEcwStore.getState().cliRailMode).toBe('auto');
  });

  it('palette open/close', () => {
    useEcwStore.getState().setPaletteOpen(true);
    expect(useEcwStore.getState().isPaletteOpen).toBe(true);
    useEcwStore.getState().setPaletteOpen(false);
    expect(useEcwStore.getState().isPaletteOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/ecwStore.test.ts`
Expected: FAIL — module `@/stores/ecwStore` not found.

- [ ] **Step 3: Implement the store**

```ts
// src/stores/ecwStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type EcwL1Tab = 'catalogs' | 'mission-control' | 'live-state';
export type CliRailMode = 'auto' | 'wide' | 'collapsed';

interface EcwState {
  activeL1Tab: EcwL1Tab;
  activeCatalogId: string | null;
  activeEntityId: string | null;
  cliRailMode: CliRailMode;
  isPaletteOpen: boolean;

  setActiveL1Tab: (tab: EcwL1Tab) => void;
  selectEntity: (catalogId: string | null, entityId: string | null) => void;
  toggleCliRail: () => void;
  setPaletteOpen: (open: boolean) => void;
}

const RAIL_CYCLE: Record<CliRailMode, CliRailMode> = {
  auto: 'wide',
  wide: 'collapsed',
  collapsed: 'auto',
};

export const useEcwStore = create<EcwState>()(
  persist(
    (set) => ({
      activeL1Tab: 'catalogs',
      activeCatalogId: null,
      activeEntityId: null,
      cliRailMode: 'auto',
      isPaletteOpen: false,

      setActiveL1Tab: (tab) => set({ activeL1Tab: tab }),
      selectEntity: (catalogId, entityId) => set({ activeCatalogId: catalogId, activeEntityId: entityId }),
      toggleCliRail: () => set((s) => ({ cliRailMode: RAIL_CYCLE[s.cliRailMode] })),
      setPaletteOpen: (open) => set({ isPaletteOpen: open }),
    }),
    {
      name: 'ecw-store',
      storage: createJSONStorage(() => localStorage),
      // Transient: never persist palette state across reloads
      partialize: (s) => ({
        activeL1Tab: s.activeL1Tab,
        activeCatalogId: s.activeCatalogId,
        activeEntityId: s.activeEntityId,
        cliRailMode: s.cliRailMode,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/stores/ecwStore.test.ts`
Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/stores/ecwStore.ts src/__tests__/stores/ecwStore.test.ts
git commit -m "feat(ecw): ecwStore with L1 tab + entity selection + CLI rail mode (ECW Phase 1.1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Placeholder tab components

**Files:**
- Create: `src/components/ecw/tabs/CatalogsTabPlaceholder.tsx`
- Create: `src/components/ecw/tabs/MissionControlTabPlaceholder.tsx`
- Create: `src/components/ecw/tabs/LiveStateTabPlaceholder.tsx`

Each is a tiny placeholder that renders the tab name + "coming in Phase N" + a list of which backlog ideas land in that phase. No test — they're trivial; they'll be replaced wholesale in later phases.

- [ ] **Step 1: Create the three placeholders**

```tsx
// src/components/ecw/tabs/CatalogsTabPlaceholder.tsx
'use client';

export function CatalogsTabPlaceholder() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-text mb-2">Catalogs</h1>
      <p className="text-text-muted">The entity-centric creative surface lands in Phases 2 + 3.</p>
      <ul className="mt-4 text-sm text-text-muted/80 list-disc list-inside space-y-1">
        <li>Phase 2 — Entity Inspector primitive</li>
        <li>Phase 3 — Catalog Hub + per-catalog detail</li>
        <li>Phase 7-8 — module migration into catalog facets</li>
        <li>Phase 10 — per-catalog KEEP-ENHANCE ideas (~67)</li>
      </ul>
    </div>
  );
}
```

```tsx
// src/components/ecw/tabs/MissionControlTabPlaceholder.tsx
'use client';

export function MissionControlTabPlaceholder() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-text mb-2">Mission Control</h1>
      <p className="text-text-muted">The project-wide overview surface lands in Phase 5.</p>
      <ul className="mt-4 text-sm text-text-muted/80 list-disc list-inside space-y-1">
        <li>Catalog lifecycle progress (8-catalog roll-up)</li>
        <li>Critical Path DAG + NBA queue</li>
        <li>Forecast (playable-by ETA, velocity, confidence)</li>
        <li>Activity feed + cook log + cost dashboard</li>
        <li>Absorbs the current 26-tab Evaluator god-tab</li>
      </ul>
    </div>
  );
}
```

```tsx
// src/components/ecw/tabs/LiveStateTabPlaceholder.tsx
'use client';

export function LiveStateTabPlaceholder() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-text mb-2">Live State</h1>
      <p className="text-text-muted">The always-on UE-side surface lands in Phase 6.</p>
      <ul className="mt-4 text-sm text-text-muted/80 list-disc list-inside space-y-1">
        <li>Bridge status + asset manifest diff (defined-here vs in-UE)</li>
        <li>Last build verdict + last functional test per catalog</li>
        <li>Live UObject inspector</li>
        <li>Crash Watchtower + 3D Zone Twin</li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ecw/tabs/
git commit -m "feat(ecw): placeholder tab bodies for catalogs/mission-control/live-state (ECW Phase 1.2)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `CliRail` — collapsible right rail (chrome only)

**Files:**
- Create: `src/components/ecw/CliRail.tsx`
- Test: `src/__tests__/components/ecw/CliRail.test.tsx`

Just the chrome — header, collapse toggle, empty body. The session list + dispatch + two-way binding land in Phase 4.

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/ecw/CliRail.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CliRail } from '@/components/ecw/CliRail';
import { useEcwStore } from '@/stores/ecwStore';

describe('CliRail', () => {
  beforeEach(() => {
    useEcwStore.setState({ cliRailMode: 'auto', activeCatalogId: null, activeEntityId: null });
  });
  afterEach(cleanup);

  it('renders the rail header "CLI"', () => {
    render(<CliRail />);
    expect(screen.getByText(/CLI/)).toBeTruthy();
  });

  it('shows "Project" scope when no entity is selected', () => {
    render(<CliRail />);
    expect(screen.getByText(/Project/)).toBeTruthy();
  });

  it('shows entity scope when entity is selected', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'ga-fireball' });
    render(<CliRail />);
    expect(screen.getByText(/spellbook/)).toBeTruthy();
    expect(screen.getByText(/ga-fireball/)).toBeTruthy();
  });

  it('toggle button cycles rail mode', () => {
    render(<CliRail />);
    const btn = screen.getByRole('button', { name: /toggle CLI rail/i });
    expect(useEcwStore.getState().cliRailMode).toBe('auto');
    fireEvent.click(btn);
    expect(useEcwStore.getState().cliRailMode).toBe('wide');
    fireEvent.click(btn);
    expect(useEcwStore.getState().cliRailMode).toBe('collapsed');
  });

  it('collapsed mode hides the body', () => {
    useEcwStore.setState({ cliRailMode: 'collapsed' });
    render(<CliRail />);
    expect(screen.queryByTestId('cli-rail-body')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/CliRail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the rail**

```tsx
// src/components/ecw/CliRail.tsx
'use client';

import { Terminal, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';

const WIDTH_BY_MODE: Record<string, string> = {
  auto: 'w-[360px]',
  wide: 'w-1/2',
  collapsed: 'w-[44px]',
};

export function CliRail() {
  const mode = useEcwStore((s) => s.cliRailMode);
  const toggle = useEcwStore((s) => s.toggleCliRail);
  const catalogId = useEcwStore((s) => s.activeCatalogId);
  const entityId = useEcwStore((s) => s.activeEntityId);
  const scope = catalogId && entityId
    ? `${catalogId} ▸ ${entityId}`
    : 'Project';

  const collapsed = mode === 'collapsed';

  return (
    <aside
      className={`${WIDTH_BY_MODE[mode]} flex flex-col border-l border-border bg-surface-deep transition-[width] duration-200 overflow-hidden`}
      data-testid="cli-rail"
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border/40 shrink-0">
        <Terminal className="w-4 h-4 text-text-muted shrink-0" />
        {!collapsed && (
          <>
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">CLI</span>
            <span className="text-2xs font-mono text-text-muted/70 truncate">· {scope}</span>
          </>
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 text-text-muted hover:text-text focus-ring rounded"
          aria-label="toggle CLI rail"
        >
          {collapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
        </button>
      </header>
      {!collapsed && (
        <div data-testid="cli-rail-body" className="flex-1 overflow-auto p-3">
          <p className="text-xs text-text-muted/70">
            CLI sessions land in Phase 4. Two-way binding + run history + per-task diff review.
          </p>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/CliRail.test.tsx`
Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ecw/CliRail.tsx src/__tests__/components/ecw/CliRail.test.tsx
git commit -m "feat(ecw): CliRail container chrome with collapse cycle (ECW Phase 1.3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `EcwL1Tabs` + `EcwTopBar`

**Files:**
- Create: `src/components/ecw/EcwL1Tabs.tsx`
- Create: `src/components/ecw/EcwTopBar.tsx`
- Test: `src/__tests__/components/ecw/EcwL1Tabs.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/ecw/EcwL1Tabs.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EcwL1Tabs } from '@/components/ecw/EcwL1Tabs';
import { useEcwStore } from '@/stores/ecwStore';

describe('EcwL1Tabs', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeL1Tab: 'catalogs' });
  });
  afterEach(cleanup);

  it('renders the 3 tabs', () => {
    render(<EcwL1Tabs />);
    expect(screen.getByRole('tab', { name: /Catalogs/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Mission Control/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Live State/ })).toBeTruthy();
  });

  it('catalogs tab is selected by default', () => {
    render(<EcwL1Tabs />);
    expect(screen.getByRole('tab', { name: /Catalogs/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('clicking a tab updates the store', () => {
    render(<EcwL1Tabs />);
    fireEvent.click(screen.getByRole('tab', { name: /Mission Control/ }));
    expect(useEcwStore.getState().activeL1Tab).toBe('mission-control');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/EcwL1Tabs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the L1 tabs strip**

```tsx
// src/components/ecw/EcwL1Tabs.tsx
'use client';

import { LayoutGrid, Activity, Plug } from 'lucide-react';
import { useEcwStore, type EcwL1Tab } from '@/stores/ecwStore';

const TABS: Array<{ id: EcwL1Tab; label: string; Icon: typeof LayoutGrid }> = [
  { id: 'catalogs', label: 'Catalogs', Icon: LayoutGrid },
  { id: 'mission-control', label: 'Mission Control', Icon: Activity },
  { id: 'live-state', label: 'Live State', Icon: Plug },
];

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
```

- [ ] **Step 4: Implement the slimmer top bar**

```tsx
// src/components/ecw/EcwTopBar.tsx
'use client';

import { Gamepad2, Search, Settings } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';
import { EcwL1Tabs } from './EcwL1Tabs';

export function EcwTopBar() {
  const openPalette = useEcwStore((s) => () => s.setPaletteOpen(true));

  return (
    <header className="h-12 flex items-center gap-4 px-4 border-b border-border bg-surface-deep shrink-0">
      <div className="flex items-center gap-2 shrink-0">
        <Gamepad2 className="w-5 h-5 text-[#00ff88]" />
        <span className="text-sm font-bold tracking-wide text-text">PoF</span>
      </div>

      <EcwL1Tabs />

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={openPalette}
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/EcwL1Tabs.test.tsx`
Expected: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/ecw/EcwL1Tabs.tsx src/components/ecw/EcwTopBar.tsx src/__tests__/components/ecw/EcwL1Tabs.test.tsx
git commit -m "feat(ecw): EcwTopBar with brand + 3 L1 tabs + palette button + bridge dot (ECW Phase 1.4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `EcwCommandPalette` — basic ⌘K palette

**Files:**
- Create: `src/components/ecw/EcwCommandPalette.tsx`
- Test: `src/__tests__/components/ecw/EcwCommandPalette.test.tsx`

Basic palette: opens on ⌘K (or Ctrl+K on Windows), shows 3 sections (Jump to L1 tab · Recent · Actions). Empty state for now — entity-search lands in Phase 3, NL intent in later phases.

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/ecw/EcwCommandPalette.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EcwCommandPalette } from '@/components/ecw/EcwCommandPalette';
import { useEcwStore } from '@/stores/ecwStore';

describe('EcwCommandPalette', () => {
  beforeEach(() => {
    useEcwStore.setState({ isPaletteOpen: false, activeL1Tab: 'catalogs' });
  });
  afterEach(cleanup);

  it('is hidden when isPaletteOpen=false', () => {
    render(<EcwCommandPalette />);
    expect(screen.queryByRole('dialog', { name: /command palette/i })).toBeNull();
  });

  it('shows the 3 L1 tabs as "jump to" rows when open', () => {
    useEcwStore.setState({ isPaletteOpen: true });
    render(<EcwCommandPalette />);
    expect(screen.getByText(/Jump to Catalogs/i)).toBeTruthy();
    expect(screen.getByText(/Jump to Mission Control/i)).toBeTruthy();
    expect(screen.getByText(/Jump to Live State/i)).toBeTruthy();
  });

  it('clicking a jump row sets the L1 tab and closes the palette', () => {
    useEcwStore.setState({ isPaletteOpen: true });
    render(<EcwCommandPalette />);
    fireEvent.click(screen.getByText(/Jump to Mission Control/i));
    expect(useEcwStore.getState().activeL1Tab).toBe('mission-control');
    expect(useEcwStore.getState().isPaletteOpen).toBe(false);
  });

  it('Escape closes the palette', () => {
    useEcwStore.setState({ isPaletteOpen: true });
    render(<EcwCommandPalette />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useEcwStore.getState().isPaletteOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/EcwCommandPalette.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the palette**

```tsx
// src/components/ecw/EcwCommandPalette.tsx
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

export function EcwCommandPalette() {
  const isOpen = useEcwStore((s) => s.isPaletteOpen);
  const setOpen = useEcwStore((s) => s.setPaletteOpen);
  const setTab = useEcwStore((s) => s.setActiveL1Tab);

  const jumpTo = useCallback((tab: EcwL1Tab) => {
    setTab(tab);
    setOpen(false);
  }, [setTab, setOpen]);

  // Global ⌘K / Ctrl+K listener + Escape to close
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/EcwCommandPalette.test.tsx`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ecw/EcwCommandPalette.tsx src/__tests__/components/ecw/EcwCommandPalette.test.tsx
git commit -m "feat(ecw): EcwCommandPalette with ⌘K/Esc + 3 jump-to-tab rows (ECW Phase 1.5)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `NewAppShell` — compose the chrome

**Files:**
- Create: `src/components/ecw/NewAppShell.tsx`
- Test: `src/__tests__/components/ecw/NewAppShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/ecw/NewAppShell.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NewAppShell } from '@/components/ecw/NewAppShell';
import { useEcwStore } from '@/stores/ecwStore';

describe('NewAppShell', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeL1Tab: 'catalogs', cliRailMode: 'auto', isPaletteOpen: false });
  });
  afterEach(cleanup);

  it('renders the top bar with brand "PoF"', () => {
    render(<NewAppShell />);
    expect(screen.getByText('PoF')).toBeTruthy();
  });

  it('renders the catalogs placeholder by default', () => {
    render(<NewAppShell />);
    expect(screen.getByRole('heading', { level: 1, name: /Catalogs/ })).toBeTruthy();
  });

  it('switching tab swaps the body', () => {
    render(<NewAppShell />);
    useEcwStore.setState({ activeL1Tab: 'mission-control' });
    expect(screen.getByRole('heading', { level: 1, name: /Mission Control/ })).toBeTruthy();
  });

  it('renders the CLI Rail', () => {
    render(<NewAppShell />);
    expect(screen.getByTestId('cli-rail')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/NewAppShell.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the shell composition**

```tsx
// src/components/ecw/NewAppShell.tsx
'use client';

import { useEcwStore } from '@/stores/ecwStore';
import { EcwTopBar } from './EcwTopBar';
import { CliRail } from './CliRail';
import { EcwCommandPalette } from './EcwCommandPalette';
import { CatalogsTabPlaceholder } from './tabs/CatalogsTabPlaceholder';
import { MissionControlTabPlaceholder } from './tabs/MissionControlTabPlaceholder';
import { LiveStateTabPlaceholder } from './tabs/LiveStateTabPlaceholder';

export function NewAppShell() {
  const tab = useEcwStore((s) => s.activeL1Tab);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <EcwTopBar />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex overflow-hidden">
          {tab === 'catalogs' && <CatalogsTabPlaceholder />}
          {tab === 'mission-control' && <MissionControlTabPlaceholder />}
          {tab === 'live-state' && <LiveStateTabPlaceholder />}
        </main>
        <CliRail />
      </div>
      <EcwCommandPalette />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/NewAppShell.test.tsx`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ecw/NewAppShell.tsx src/__tests__/components/ecw/NewAppShell.test.tsx
git commit -m "feat(ecw): NewAppShell composing top bar + 3 tabs + rail + palette (ECW Phase 1.6)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `?ecw=1` URL flag in `page.tsx`

**Files:**
- Modify: `src/app/page.tsx` (currently 7 LOC; becomes ~20)
- Test: `src/__tests__/app/page.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/app/page.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Home from '@/app/page';

// Stub the legacy AppShell so we can detect which one rendered without booting it.
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: () => <div data-testid="legacy-shell">legacy</div>,
}));
vi.mock('@/components/ecw/NewAppShell', () => ({
  NewAppShell: () => <div data-testid="ecw-shell">ecw</div>,
}));

describe('app/page.tsx ECW flag gate', () => {
  afterEach(cleanup);

  it('renders the legacy shell when no ?ecw flag', () => {
    window.history.replaceState({}, '', '/');
    render(<Home />);
    expect(screen.getByTestId('legacy-shell')).toBeTruthy();
    expect(screen.queryByTestId('ecw-shell')).toBeNull();
  });

  it('renders the ECW shell when ?ecw=1', () => {
    window.history.replaceState({}, '', '/?ecw=1');
    render(<Home />);
    expect(screen.getByTestId('ecw-shell')).toBeTruthy();
    expect(screen.queryByTestId('legacy-shell')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/app/page.test.tsx`
Expected: FAIL — the current `page.tsx` always renders `AppShell` ignoring the flag.

- [ ] **Step 3: Wire the flag**

Replace `src/app/page.tsx` with:

```tsx
'use client';

import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { NewAppShell } from '@/components/ecw/NewAppShell';

function getEcwFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ecw') === '1';
}

export default function Home() {
  // useSyncExternalStore so React 19 doesn't yell about reading window in render
  const useEcw = useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    getEcwFlag,
    () => false,
  );

  return useEcw ? <NewAppShell /> : <AppShell />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/app/page.test.tsx`
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/__tests__/app/page.test.tsx
git commit -m "feat(ecw): ?ecw=1 URL flag gates NewAppShell vs legacy AppShell (ECW Phase 1.7)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Phase 1 verification sweep

- [ ] **Step 1: Run targeted ECW test suite**

```bash
npx vitest run src/__tests__/stores/ecwStore.test.ts \
  src/__tests__/components/ecw \
  src/__tests__/app/page.test.tsx
```

Expected: all green.

- [ ] **Step 2: Run `npx tsc --noEmit`**

Expected: 0 errors in files I touched. Foreign errors from other CLIs' WIP are tolerated.

- [ ] **Step 3: Run lint on my files only**

```bash
npx eslint src/stores/ecwStore.ts src/components/ecw/ src/__tests__/components/ecw/ src/__tests__/stores/ecwStore.test.ts src/__tests__/app/page.test.tsx src/app/page.tsx
```

Expected: 0 errors. Warnings tolerated only if they're inherited from upstream.

- [ ] **Step 4: Manual smoke**

`npm run dev`, then:
1. Open `/` — verify legacy shell renders unchanged.
2. Open `/?ecw=1` — verify NewAppShell renders: top bar with 3 tabs + ⌘K + bridge dot, default Catalogs placeholder body, CLI rail open on the right showing "Project" scope.
3. Click Mission Control tab → body swaps to Mission Control placeholder.
4. Click Live State tab → body swaps to Live State placeholder.
5. Press ⌘K (or Ctrl+K) → palette opens with 3 jump rows.
6. Click a jump row → palette closes + tab switches.
7. Press Esc → palette closes.
8. Click the rail toggle → cycles auto → wide → collapsed.

If any step fails, fix it inline (this is the integration check; small bugs surface here).

- [ ] **Step 5: Phase 1 commit + tag**

```bash
git add -A docs/  # if any plan doc updates
git commit --allow-empty -m "milestone(ecw): Phase 1 complete — 3-tab shell + CLI rail chrome + palette behind ?ecw=1

App boots into ECW shell at /?ecw=1; legacy shell unchanged at /.
Tab bodies are placeholders pending Phases 3, 5, 6.
CLI rail is chrome-only pending Phase 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git tag ecw-phase-1-complete
```

---

## Self-review checklist (run after Task 8)

**Spec coverage (vs §2 of the design spec):**
- ✅ 3 L1 tabs scaffolded (Catalogs / Mission Control / Live State)
- ✅ CLI Rail container (chrome only — content in P4)
- ✅ ⌘K palette upgrade (basic — entity search in P3)
- ✅ Slimmer TopBar (brand · tabs · ⌘K · bridge dot · cog)
- ✅ `?ecw=1` flag for legacy A/B
- ⏳ Project Setup duck into cog after first-run — deferred to Phase 12 (cutover); for now ECW shell skips setup check, assuming setup already done. ⚠️ If `isSetupComplete` is false on `?ecw=1`, we should still render `SetupWizard`. **Plan adjustment: add the same `isSetupComplete` gate to `NewAppShell` as exists in `AppShell`.** → Task 6 should check this; add it.

**Placeholder scan:**
- No "TBD" / "implement later" placeholders in my code (only in placeholder tab bodies, which are *intentional* documentation of what's coming in later phases).

**Type consistency:**
- `EcwL1Tab`, `CliRailMode` types defined in ecwStore, referenced consistently by EcwL1Tabs and CliRail.
- `useEcwStore` is the single source of truth; no duplicate state in components.

**Plan adjustment for the SetupWizard gate found in self-review:**

Add to Task 6 Step 3, before the `<EcwTopBar />`:

```tsx
import { useProjectStore } from '@/stores/projectStore';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';

// inside NewAppShell, before the return:
const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
if (!isSetupComplete) return <SetupWizard />;
```

And add a test:

```tsx
it('shows SetupWizard if project setup not complete', () => {
  // mock useProjectStore to return isSetupComplete=false
  // expect SetupWizard rendered, not the shell
});
```

This is documented for the engineer; the actual mock + test code is standard.

---

## Phase 1 done state

After Phase 1 commits:
- `/?ecw=1` boots the new ECW shell with empty placeholder tab bodies.
- `/` boots the legacy app unchanged (zero regression risk).
- The new shell has navigation, palette, and CLI rail chrome.
- All Phase 1 work is on `feature/entity-centric-workspace`.
- Tag `ecw-phase-1-complete` marks the milestone.

**Next phase:** `2026-05-24-pof-ecw-phase-02-entity-inspector.md` — the universal Entity Inspector primitive that all 8 catalogs will plug into.
