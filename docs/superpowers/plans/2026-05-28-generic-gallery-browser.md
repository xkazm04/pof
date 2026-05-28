# Generic Gallery Candidate Browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ArchetypeStep`'s stub `gallery` view with the real `CandidateGallery` generate→compare→select loop, upgrading all ~28 generic gallery catalogs at once, with acceptance unchanged.

**Architecture:** Add one pure candidate generator (`genericGalleryCandidates`) and branch `ArchetypeStep`'s panels when `spec.view.kind === 'gallery'`, reusing the existing `genHistory` model + `CandidateGallery` component. The Items bespoke pipeline (`ItemArt.tsx`) is left untouched.

**Tech Stack:** Next.js 16 / React 19, Zustand (labPipelineStore), Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-28-generic-gallery-browser-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/layout-lab/steps/shared/genericGalleryCandidates.ts` | **new** — pure generator: N deterministic swatch candidates with `{ [field]: index }` payloads |
| `src/components/layout-lab/steps/ArchetypeStep.tsx` | **modify** — branch gallery panels; genHistory generate/reselect closures |
| `src/__tests__/components/layout-lab/genericGalleryCandidates.test.ts` | **new** — count / determinism / payload |
| `src/__tests__/components/layout-lab/ArchetypeStepGallery.test.tsx` | **new** — empty→produce→select→accept, links/ueAssets survive |
| `.claude/CLAUDE.md` | **modify** — Shared Component Manifest CandidateGallery row |

---

## Task 1: Pure generic candidate generator

**Files:**
- Create: `src/components/layout-lab/steps/shared/genericGalleryCandidates.ts`
- Test: `src/__tests__/components/layout-lab/genericGalleryCandidates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/layout-lab/genericGalleryCandidates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { genericGalleryCandidates } from '@/components/layout-lab/steps/shared/genericGalleryCandidates';

describe('genericGalleryCandidates', () => {
  it('returns exactly `count` candidates', () => {
    expect(genericGalleryCandidates('selected', 4, 'ornate', 0)).toHaveLength(4);
    expect(genericGalleryCandidates('mesh', 3, 'rugged', 1)).toHaveLength(3);
    expect(genericGalleryCandidates('selected', 0, 'x', 0)).toHaveLength(0);
  });

  it('projects { [field]: index } as each payload (keeps `selected(field)` acceptance)', () => {
    const cands = genericGalleryCandidates('mesh3dSelected', 3, 'rugged', 0);
    expect(cands.map((c) => c.payload)).toEqual([
      { mesh3dSelected: 0 }, { mesh3dSelected: 1 }, { mesh3dSelected: 2 },
    ]);
  });

  it('is deterministic — same inputs produce identical swatches + captions', () => {
    const a = genericGalleryCandidates('selected', 4, 'weathered steel', 2);
    const b = genericGalleryCandidates('selected', 4, 'weathered steel', 2);
    expect(a).toEqual(b);
  });

  it('varies the swatch when direction or batch changes', () => {
    const base = genericGalleryCandidates('selected', 4, 'A', 0)[0].swatch;
    expect(genericGalleryCandidates('selected', 4, 'B', 0)[0].swatch).not.toBe(base);
    expect(genericGalleryCandidates('selected', 4, 'A', 1)[0].swatch).not.toBe(base);
  });

  it('emits computed hsl() swatches (no hardcoded hex)', () => {
    for (const c of genericGalleryCandidates('selected', 4, 'A', 0)) {
      expect(c.swatch).toContain('hsl(');
      expect(c.swatch).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/layout-lab/genericGalleryCandidates.test.ts`
Expected: FAIL — "Failed to resolve import" / `genericGalleryCandidates is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/layout-lab/steps/shared/genericGalleryCandidates.ts`:

```ts
import type { GenCandidate } from './genHistory';

/** Pure FNV-1a-style string hash → unsigned 32-bit int. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic placeholder candidates for the generic `gallery` archetype
 * (ArchetypeStep). Each candidate gets an `hsl()` swatch hashed from
 * direction+field+batch+index — computed, so it never trips the no-hardcoded-hex
 * rule and is reproducible — plus a `{ [field]: index }` payload so selecting it
 * projects a numeric index ≥ 0 (the `selected(field)` acceptance is unchanged).
 * Pure + framework-free so it is unit-testable.
 */
export function genericGalleryCandidates(
  field: string,
  count: number,
  direction: string,
  seq: number,
): Omit<GenCandidate, 'id'>[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const seed = hash(`${direction}|${field}|${seq}|${i}`);
    const hue = seed % 360;
    const sat = 45 + ((seed >> 9) % 35);    // 45–79%
    const light = 40 + ((seed >> 17) % 25); // 40–64%
    return {
      swatch: `linear-gradient(135deg, hsl(${hue} ${sat}% ${light}%), hsl(${(hue + 28) % 360} ${sat}% ${Math.max(20, light - 12)}%))`,
      caption: `Variant ${i + 1}`,
      payload: { [field]: i },
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/layout-lab/genericGalleryCandidates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout-lab/steps/shared/genericGalleryCandidates.ts src/__tests__/components/layout-lab/genericGalleryCandidates.test.ts
git commit -m "feat(gallery): pure generic candidate generator for the gallery archetype"
```

---

## Task 2: Wire the gallery branch into ArchetypeStep

**Files:**
- Modify: `src/components/layout-lab/steps/ArchetypeStep.tsx`
- Test: `src/__tests__/components/layout-lab/ArchetypeStepGallery.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/layout-lab/ArchetypeStepGallery.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { selected } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const STEP = 'Icon 2D Art';
const entity: LabEntity = { id: 'g1', name: 'Fireball', lifecycle: 'planned', data: {} };
const spec: StepSpec = {
  archetype: 'gallery', label: 'Icon 2D Art',
  view: { kind: 'gallery', field: 'selected', candidates: 4 },
  produce: (e) => ({
    data: { selected: 0 },
    ueAssets: [`/Game/UI/Icons/T_${e.name}_Icon`],
    links: [{ catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-library' }],
  }),
  accept: selected('selected', 'An icon candidate is selected'),
};

const status = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
const produce = () => fireEvent.click(screen.getByRole('button', { name: /Generate Icon 2D Art/ }));

describe('ArchetypeStep gallery archetype', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  it('shows the empty gallery + pending before Produce, then the kept batch + pass after', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    expect(status()).toBe('pending');
    expect(screen.getByTestId('candidate-gallery-empty')).toBeTruthy();

    produce();
    expect(status()).toBe('pass');
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('4 candidates · 1 re-roll kept');
    expect((screen.getByTestId('candidate-b0-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('preserves the spec ueAssets + links through a generate, and projects the selected index', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    produce();
    const art = useLabPipelineStore.getState().byEntity['g1'][STEP];
    expect(art.ueAssets).toContain('/Game/UI/Icons/T_Fireball_Icon');
    expect((art.data.links as { catalogId: string }[])[0].catalogId).toBe('icon-sets');
    expect(art.data.selected).toBe(0);
  });

  it('keeps prior re-rolls and persists re-selecting an older candidate', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    produce();  // batch 0
    produce();  // batch 1 (prior kept)
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('8 candidates · 2 re-rolls kept');

    fireEvent.click(screen.getByTestId('candidate-b0-c2'));
    expect((screen.getByTestId('candidate-b0-c2') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe('pass');

    const art = useLabPipelineStore.getState().byEntity['g1'][STEP];
    expect((art.data.genHistory as { selectedId: string }).selectedId).toBe('b0-c2');
    expect(art.data.selected).toBe(2); // projected index
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/layout-lab/ArchetypeStepGallery.test.tsx`
Expected: FAIL — the gallery view renders the stub count, so `candidate-gallery-empty` / `candidate-gallery` testids are absent.

- [ ] **Step 3: Edit `ArchetypeStep.tsx` imports**

At the top of `src/components/layout-lab/steps/ArchetypeStep.tsx`, add these imports after the existing `CliProduce` import (line 4):

```tsx
import { CandidateGallery } from './shared/CandidateGallery';
import { readHistory, makeBatch, appendBatch, selectCandidate, selectedCandidate, historyData } from './shared/genHistory';
import { genericGalleryCandidates } from './shared/genericGalleryCandidates';
```

- [ ] **Step 4: Replace the `ArchetypeStep` function body**

Replace the entire `ArchetypeStep` function (currently lines 72-109, from `export function ArchetypeStep(` to its closing `}`) with:

```tsx
/** Hybrid generic renderer: drives any common-archetype StepSpec from persisted artifacts. */
export function ArchetypeStep({ t, entity, step, spec, catalogId }: { t: LabTheme; entity: LabEntity; step: string; spec: StepSpec; catalogId?: string }) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const canonRules = useCanonStore((s) => s.rules);
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const data = art?.data ?? {};
  const links = readLinks(data);
  const linkRes = links.length ? linkTargetsExist(links, (c, e) => !!entitiesByCatalog[c]?.[e]) : null;

  const buildPrompt = (dir: string) => {
    const canon = canonContextFor(canonRules, catalogId, ARCHETYPE_CANON[spec.archetype]);
    return [canon, `Produce ${spec.label} for ${entity.name}. ${dir}`].filter(Boolean).join('\n\n');
  };

  // Gallery archetype: the real browse→compare→select loop (shared CandidateGallery + genHistory).
  const history = readHistory(data);
  const generate = (dir: string, prompt: string) => {
    if (spec.view.kind !== 'gallery') return;
    const base = spec.produce(entity);
    const batch = makeBatch({
      seq: history.batches.length,
      at: new Date().toISOString(),
      direction: dir,
      prompt,
      candidates: genericGalleryCandidates(spec.view.field, spec.view.candidates, dir, history.batches.length),
    });
    produce(entity.id, step, { ...base, data: historyData(appendBatch(history, batch), base.data) });
  };
  const reselect = (id: string) => {
    const base = spec.produce(entity);
    produce(entity.id, step, { ...base, data: historyData(selectCandidate(history, id), base.data) });
  };

  const cli = (onComplete: (ctx?: { direction: string; prompt: string }) => void) => (
    <CliProduce t={t} label={`Generate ${spec.label} (CLI)`} rows={3}
      defaultDirection={spec.defaultDirection} note={spec.produceNote}
      buildPrompt={buildPrompt} onComplete={onComplete} />
  );

  let panels;
  if (spec.view.kind === 'gallery') {
    const sel = selectedCandidate(history);
    const assetPath = spec.produce(entity).ueAssets?.[0];
    panels = [
      { label: 'Candidate gallery (kept across re-rolls)', node: (
        <CandidateGallery t={t} history={history} onSelect={reselect}
          emptyHint="No candidates yet — run Produce to generate the first batch." />
      ) },
      { label: 'Selected', node: (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ aspectRatio: '1', maxWidth: 160, borderRadius: t.glass ? 10 : 2, background: sel?.swatch ?? t.panel, border: `1px solid ${t.line}` }} />
          {sel && assetPath
            ? <span className={t.fontMono} style={{ fontSize: 14, color: t.ok }}>✓ writes {assetPath}</span>
            : <span style={{ fontSize: 14, color: t.muted }}>Pick a candidate; the choice + its prompt persist and write the asset path.</span>}
        </div>
      ) },
      { label: 'Produce', node: cli((ctx) => generate(ctx?.direction ?? spec.defaultDirection ?? '', ctx?.prompt ?? buildPrompt(spec.defaultDirection ?? ''))) },
    ];
  } else {
    panels = [
      { label: 'View', node: <ViewPanel t={t} view={spec.view} data={data} /> },
      { label: 'Produce', node: cli(() => produce(entity.id, step, spec.produce(entity))) },
    ];
  }

  return (
    <>
      {linkRes && (
        <div style={{
          borderLeft: `4px solid ${linkRes.status === 'pass' ? t.ok : linkRes.status === 'deferred' ? t.muted : t.warn}`,
          padding: '6px 12px',
          marginBottom: 8,
          fontSize: 14,
          color: t.text,
        }}>
          {linkRes.label}: {linkRes.detail}{linkRes.reason ? ` — ${linkRes.reason}` : ''}
        </div>
      )}
      <StepFrame t={t} acceptance={spec.accept(data)} panels={panels} />
    </>
  );
}
```

Note: the `gallery` branch in `ViewPanel` (lines ~67-68) is now unreachable for gallery specs but stays as the function's terminal fallback — leave it unchanged.

- [ ] **Step 5: Run the gallery test to verify it passes**

Run: `npx vitest run src/__tests__/components/layout-lab/ArchetypeStepGallery.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the existing ArchetypeStep + ItemArt tests (no regression)**

Run: `npx vitest run src/__tests__/components/layout-lab/ArchetypeStep.test.tsx src/__tests__/components/layout-lab/ItemArt.gallery.test.tsx`
Expected: PASS (existing brief-archetype + Items-gallery behavior unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/components/layout-lab/steps/ArchetypeStep.tsx src/__tests__/components/layout-lab/ArchetypeStepGallery.test.tsx
git commit -m "feat(gallery): render CandidateGallery in the generic ArchetypeStep gallery view"
```

---

## Task 3: Update the Shared Component Manifest

**Files:**
- Modify: `.claude/CLAUDE.md` (line 130)

- [ ] **Step 1: Edit the CandidateGallery manifest row**

In `.claude/CLAUDE.md`, find the `CandidateGallery` row (line 130) ending with:

```
Per-step candidate generators live in `shared/itemGenCandidates.ts`. Wired into the three generative Items steps in `ItemArt.tsx`.
```

Replace that trailing sentence with:

```
Per-step candidate generators live in `shared/itemGenCandidates.ts` (bespoke Items steps in `ItemArt.tsx`); the **generic `ArchetypeStep` gallery view** uses the same loop via `shared/genericGalleryCandidates.ts`, so every `archetype: 'gallery'` step across all catalogs gets browse→compare→select with acceptance unchanged.
```

- [ ] **Step 2: Confirm no other doc still calls the generic gallery a stub**

Run: `git grep -n "candidate count\|gallery view kind" -- docs ':!docs/superpowers'`
Expected: no matches (the only stub reference was in `ArchetypeStep.tsx` code, now replaced). If a match surfaces, update that line to point at the new behavior.

- [ ] **Step 3: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs(gallery): manifest notes the generic ArchetypeStep gallery uses CandidateGallery"
```

---

## Task 4: Full validation

- [ ] **Step 1: Run the full CI check**

Run: `npm run validate`
Expected: typecheck (0 errors), lint (no new errors), test (all pass, including the 2 new suites).

- [ ] **Step 2: If validate passes, the feature is complete.**

If lint flags the new file for `no-restricted-syntax` (hex) — it should not, since swatches are computed `hsl()` strings — re-check the generator emits no hex literal. If typecheck flags the `panels` type, ensure both branches build the same `{ label: string; node: ReactNode }[]` shape.

---

## Self-Review notes

- **Spec coverage:** generator (Task 1) ✔, ArchetypeStep wiring + acceptance-unchanged + links/ueAssets preserved (Task 2) ✔, docs (Task 3) ✔, validate (Task 4) ✔. `ItemArt.tsx` deliberately untouched ✔.
- **Type consistency:** `genericGalleryCandidates(field, count, direction, seq)` signature matches its call in Task 2; `historyData(history, extra)` and `makeBatch`/`appendBatch`/`selectCandidate`/`selectedCandidate` match `genHistory.ts`; `StepOutput` `{ data, ueAssets, links }` matches `labPipelineStore.ts`.
- **No placeholders:** all steps carry real code/commands.
