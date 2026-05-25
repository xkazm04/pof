# ECW Overview Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Add an Overview tab (default) to the inspector's pipeline switcher wrapping metadata + assets + cross-links; move the always-visible panels into it.

**Architecture:** Pure composition. `summarizeEntityData` (pure helper) + `OverviewWorkspace` (composes existing panels) + `TrackTabStrip` selected-state widened to `'overview' | PipelineTrackId` (default `'overview'`).

**Spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-overview-surface-design.md`. **Invariants:** branch-local commits; `@/` imports; no hardcoded hex; co-author tag; each task ends ECW vitest green + eslint/tsc clean (excl. pre-existing AssetInspector).

---

## Task 1: `summarizeEntityData` pure helper

**Files:** Create `src/lib/ecw/entity-summary.ts`; Test `src/__tests__/lib/ecw/entity-summary.test.ts`.

- [ ] **Failing test:**
```ts
import { describe, it, expect } from 'vitest';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';

describe('summarizeEntityData', () => {
  it('picks top-level primitive fields, skipping noise + non-primitives', () => {
    const f = summarizeEntityData({ id: 'x', color: '#fff', icon: 'I', tag: 't', category: 'Offensive', damage: 40, hasRootMotion: true, radar: [1,2], nested: {} });
    const labels = f.map((x) => x.label);
    expect(labels).toContain('category');
    expect(labels).toContain('damage');
    expect(labels).toContain('hasRootMotion');
    expect(labels).not.toContain('id');
    expect(labels).not.toContain('color');
    expect(labels).not.toContain('radar');
    expect(labels).not.toContain('nested');
    expect(f.find((x) => x.label === 'hasRootMotion')!.value).toBe('yes');
    expect(f.find((x) => x.label === 'damage')!.value).toBe('40');
  });
  it('caps the field count', () => {
    const data: Record<string, number> = {};
    for (let i = 0; i < 20; i++) data[`f${i}`] = i;
    expect(summarizeEntityData(data, 5)).toHaveLength(5);
  });
  it('returns [] for a non-object', () => {
    expect(summarizeEntityData(null)).toEqual([]);
    expect(summarizeEntityData(42)).toEqual([]);
  });
});
```
- [ ] Run → fail. Implement:
```ts
// src/lib/ecw/entity-summary.ts
export interface SummaryField { label: string; value: string; }
const SKIP = new Set(['id', 'color', 'icon', 'tag']);

/** Headline view of an entity's `data`: top-level primitive fields (string/number/boolean),
 *  in declaration order, minus noise keys, capped at `max`. Non-objects → []. */
export function summarizeEntityData(data: unknown, max = 8): SummaryField[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const out: SummaryField[] = [];
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SKIP.has(key)) continue;
    if (typeof val === 'string' || typeof val === 'number') out.push({ label: key, value: String(val) });
    else if (typeof val === 'boolean') out.push({ label: key, value: val ? 'yes' : 'no' });
    if (out.length >= max) break;
  }
  return out;
}
```
- [ ] Run → pass. Commit `feat(ecw): summarizeEntityData helper (Overview B.1)`.

---

## Task 2: `OverviewWorkspace`

**Files:** Create `src/components/ecw/inspector/OverviewWorkspace.tsx`; Test `src/__tests__/components/ecw/inspector/OverviewWorkspace.test.tsx`.

- [ ] **Failing test:** render for a sample entity (tags `['Boss']`, data `{ damage: 40 }`, links `[{catalogId:'loot-tables',entityId:'lt-x',role:'loot'}]`) → asserts a tag chip "Boss", a summary field "damage"/"40", and the cross-links panel ("Cross-links" + "loot"). Mock nothing (these panels are pure render; EntityLifecyclePanel/CrossLinksPanel take `entity`).
- [ ] Implement: compose tags chips + `summarizeEntityData(entity.data)` grid + `<EntityLifecyclePanel entity={entity} />` + `<EntityCrossLinksPanel entity={entity} />` + `<EntitySpecPanel data={entity.data} />`. Use `text-xs`/`text-sm` sans per the theme convention; tag chips `text-2xs` in a `bg-surface` pill.
```tsx
'use client';
import { EntityLifecyclePanel } from './EntityLifecyclePanel';
import { EntityCrossLinksPanel } from './EntityCrossLinksPanel';
import { EntitySpecPanel } from './EntitySpecPanel';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

export function OverviewWorkspace({ entity }: { entity: StoredCatalogEntity }) {
  const fields = summarizeEntityData(entity.data);
  return (
    <div>
      {entity.tags.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {entity.tags.map((t) => (
            <span key={t} className="text-2xs px-2 py-0.5 rounded-full bg-surface text-text-muted">{t}</span>
          ))}
        </div>
      )}
      {fields.length > 0 && (
        <dl className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {fields.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-2 text-xs">
              <dt className="text-text-muted truncate">{f.label}</dt>
              <dd className="text-text font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <EntityLifecyclePanel entity={entity} />
      <EntityCrossLinksPanel entity={entity} />
      <EntitySpecPanel data={entity.data} />
    </div>
  );
}
```
- [ ] Run → pass; eslint clean. Commit `feat(ecw): OverviewWorkspace — metadata + assets + cross-links (Overview B.2)`.

---

## Task 3: `TrackTabStrip` Overview pseudo-tab (default)

**Files:** Modify `src/components/ecw/pipeline/TrackTabStrip.tsx`; Modify `src/__tests__/components/ecw/pipeline/TrackTabStrip.test.tsx`.

- [ ] **Failing test additions:** (a) an Overview tab exists and is `aria-selected` by default; (b) Overview content renders by default (e.g. cross-links / summary) rather than a track workspace; (c) clicking the first *track* tab switches away from Overview; (d) the existing track-count assertion becomes `tracks.length + 1` total tabs.
- [ ] Implement: widen `selected` state to `'overview' | PipelineTrackId`, default `'overview'` (so `active = selected ?? 'overview'`). Render a leading Overview `role="tab"` (icon `LayoutGrid`, neutral `text-text-muted`/`bg-surface` when active, no status dot). Body: `active === 'overview' ? <OverviewWorkspace entity={entity} /> : createElement(getTrackWorkspace(entity.catalogId, active), { entity, trackId: active })`. Keep the entity-change reset (reset to `'overview'`). The `doneCount` summary stays (counts tracks only).
- [ ] Run → pass; tsc/eslint clean. Commit `feat(ecw): Overview pseudo-tab (default) in the pipeline switcher (Overview B.3)`.

---

## Task 4: Simplify `EntityInspector`

**Files:** Modify `src/components/ecw/inspector/EntityInspector.tsx`; Modify `src/__tests__/components/ecw/inspector/EntityInspector.test.tsx`.

- [ ] Remove the standalone `<EntityLifecyclePanel/>` + `<EntityCrossLinksPanel/>` from the inspector body (now in Overview) and their imports. Body becomes `<EntityHeader/>` + `<TrackTabStrip/>`. Keep the facet/workspace side-effect imports.
- [ ] **Test update:** the inspector test should assert Overview content (cross-links "loot", lifecycle "/Script/PoF.BP_Brute", summary "power") shows **by default** (Overview tab), and that switching to the Test track still shows the functional test. (These were previously asserted as always-visible; now they're in the default Overview tab — same assertions hold without a tab click for the cross-links/lifecycle/spec, since Overview is default.)
- [ ] Run inspector + pipeline tests → pass; tsc/eslint clean. Commit `feat(ecw): inspector = Header + TrackTabStrip; panels live in Overview (Overview B.4)`.

---

## Final verification
- [ ] `npx vitest run src/__tests__/components/ecw src/__tests__/lib/ecw src/__tests__/app` — all green.
- [ ] `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v AssetInspector || echo CLEAN` — CLEAN.
- [ ] Manual smoke: open an entity → lands on Overview (tags + summary + assets + cross-links); track tabs switch; clicking Overview returns.
