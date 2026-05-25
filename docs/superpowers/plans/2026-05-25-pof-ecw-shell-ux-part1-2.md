# ECW Shell UX Pass — Part 1 (both shells) + Part 2 (sidebar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the legacy shell reachable again with a working switcher (ECW stays default), and turn the catalog sidebar into an N-level collapsible, filterable, virtualized tree that scales to 1000+ entities.

**Architecture:** A tiny pure `shell-pref` helper drives an inverted `page.tsx` gate (ECW default, `?legacy=1`/stored pref → legacy). A pure `tree.ts` builds an N-level tree from each entity's `categoryPath` and flattens it to a visible-row list honoring collapse + filter; `EntityTree` renders those rows through `react-window`.

**Tech Stack:** Next.js 16, React 19, Zustand v5, `react-window` v2.2.7, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-shell-ux-pass-design.md`

**Invariants:** branch `feature/entity-centric-workspace`; commit locally only; `@/` imports; no hardcoded hex (use `chart-colors`); no raw `console` (logger has no `.error` → use `console.error`); co-author every commit `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Each task ends tsc 0 + eslint 0 on touched files + targeted vitest green.

---

## Task 1: `shell-pref` helper (shared source of truth for the gate + switcher)

**Files:**
- Create: `src/lib/ecw/shell-pref.ts`
- Test: `src/__tests__/lib/ecw/shell-pref.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { readShellPref, writeShellPref } from '@/lib/ecw/shell-pref';

describe('shell-pref', () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/'); });

  it('defaults to ecw', () => {
    expect(readShellPref()).toBe('ecw');
  });
  it('?legacy=1 forces legacy regardless of storage', () => {
    localStorage.setItem('pof.shell', 'ecw');
    window.history.replaceState({}, '', '/?legacy=1');
    expect(readShellPref()).toBe('legacy');
  });
  it('falls back to stored pref when no url param', () => {
    localStorage.setItem('pof.shell', 'legacy');
    expect(readShellPref()).toBe('legacy');
  });
  it('writeShellPref persists', () => {
    writeShellPref('legacy');
    expect(localStorage.getItem('pof.shell')).toBe('legacy');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/lib/ecw/shell-pref.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/ecw/shell-pref.ts
export type ShellPref = 'ecw' | 'legacy';
const KEY = 'pof.shell';

/** URL `?legacy=1` wins; else the stored preference; else ECW. SSR-safe (returns 'ecw'). */
export function readShellPref(): ShellPref {
  if (typeof window === 'undefined') return 'ecw';
  if (new URLSearchParams(window.location.search).get('legacy') === '1') return 'legacy';
  return localStorage.getItem(KEY) === 'legacy' ? 'legacy' : 'ecw';
}

export function writeShellPref(pref: ShellPref): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, pref);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/lib/ecw/shell-pref.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ecw/shell-pref.ts src/__tests__/lib/ecw/shell-pref.test.ts
git commit -m "feat(ecw): shell-pref helper — ECW-default gate source of truth (Part 1)"
```

---

## Task 2: Restore legacy shell + invert the `page.tsx` gate

**Files:**
- Restore (from history): `src/components/layout/**`, `src/components/cli/InlineTerminal.tsx`
- Modify: `src/app/page.tsx`, `src/__tests__/app/page.test.tsx`

- [ ] **Step 1: Restore the legacy shell files**

Run: `git checkout c44665e~1 -- src/components/layout src/components/cli/InlineTerminal.tsx`
Then verify they exist: `ls src/components/layout/AppShell.tsx src/components/cli/InlineTerminal.tsx`
Expected: both present.

- [ ] **Step 2: Rewrite the page test (default ECW; legacy on flag)**

```tsx
// src/__tests__/app/page.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Home from '@/app/page';

vi.mock('@/components/ecw/NewAppShell', () => ({ NewAppShell: () => <div data-testid="ecw-shell">ecw</div> }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: () => <div data-testid="legacy-shell">legacy</div> }));

describe('app/page.tsx shell gate (ECW default)', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('renders ECW by default', () => {
    window.history.replaceState({}, '', '/');
    render(<Home />);
    expect(screen.getByTestId('ecw-shell')).toBeTruthy();
  });
  it('renders legacy when ?legacy=1', () => {
    window.history.replaceState({}, '', '/?legacy=1');
    render(<Home />);
    expect(screen.getByTestId('legacy-shell')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/__tests__/app/page.test.tsx`
Expected: FAIL — page renders ECW unconditionally (legacy case fails).

- [ ] **Step 4: Invert the gate**

```tsx
// src/app/page.tsx
'use client';

import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { NewAppShell } from '@/components/ecw/NewAppShell';
import { readShellPref } from '@/lib/ecw/shell-pref';

/**
 * Root page. ECW is the default shell; the legacy shell is reachable via the
 * ShellSwitcher (sets `?legacy=1` + a stored pref). Both shells coexist while
 * migration completes. Subscribes to popstate so the switcher swaps live.
 */
export default function Home() {
  const pref = useSyncExternalStore(
    (cb) => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); },
    readShellPref,
    () => 'ecw' as const,
  );
  return pref === 'legacy' ? <AppShell /> : <NewAppShell />;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/__tests__/app/page.test.tsx` — Expected: PASS (2 tests).
Run: `npx tsc --noEmit 2>&1 | grep -E "page.tsx|layout/|InlineTerminal" || echo CLEAN` — Expected: CLEAN (legacy shell compiles as before; the 3 pre-existing AssetInspector errors are unrelated).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/__tests__/app/page.test.tsx src/components/layout src/components/cli/InlineTerminal.tsx
git commit -m "feat(ecw): restore legacy shell + invert gate (ECW default, ?legacy=1) (Part 1)"
```

---

## Task 3: Fix `ShellSwitcher` (semantics + token color + both headers)

**Files:**
- Modify: `src/components/ecw/ShellSwitcher.tsx`
- Modify: `src/components/layout/TopBar.tsx` (ensure it mounts `ShellSwitcher`), `src/components/ecw/EcwTopBar.tsx` (already mounts it — verify)
- Test: `src/__tests__/components/ecw/ShellSwitcher.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShellSwitcher } from '@/components/ecw/ShellSwitcher';
import { readShellPref } from '@/lib/ecw/shell-pref';

describe('ShellSwitcher', () => {
  afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

  it('defaults to New pressed', () => {
    render(<ShellSwitcher />);
    expect(screen.getByRole('button', { name: /new/i }).getAttribute('aria-pressed')).toBe('true');
  });
  it('clicking Legacy sets the legacy pref + url flag', () => {
    render(<ShellSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /legacy/i }));
    expect(readShellPref()).toBe('legacy');
    expect(window.location.search).toContain('legacy=1');
  });
  it('uses no arbitrary hex color class on the active button', () => {
    const { container } = render(<ShellSwitcher />);
    expect(container.innerHTML).not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/ShellSwitcher.test.tsx`
Expected: FAIL — current switcher reads `?ecw`, defaults New=not-pressed, and contains `bg-[#00ff88]/20`.

- [ ] **Step 3: Rewrite the switcher**

```tsx
// src/components/ecw/ShellSwitcher.tsx
'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import { readShellPref, writeShellPref } from '@/lib/ecw/shell-pref';

/**
 * Header toggle between the ECW shell (default) and the legacy shell. Mounted in
 * both headers. Switching writes the stored pref + toggles `?legacy=1` and
 * dispatches popstate so page.tsx's useSyncExternalStore swaps the shell live.
 */
export function ShellSwitcher() {
  const pref = useSyncExternalStore(
    (cb) => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); },
    readShellPref,
    () => 'ecw' as const,
  );
  const isLegacy = pref === 'legacy';

  const switchTo = useCallback((legacy: boolean) => {
    writeShellPref(legacy ? 'legacy' : 'ecw');
    const url = new URL(window.location.href);
    if (legacy) url.searchParams.set('legacy', '1');
    else url.searchParams.delete('legacy');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return (
    <div role="group" aria-label="Shell switcher" className="flex items-center rounded-md border border-border/60 overflow-hidden text-2xs font-mono">
      <button onClick={() => switchTo(true)} aria-pressed={isLegacy}
        className={`focus-ring px-2 py-1 transition-colors ${isLegacy ? 'bg-surface text-text' : 'text-text-muted hover:text-text'}`}>
        Legacy
      </button>
      <button onClick={() => switchTo(false)} aria-pressed={!isLegacy}
        className="focus-ring px-2 py-1 transition-colors"
        style={!isLegacy ? { color: ACCENT_EMERALD } : undefined}>
        New
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/ShellSwitcher.test.tsx` — Expected: PASS (3 tests).

- [ ] **Step 5: Ensure the switcher is in both headers**

Check: `grep -n ShellSwitcher src/components/layout/TopBar.tsx src/components/ecw/EcwTopBar.tsx`
If `TopBar.tsx` (restored legacy header) does not import/render `<ShellSwitcher/>`, add the import `import { ShellSwitcher } from '@/components/ecw/ShellSwitcher';` and render it in the header's right-side action group. `EcwTopBar` already mounts it.

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -E "ShellSwitcher|TopBar" || echo CLEAN` — Expected: CLEAN.
Run: `npx eslint src/components/ecw/ShellSwitcher.tsx` — Expected: clean.

```bash
git add src/components/ecw/ShellSwitcher.tsx src/components/layout/TopBar.tsx src/__tests__/components/ecw/ShellSwitcher.test.tsx
git commit -m "fix(ecw): working ShellSwitcher — ECW/legacy semantics + token color, both headers (Part 1)"
```

---

## Task 4: `tree.ts` — build + flatten the N-level catalog tree (pure)

**Files:**
- Create: `src/lib/catalog/tree.ts`
- Test: `src/__tests__/lib/catalog/tree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildEntityTree, flattenVisible } from '@/lib/catalog/tree';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function e(id: string, name: string, path: string[]): CatalogEntityBase {
  return { id, catalogId: 'spellbook', name, categoryPath: path, tags: [], lifecycle: 'planned' } as CatalogEntityBase;
}
const entities = [
  e('a', 'Fireball', ['Offensive', 'Fire']),
  e('b', 'Flame Wall', ['Offensive', 'Fire']),
  e('c', 'Gust', ['Offensive', 'Air']),
  e('d', 'Heal', ['Support', 'Restoration']),
];

describe('buildEntityTree + flattenVisible', () => {
  it('produces group rows then entity rows, depth-ordered, all expanded', () => {
    const rows = flattenVisible(buildEntityTree(entities), new Set(), '');
    const offensive = rows.find((r) => r.kind === 'group' && r.label === 'Offensive')!;
    expect(offensive.depth).toBe(0);
    expect(offensive.count).toBe(3);
    const fire = rows.find((r) => r.kind === 'group' && r.label === 'Fire')!;
    expect(fire.depth).toBe(1);
    expect(rows.some((r) => r.kind === 'entity' && r.label === 'Fireball')).toBe(true);
  });
  it('collapsing a group hides its descendants', () => {
    const tree = buildEntityTree(entities);
    const rows = flattenVisible(tree, new Set(['Offensive']), '');
    expect(rows.some((r) => r.label === 'Fire')).toBe(false);
    expect(rows.some((r) => r.label === 'Fireball')).toBe(false);
    // the collapsed group header itself still shows
    expect(rows.some((r) => r.kind === 'group' && r.label === 'Offensive')).toBe(true);
  });
  it('filter prunes to matching entities and keeps their ancestor groups', () => {
    const rows = flattenVisible(buildEntityTree(entities), new Set(), 'gust');
    expect(rows.some((r) => r.label === 'Gust')).toBe(true);
    expect(rows.some((r) => r.label === 'Fireball')).toBe(false);
    expect(rows.some((r) => r.label === 'Air')).toBe(true);
    expect(rows.some((r) => r.label === 'Support')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/tree.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/tree.ts
import type { CatalogEntityBase } from '@/lib/catalog/types';

export interface TreeRow {
  kind: 'group' | 'entity';
  depth: number;
  key: string;            // group: joined categoryPath prefix; entity: entity id
  label: string;
  count?: number;         // group only
  entity?: CatalogEntityBase;
}

interface TreeNode {
  children: Map<string, TreeNode>; // ordered by insertion; sorted at flatten time
  entities: CatalogEntityBase[];   // entities whose path ends at this node
}

function emptyNode(): TreeNode { return { children: new Map(), entities: [] }; }

/** Build an N-level tree keyed by each categoryPath segment. */
export function buildEntityTree(entities: CatalogEntityBase[]): TreeNode {
  const root = emptyNode();
  for (const ent of entities) {
    const path = ent.categoryPath.length > 0 ? ent.categoryPath : ['Uncategorized'];
    let node = root;
    for (const seg of path) {
      if (!node.children.has(seg)) node.children.set(seg, emptyNode());
      node = node.children.get(seg)!;
    }
    node.entities.push(ent);
  }
  return root;
}

function countEntities(node: TreeNode): number {
  let n = node.entities.length;
  for (const child of node.children.values()) n += countEntities(child);
  return n;
}

function matches(node: TreeNode, filter: string): boolean {
  if (!filter) return true;
  const f = filter.toLowerCase();
  if (node.entities.some((e) => e.name.toLowerCase().includes(f))) return true;
  for (const child of node.children.values()) if (matches(child, filter)) return true;
  return false;
}

/** Flatten the tree to visible rows: group headers (collapsed hides descendants) then
 *  entity rows. A non-empty filter prunes to matching entities and auto-expands ancestors. */
export function flattenVisible(root: TreeNode, collapsed: Set<string>, filter: string): TreeRow[] {
  const rows: TreeRow[] = [];
  const f = filter.toLowerCase();
  const walk = (node: TreeNode, depth: number, prefix: string) => {
    const groupKeys = [...node.children.keys()].sort((a, b) => a.localeCompare(b));
    for (const seg of groupKeys) {
      const child = node.children.get(seg)!;
      if (filter && !matches(child, filter)) continue;
      const key = prefix ? `${prefix}/${seg}` : seg;
      rows.push({ kind: 'group', depth, key, label: seg, count: countEntities(child) });
      // when filtering, ignore collapse (auto-expand); else respect collapsed set
      if (filter || !collapsed.has(key)) walk(child, depth + 1, key);
    }
    const ents = [...node.entities]
      .filter((e) => !filter || e.name.toLowerCase().includes(f))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of ents) {
      rows.push({ kind: 'entity', depth, key: ent.id, label: ent.name, entity: ent });
    }
  };
  walk(root, 0, '');
  return rows;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/tree.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/tree.ts src/__tests__/lib/catalog/tree.test.ts
git commit -m "feat(catalog): N-level tree build + visible-row flatten (collapse + filter) (Part 2)"
```

---

## Task 5: `EntityTree` rewrite — virtualized, collapsible, filterable

**Files:**
- Modify: `src/components/ecw/catalogs/EntityTree.tsx`
- Test: `src/__tests__/components/ecw/catalogs/EntityTree.test.tsx` (create if absent)

- [ ] **Step 1: Verify the `react-window` v2 API**

Run: `node -e "const m=require('react-window'); console.log(Object.keys(m))"`
Note the exported list component name (v2 differs from v1 `FixedSizeList`). Use whatever the export is (likely `List`); if the API is awkward, a plain scroll container with the flattened rows is an acceptable fallback (virtualization still required at 1000+ — prefer the windowed export).

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntityTree } from '@/components/ecw/catalogs/EntityTree';
import { useEcwStore } from '@/stores/ecwStore';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function e(id: string, name: string, path: string[]): CatalogEntityBase {
  return { id, catalogId: 'spellbook', name, categoryPath: path, tags: [], lifecycle: 'planned' } as CatalogEntityBase;
}
const entities = [e('a', 'Fireball', ['Offensive', 'Fire']), e('c', 'Gust', ['Offensive', 'Air'])];

describe('EntityTree', () => {
  beforeEach(() => useEcwStore.setState({ activeEntityId: null }));
  afterEach(cleanup);

  it('renders group headers and entities', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('Fireball')).toBeTruthy();
  });
  it('collapsing a top group hides its entities', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    fireEvent.click(screen.getByText('Offensive'));
    expect(screen.queryByText('Fireball')).toBeNull();
  });
  it('filter prunes the list', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: 'gust' } });
    expect(screen.getByText('Gust')).toBeTruthy();
    expect(screen.queryByText('Fireball')).toBeNull();
  });
  it('selecting an entity calls selectEntity', () => {
    render(<EntityTree catalogId="spellbook" entities={entities} />);
    fireEvent.click(screen.getByText('Fireball'));
    expect(useEcwStore.getState().activeEntityId).toBe('a');
  });
});
```

> Note: virtualized lists only mount visible rows. With 2 entities all rows mount, so these assertions hold. For the windowed renderer in tests, set a tall container or use the lib's test-friendly props; if rows don't mount under jsdom, render the row list without windowing when `entities.length` is below a threshold (e.g. 50) — a reasonable optimization that also keeps tests simple.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/catalogs/EntityTree.test.tsx`
Expected: FAIL — no filter input; collapse not supported.

- [ ] **Step 4: Implement the rewrite**

Replace `EntityTree.tsx` with: `useState` for `collapsed: Set<string>` + `filter: string`; `const rows = useMemo(() => flattenVisible(buildEntityTree(entities), collapsed, filter), [entities, collapsed, filter])`; a filter `<input placeholder="Filter…">`; render `rows` (windowed via the verified `react-window` export above the threshold, plain map below it). Group row: chevron + `label` + `(count)`, `onClick` toggles `collapsed` (add/remove `row.key`), indent `style={{ paddingLeft: 8 + row.depth * 12 }}`. Entity row: keep the existing button (`selectEntity(catalogId, row.entity!.id)`, `LifecycleBadge`, `aria-current`), same indent. Root `role="tree"`; group `role="treeitem" aria-expanded={!collapsed.has(key)}`; entity `role="treeitem"`.

```tsx
// key structure (full file)
'use client';
import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import { buildEntityTree, flattenVisible } from '@/lib/catalog/tree';
import type { CatalogEntityBase } from '@/lib/catalog/types';

interface Props { catalogId: string; entities: CatalogEntityBase[]; }
const VIRTUALIZE_THRESHOLD = 50;

export function EntityTree({ catalogId, entities }: Props) {
  const activeEntityId = useEcwStore((s) => s.activeEntityId);
  const selectEntity = useEcwStore((s) => s.selectEntity);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState('');

  const rows = useMemo(
    () => flattenVisible(buildEntityTree(entities), collapsed, filter),
    [entities, collapsed, filter],
  );
  const toggle = (key: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  if (entities.length === 0) {
    return <p className="text-xs text-text-muted/70 italic px-3 py-4">No entities in this catalog.</p>;
  }

  const renderRow = (row: typeof rows[number]) => {
    const pad = { paddingLeft: 8 + row.depth * 12 };
    if (row.kind === 'group') {
      const open = !collapsed.has(row.key);
      const Chevron = open ? ChevronDown : ChevronRight;
      return (
        <button key={row.key} role="treeitem" aria-expanded={open} onClick={() => toggle(row.key)} style={pad}
          className="focus-ring w-full flex items-center gap-1 py-1 text-2xs font-mono uppercase tracking-[0.12em] text-text-muted hover:text-text">
          <Chevron className="w-3 h-3 shrink-0" />
          <span className="truncate">{row.label}</span>
          <span className="text-text-muted/60">({row.count})</span>
        </button>
      );
    }
    const isActive = activeEntityId === row.entity!.id;
    return (
      <button key={row.key} role="treeitem" aria-current={isActive ? 'true' : undefined} style={pad}
        onClick={() => selectEntity(catalogId, row.entity!.id)}
        className={`focus-ring w-full flex items-center gap-2 pr-2 py-1.5 rounded text-xs text-left ${isActive ? 'bg-surface text-text' : 'text-text-muted hover:text-text hover:bg-surface/40'}`}>
        <span className="flex-1 truncate">{row.label}</span>
        <LifecycleBadge state={row.entity!.lifecycle} />
      </button>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <input value={filter} onChange={(ev) => setFilter(ev.target.value)} placeholder="Filter…"
        className="focus-ring mx-2 my-2 bg-surface-deep border border-border/50 rounded px-2 py-1 text-xs text-text placeholder:text-text-muted/60 outline-none" />
      <nav role="tree" aria-label="Entity tree" className="flex-1 overflow-auto px-1 pb-2">
        {/* Below threshold: plain map (also keeps jsdom tests simple). Above: windowed via react-window. */}
        {rows.map(renderRow)}
      </nav>
    </div>
  );
}
```

> For >`VIRTUALIZE_THRESHOLD` rows, wrap the row list in the verified `react-window` windowed list (fixed item size ~28px, `itemCount={rows.length}`, row renderer = `renderRow(rows[index])` with the `style` from react-window merged onto the row's outer element). Keep the plain map for small catalogs.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/catalogs/EntityTree.test.tsx` — Expected: PASS (4 tests).
Run: `npx tsc --noEmit 2>&1 | grep -E "EntityTree|tree.ts" || echo CLEAN` — Expected: CLEAN.
Run: `npx eslint src/components/ecw/catalogs/EntityTree.tsx` — Expected: clean (no hardcoded hex; chevrons from lucide).

- [ ] **Step 6: Commit**

```bash
git add src/components/ecw/catalogs/EntityTree.tsx src/__tests__/components/ecw/catalogs/EntityTree.test.tsx
git commit -m "feat(catalog): EntityTree — N-level collapsible/filterable virtualized sidebar (Part 2)"
```

---

## Final verification (after Task 5)

- [ ] Run the broad sweep: `npx vitest run src/__tests__/app src/__tests__/components/ecw src/__tests__/lib/catalog src/__tests__/lib/ecw` — Expected: all green.
- [ ] `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v AssetInspector || echo "no new errors"` — Expected: no new errors (only the 3 pre-existing AssetInspector errors remain).
- [ ] Manual smoke (optional): `npm run dev`, confirm `/` lands on ECW, the header switcher flips to legacy and back, and the spellbook sidebar groups by Offensive→Fire/Air with working collapse + filter.

## Out of scope (this plan)
Part 3 (track-tab inspector) — its own plan after Parts 1–2 land. 3D/VFX generation tooling. Dead-code purge + master merge.
