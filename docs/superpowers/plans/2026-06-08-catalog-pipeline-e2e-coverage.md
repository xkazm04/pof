# Catalog-Pipeline E2E Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every registered catalog pipeline Playwright e2e coverage that drives the real `/layout` lab UI (View → Produce → Acceptance + server persist round-trip), plus a vitest guard + CLAUDE.md rule so future catalogs can't ship without an e2e path.

**Architecture:** A data-driven *walker* spec enumerates `allCatalogPipelines()` and, per catalog, opens its first seeded entity in the lab and walks every step to a config-complete terminal acceptance (`pass` for L0/L1/L2, `deferred` for L3/L4 — never `fail`/`pending`), then asserts the artifact persisted to SQLite and re-hydrates after a local-cache wipe. A bespoke Items spec deep-tests the 13-step reference pipeline. A vitest guard fails `npm run validate` if any registered pipeline is unseeded or undocumented-skipped.

**Tech Stack:** Playwright 1.60 (`@playwright/test`), Next.js 16 dev server (real SQLite `~/.pof/pof.db`), vitest 4 for the guard. All e2e runs in client-only stub mode — `CliProduce` writes artifacts synchronously, no Claude CLI / UE bridge is spawned.

---

## Background the engineer needs

- **The lab is the homepage.** `src/app/page.tsx` renders `<NewHome/>` → `<LayoutLab/>` directly; no project-setup wizard. The ready signal is the root `data-testid="harness-lab-ready"` (`LayoutLab.tsx:90`).
- **Catalog tree** (`CatalogTree.tsx`): category headers are `<button aria-expanded>`; only the selected catalog's category is open by default. Catalog buttons carry `data-testid="harness-catalog-${catalogId}"`. Selecting a catalog auto-shows `entities[0]` (no entity click needed).
- **Pipeline rail** (`PipelineRail.tsx`): each step is a `<button>` containing `data-testid="step-dot-stamp-${i}"`. Clicking it selects step `i`.
- **Produce** (`CliProduce.tsx`): clicking the dispatch button runs `onComplete` synchronously (default path, no `minDispatchMs`) → `produce(entityId, step, spec.produce(entity))`. Success shows `data-testid="cli-produce-result"`. **No CLI is spawned.**
- **Acceptance banner** (`StepFrame.tsx:55-57`): `data-testid="acceptance-banner"` **already** has `data-status={acceptance.status}` where status ∈ `pass|fail|deferred|pending`.
- **Gallery steps** (`ArchetypeStep.tsx`): the Produce panel generates a candidate batch; a candidate must be selected (`data-testid="candidate-${id}"`) for `selected(...)` acceptance to pass.
- **Persist flow** (`Baseline.tsx:99-122`): on produce, `setLabSync` resolves acceptance via `resolveAccept` and `void postArtifact(...)` → `POST /api/pipeline-artifacts` (fire-and-forget). On entity open, `fetchArtifacts` → `hydrateEntity` (add-only). Local cache also persists to `localStorage['pof-lab-pipeline']`.
- **Registry** (`pipeline-registry.ts`): `allCatalogPipelines()` returns all 31 `CatalogPipeline`s **after** the barrel `@/lib/catalog/pipelines/registry.generated` is imported (side-effect registration). Each `StepSpec` exposes `.label` and `.view.kind`.
- **Alias:** `tsconfig.json` maps `@/* → ./src/*`. Vitest honors it (per CLAUDE.md). Playwright *should* honor tsconfig paths (v1.60) — **Task 4 probes this first**; if it fails, the fallback is documented in that task.

## File structure

| File | Responsibility |
|------|----------------|
| `src/components/layout-lab/steps/controls.tsx` *(modify)* | `LabButton` gains an optional `testId` prop. |
| `src/components/layout-lab/steps/shared/CliProduce.tsx` *(modify)* | Dispatch button gets `testId="cli-produce-run"`. |
| `src/components/layout-lab/CatalogTree.tsx` *(modify)* | Entity row button gets `data-testid="harness-entity-${id}"`. |
| `src/components/layout-lab/Baseline.tsx` *(modify)* | `#lab-canvas` gets `data-active-entity-id` + `data-active-catalog-id`. |
| `e2e/helpers/pipeline-coverage.ts` *(create)* | `WALKER_SKIP` map (single source for walker + guard). |
| `e2e/helpers/lab-mode.ts` *(create)* | Lab e2e helpers: goto, expand, open, select, produce, status, persist. |
| `e2e/catalog-pipeline-walker.spec.ts` *(create)* | Data-driven walker over all registered pipelines. |
| `e2e/catalog-items-reference.spec.ts` *(create)* | Bespoke deep walk of the 13-step Items pipeline. |
| `src/__tests__/catalog/pipeline-e2e-coverage.test.ts` *(create)* | Vitest guard: registry ⊆ seeded ∧ documented-skips only. |
| `.claude/CLAUDE.md` *(modify)* | Rule 5 — every pipeline is e2e-walked. |
| `docs/catalog/L3-L4-RUNNER.md` or `docs/README.md` *(modify)* | Point to the walker/guard (doc-sync). |

---

## Task 1: UI instrumentation (test-ids)

**Files:**
- Modify: `src/components/layout-lab/steps/controls.tsx`
- Modify: `src/components/layout-lab/steps/shared/CliProduce.tsx`
- Modify: `src/components/layout-lab/CatalogTree.tsx`
- Modify: `src/components/layout-lab/Baseline.tsx`
- Test: `src/__tests__/components/layout-lab/` (existing component tests must stay green)

- [ ] **Step 1: Add `testId` passthrough to `LabButton`**

In `controls.tsx`, change the `LabButton` signature + button:

```tsx
export function LabButton({ t, children, onClick, disabled, testId }: { t: LabTheme; children: ReactNode; onClick?: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} data-testid={testId} className={t.fontMono}
      style={{ padding: '10px 16px', fontSize: 14, letterSpacing: '0.03em', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, background: t.glass ? t.accentBg : t.ink, color: t.glass ? t.ink : t.onAccent, border: `1px solid ${t.ink}`, borderRadius: t.glass ? 8 : 0, fontWeight: 600 }}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Stamp the Produce dispatch button**

In `CliProduce.tsx`, the dispatch button (currently `<LabButton t={t} onClick={dispatch} disabled={dispatching}>{btnLabel}</LabButton>`) becomes:

```tsx
<LabButton t={t} onClick={dispatch} disabled={dispatching} testId="cli-produce-run">{btnLabel}</LabButton>
```

- [ ] **Step 3: Stamp the entity row + expose the active entity on the canvas**

In `CatalogTree.tsx`, the entity row `<button onClick={() => onSelectEntity(entity.id)} aria-label={...}>` gains a test-id:

```tsx
<button
  onClick={() => onSelectEntity(entity.id)}
  data-testid={`harness-entity-${entity.id}`}
  aria-label={statusAriaLabel(entity.name, status)}
  style={{ /* unchanged */ }}
>
```

In `Baseline.tsx`, the canvas main (`<main id="lab-canvas" tabIndex={-1} style={...}>`) gains the active ids so the walker can read the entity id for the persist GET:

```tsx
<main
  id="lab-canvas"
  tabIndex={-1}
  data-active-catalog-id={catalogId ?? ''}
  data-active-entity-id={entity?.id ?? ''}
  style={{ padding: '28px 36px', overflow: 'auto', minHeight: 0 }}
>
```

- [ ] **Step 4: Run the lab component tests — additive attrs must not break them**

Run: `npx vitest run src/__tests__/components/layout-lab/`
Expected: PASS (these are additive `data-*` attributes + one optional prop; no behavior change).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS (0 errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout-lab/steps/controls.tsx src/components/layout-lab/steps/shared/CliProduce.tsx src/components/layout-lab/CatalogTree.tsx src/components/layout-lab/Baseline.tsx
git commit -m "test(lab): add stable test-ids for catalog-pipeline e2e walker"
```

---

## Task 2: Shared coverage module (`WALKER_SKIP`)

**Files:**
- Create: `e2e/helpers/pipeline-coverage.ts`

This is a plain object with no app imports, so both the Playwright walker and the vitest guard can import it (the guard imports it via a relative path; vitest resolves that fine).

- [ ] **Step 1: Create the module**

```ts
// e2e/helpers/pipeline-coverage.ts
//
// Single source of truth for which registered catalog pipelines the data-driven
// walker (catalog-pipeline-walker.spec.ts) deliberately does NOT walk, and why.
// The vitest guard (src/__tests__/catalog/pipeline-e2e-coverage.test.ts) reads the
// SAME map, so a skip is only ever valid with a documented, non-empty reason.
//
// RULE: never skip a pipeline to dodge a real failure. A skip means the pipeline is
// covered better elsewhere, or genuinely cannot be exercised in stub mode (explain
// exactly why). See CLAUDE.md → "Rule 5 — Every pipeline is e2e-walked".

/** catalogId → reason it is excluded from the generic walker. */
export const WALKER_SKIP: Record<string, string> = {
  items: 'covered in depth by catalog-items-reference.spec.ts (bespoke 13-step UI)',
};
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/pipeline-coverage.ts
git commit -m "test(catalog): add shared walker-skip coverage map"
```

---

## Task 3: The gap guard (vitest)

**Files:**
- Create: `src/__tests__/catalog/pipeline-e2e-coverage.test.ts`

This runs in `npm run validate` (fast, no browser) and fails when a registered pipeline has no seeded entity or is skipped without a reason. It is the belt-and-suspenders that turns "added a pipeline with no e2e path" into a red `validate`.

- [ ] **Step 1: Write the guard test**

```ts
// src/__tests__/catalog/pipeline-e2e-coverage.test.ts
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { CATALOG_SECTIONS, seedAllCatalogs } from '@/lib/catalog/sections';
// Relative import (no @/ for an e2e helper): src/__tests__/catalog → repo-root e2e/helpers.
import { WALKER_SKIP } from '../../../e2e/helpers/pipeline-coverage';

describe('catalog-pipeline e2e coverage guard', () => {
  const pipelines = allCatalogPipelines();
  const seeded = seedAllCatalogs(); // { [catalogId]: { [entityId]: entity } }

  it('finds every registered pipeline (sanity: registry is non-empty)', () => {
    expect(pipelines.length).toBeGreaterThan(0);
  });

  it('every registered pipeline has a catalog section so the walker can find it', () => {
    const sectionIds = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
    const missing = pipelines.map((p) => p.catalogId).filter((id) => !sectionIds.has(id));
    expect(missing, `pipelines with no CATALOG_SECTIONS entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('every registered pipeline has >=1 seeded entity so the lab can open one', () => {
    const empty = pipelines
      .map((p) => p.catalogId)
      .filter((id) => Object.keys(seeded[id] ?? {}).length === 0);
    expect(empty, `pipelines with no seeded entity (walker has nothing to open): ${empty.join(', ')}`).toEqual([]);
  });

  it('every pipeline is either walked or skipped with a documented reason', () => {
    for (const p of pipelines) {
      const reason = WALKER_SKIP[p.catalogId];
      if (reason !== undefined) {
        expect(reason.trim().length, `WALKER_SKIP['${p.catalogId}'] must have a non-empty reason`).toBeGreaterThan(0);
      }
      // else: walked by the generic walker (catalog-pipeline-walker.spec.ts) — OK.
    }
  });

  it('WALKER_SKIP has no stale entries (every key is a real registered pipeline)', () => {
    const ids = new Set(pipelines.map((p) => p.catalogId));
    const stale = Object.keys(WALKER_SKIP).filter((id) => !ids.has(id));
    expect(stale, `WALKER_SKIP references unknown catalogs: ${stale.join(', ')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard**

Run: `npx vitest run src/__tests__/catalog/pipeline-e2e-coverage.test.ts`
Expected: PASS. If "every registered pipeline has a catalog section" or "has >=1 seeded entity" FAILS, that is a real finding — a registered pipeline that the lab cannot surface. Triage: either the pipeline's `catalogId` is wrong, or it needs a `CATALOG_SECTIONS` seed entry. Fix the data, do not weaken the guard.

- [ ] **Step 3: Confirm it runs inside validate's vitest scope**

Run: `npx vitest run src/__tests__/catalog/`
Expected: PASS (the new test is picked up by the default test glob).

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/catalog/pipeline-e2e-coverage.test.ts
git commit -m "test(catalog): guard that every registered pipeline is e2e-walkable"
```

---

## Task 4: Lab e2e helpers + alias probe

**Files:**
- Create: `e2e/helpers/lab-mode.ts`

- [ ] **Step 1: Probe Playwright's `@/` alias resolution before relying on it**

Create a throwaway probe `e2e/_alias-probe.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';

test('alias + registry import resolves in Playwright', async () => {
  expect(allCatalogPipelines().length).toBeGreaterThan(10);
});
```

Run: `npx playwright test e2e/_alias-probe.spec.ts --reporter=line`
Expected: PASS, printing 1 passed. (The dev server auto-starts via `webServer`.)

- **If it FAILS with a module-resolution error** for `@/...`: the registry import chain pulls a runtime `@/` that Playwright can't map. Fallback: in the walker (Task 5) and probe, import via repo-root-relative paths instead — `import '../src/lib/catalog/pipelines/registry.generated'` and `import { allCatalogPipelines } from '../src/lib/catalog/pipeline-registry'`. Re-run the probe with the relative form to confirm. Record which form worked; use it consistently in Task 5.

- [ ] **Step 2: Delete the probe once it passes**

```bash
rm e2e/_alias-probe.spec.ts
```

- [ ] **Step 3: Write the lab helpers**

```ts
// e2e/helpers/lab-mode.ts
import { expect, type Page, type APIRequestContext } from '@playwright/test';

export type StepStatus = 'pass' | 'fail' | 'deferred' | 'pending';

/** The lab is the homepage; wait for the LayoutLab root ready marker. */
export async function gotoLab(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('harness-lab-ready')).toBeVisible({ timeout: 30_000 });
}

/** The catalog tree opens only the selected category; expand every collapsed one
 *  so any `harness-catalog-*` button is clickable. */
export async function expandAllCategories(page: Page): Promise<void> {
  const tree = page.getByRole('tree', { name: 'Catalogs' });
  for (let i = 0; i < 30; i++) {
    const collapsed = tree.locator('button[aria-expanded="false"]');
    if ((await collapsed.count()) === 0) break;
    await collapsed.first().click();
  }
}

/** Select a catalog; the lab auto-shows entities[0]. Returns the active entity id. */
export async function openCatalog(page: Page, catalogId: string): Promise<string> {
  await expandAllCategories(page);
  await page.getByTestId(`harness-catalog-${catalogId}`).click();
  const canvas = page.locator('#lab-canvas');
  await expect(canvas).toHaveAttribute('data-active-entity-id', /.+/, { timeout: 10_000 });
  return (await canvas.getAttribute('data-active-entity-id')) ?? '';
}

export async function selectStep(page: Page, index: number): Promise<void> {
  await page.getByTestId(`step-dot-stamp-${index}`).click();
}

export async function acceptanceStatus(page: Page): Promise<StepStatus> {
  const banner = page.getByTestId('acceptance-banner');
  await expect(banner).toBeVisible({ timeout: 10_000 });
  return (await banner.getAttribute('data-status')) as StepStatus;
}

/** Click Produce for the current step; gallery steps also select the first candidate
 *  so the `selected` field populates and acceptance can derive. */
export async function produceStep(page: Page, isGallery: boolean): Promise<void> {
  await page.getByTestId('cli-produce-run').click();
  if (isGallery) {
    await page.locator('[data-testid^="candidate-"]').first().click();
  } else {
    await expect(page.getByTestId('cli-produce-result')).toBeVisible({ timeout: 10_000 });
  }
}

/** Poll the server until the step's persisted status equals the in-UI status. */
export async function expectPersisted(
  request: APIRequestContext,
  catalogId: string,
  entityId: string,
  step: string,
  status: StepStatus,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `/api/pipeline-artifacts?catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}`,
        );
        if (!res.ok()) return null;
        const body = (await res.json()) as { data?: Array<{ step: string; status: string }> };
        return body.data?.find((a) => a.step === step)?.status ?? null;
      },
      { timeout: 10_000, message: `${catalogId} · ${step} did not persist with status ${status}` },
    )
    .toBe(status);
}
```

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers/lab-mode.ts
git commit -m "test(lab): add catalog-pipeline e2e helpers (goto/open/produce/persist)"
```

---

## Task 5: The pipeline walker spec

**Files:**
- Create: `e2e/catalog-pipeline-walker.spec.ts`

Uses the import form confirmed in Task 4 (shown here with `@/`; swap to `../src/...` if the probe required it).

- [ ] **Step 1: Write the walker**

```ts
// e2e/catalog-pipeline-walker.spec.ts
import { test, expect } from '@playwright/test';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { WALKER_SKIP } from './helpers/pipeline-coverage';
import {
  gotoLab, openCatalog, selectStep, produceStep, acceptanceStatus, expectPersisted, type StepStatus,
} from './helpers/lab-mode';

/**
 * Data-driven walker: every registered catalog pipeline, walked through the real
 * /layout lab UI in stub mode. Per step it asserts the config-complete terminal
 * rule — status ∈ {pass, deferred}, never fail/pending — and that the artifact
 * persisted to SQLite. A second test proves the persisted statuses hydrate from
 * the server after the local cache is wiped. Items is delegated to its bespoke
 * reference spec (WALKER_SKIP).
 */

const CONFIG_COMPLETE = new Set<StepStatus>(['pass', 'deferred']);

for (const pipeline of allCatalogPipelines()) {
  const { catalogId, steps } = pipeline;

  test.describe(`catalog pipeline: ${catalogId}`, () => {
    test.skip(WALKER_SKIP[catalogId] !== undefined, WALKER_SKIP[catalogId]);

    test(`walks ${steps.length} steps to config-complete acceptance + persists`, async ({ page, request }) => {
      await gotoLab(page);
      const entityId = await openCatalog(page, catalogId);
      expect(entityId, `${catalogId}: no openable entity`).not.toBe('');

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await selectStep(page, i);
        await produceStep(page, step.view.kind === 'gallery');

        const status = await acceptanceStatus(page);
        expect
          .soft(CONFIG_COMPLETE.has(status), `${catalogId} · ${step.label}: "${status}" is not config-complete (want pass|deferred)`)
          .toBe(true);

        if (status === 'deferred') {
          // Rule 4: a deferred gate must explain itself (StepSpec attaches L3/L4 + reason).
          await expect
            .soft(page.getByTestId('acceptance-banner'))
            .toContainText(/L[34]/);
        }

        await expectPersisted(request, catalogId, entityId, step.label, status);
      }
    });

    test('persisted statuses hydrate from the server after a cache wipe + reload', async ({ page }) => {
      await gotoLab(page);
      const entityId = await openCatalog(page, catalogId);
      expect(entityId).not.toBe('');

      // Produce every step so the server holds this entity's full pipeline.
      for (let i = 0; i < steps.length; i++) {
        await selectStep(page, i);
        await produceStep(page, steps[i].view.kind === 'gallery');
        await expect(page.getByTestId('acceptance-banner')).toBeVisible();
      }
      const before: StepStatus[] = [];
      for (let i = 0; i < steps.length; i++) {
        await selectStep(page, i);
        before.push(await acceptanceStatus(page));
      }

      // Wipe the local pipeline cache → the only source left is the server.
      await page.evaluate(() => localStorage.removeItem('pof-lab-pipeline'));
      await gotoLab(page);
      await openCatalog(page, catalogId);

      for (let i = 0; i < steps.length; i++) {
        await selectStep(page, i);
        // Hydrate is async on entity open; poll until it settles to the stored value.
        await expect
          .poll(() => acceptanceStatus(page), {
            timeout: 10_000,
            message: `${catalogId} · ${steps[i].label} did not hydrate from server`,
          })
          .toBe(before[i]);
      }
    });
  });
}
```

- [ ] **Step 2: Run ONE catalog to validate the mechanism end-to-end**

Pick a simple non-gallery catalog (e.g. `currency`). Run:
`npx playwright test e2e/catalog-pipeline-walker.spec.ts -g "catalog pipeline: currency" --reporter=line`
Expected: PASS. If a step is `pending`/`fail`, triage (Task 7).

- [ ] **Step 3: Commit**

```bash
git add e2e/catalog-pipeline-walker.spec.ts
git commit -m "test(catalog): data-driven e2e walker over all registered pipelines"
```

---

## Task 6: Items reference spec

**Files:**
- Create: `e2e/catalog-items-reference.spec.ts`

Deep-walks the bespoke 13-step Items pipeline. The Items step labels live in `ITEM_STEP_NAMES` (`steps/itemsSteps.ts`); drive by step index via `step-dot-stamp-${i}` and assert tailored behaviors.

- [ ] **Step 1: Write the Items reference spec**

```ts
// e2e/catalog-items-reference.spec.ts
import { test, expect } from '@playwright/test';
import {
  gotoLab, openCatalog, selectStep, produceStep, acceptanceStatus, expectPersisted, type StepStatus,
} from './helpers/lab-mode';

/**
 * Items is the REFERENCE pipeline (13 bespoke step UIs). This deep-walks it with
 * tailored assertions the generic walker can't make, and is why `items` is in
 * WALKER_SKIP. Uses the "Populate demo" affordance where present, else walks step
 * by step. The default entity is item-1 (Iron Longsword).
 */

const CONFIG_COMPLETE = new Set<StepStatus>(['pass', 'deferred']);

test.describe('catalog pipeline: items (reference)', () => {
  test('walks all 13 steps to config-complete acceptance + persists each', async ({ page, request }) => {
    await gotoLab(page);
    const entityId = await openCatalog(page, 'items');
    expect(entityId).not.toBe('');

    // Step count is read from the rendered rail (Items uses its curated label list).
    const stepCount = await page.locator('[data-testid^="step-dot-stamp-"]').count();
    expect(stepCount, 'Items should render its full bespoke pipeline').toBe(13);

    for (let i = 0; i < stepCount; i++) {
      await selectStep(page, i);
      // Items step 4 (Icon 2D) and 5 (3D Mesh) are gallery; detect by the gallery testid.
      const isGallery = (await page.getByTestId('candidate-gallery').count()) > 0
        || (await page.getByTestId('candidate-gallery-empty').count()) > 0;
      await produceStep(page, isGallery);

      const status = await acceptanceStatus(page);
      expect.soft(CONFIG_COMPLETE.has(status), `items step ${i + 1}: "${status}"`).toBe(true);
    }
  });

  test('Test Gate is honestly deferred to its runtime functional test', async ({ page }) => {
    await gotoLab(page);
    await openCatalog(page, 'items');
    // Test Gate is the 12th step (index 11) in ITEM_STEP_NAMES order.
    await selectStep(page, 11);
    await produceStep(page, false);
    expect(await acceptanceStatus(page)).toBe('deferred');
    await expect(page.getByTestId('acceptance-banner')).toContainText(/L3/);
  });
});
```

- [ ] **Step 2: Run the Items reference spec**

Run: `npx playwright test e2e/catalog-items-reference.spec.ts --reporter=line`
Expected: PASS. If the gallery detection or the Test-Gate index is off, fix against the actual `ITEM_STEP_NAMES` order (read `src/components/layout-lab/steps/itemsSteps.ts`).

- [ ] **Step 3: Commit**

```bash
git add e2e/catalog-items-reference.spec.ts
git commit -m "test(catalog): bespoke deep e2e for the Items reference pipeline"
```

---

## Task 7: Full run + triage

**Files:** none (execution + targeted fixes).

- [ ] **Step 1: Run the whole catalog e2e suite**

Run: `npx playwright test e2e/catalog-pipeline-walker.spec.ts e2e/catalog-items-reference.spec.ts --reporter=line`
Expected: all green. Because `expect.soft` is used in the walker, a single bad step won't abort a catalog — the run surfaces every offending `catalogId · step`.

- [ ] **Step 2: Triage any non-`{pass,deferred}` step**

For each reported failure decide which it is:
- **Real regression** (a Produce/checker that the lab genuinely breaks): fix the pipeline/step code. This is the bug the e2e was built to catch — file it / fix it.
- **Walker mechanics** (e.g. a gallery step not detected, an async race): fix the helper/spec.
- **Genuinely unwalkable in stub mode** (needs a live bridge to even render): add the catalog to `WALKER_SKIP` with a precise reason, and confirm the guard (Task 3) still passes. Do this only as a last resort and never to hide a real failure.

- [ ] **Step 3: Re-run until green**

Run: `npx playwright test e2e/catalog-pipeline-walker.spec.ts e2e/catalog-items-reference.spec.ts --reporter=line`
Expected: PASS.

- [ ] **Step 4: Commit any triage fixes**

```bash
git add -A   # only the files you touched during triage
git commit -m "test(catalog): triage walker findings to green"
```

---

## Task 8: CLAUDE.md rule + doc sync

**Files:**
- Modify: `.claude/CLAUDE.md`
- Modify: `docs/README.md` (doc map) and/or `docs/catalog/PIPELINE_REVIEW.md` (cross-reference)

- [ ] **Step 1: Add Rule 5 to the Catalog Pipeline Step Authoring section**

In `.claude/CLAUDE.md`, after **Rule 4 — Every step is tested + truthful**, add:

```markdown
**Rule 5 — Every pipeline is e2e-walked.** Every registered catalog pipeline is exercised end-to-end through the real `/layout` lab by the data-driven walker `e2e/catalog-pipeline-walker.spec.ts` (the Items reference pipeline by `e2e/catalog-items-reference.spec.ts`). The walker enumerates `allCatalogPipelines()`, so a **new pipeline is auto-covered** the moment it self-registers — you do not write a new spec. Your obligations when authoring a pipeline:
- Keep **≥1 seeded entity** for the catalog in `CATALOG_SECTIONS` (the walker opens `entities[0]`).
- Each step's Produce must drive its Acceptance to a **config-complete terminal status**: `pass` for L0/L1/L2 (data/selection/static), `deferred` for L3/L4 (runtime/visual) — **never `fail`/`pending`** after a clean Produce. `deferred` must carry a reason (Rule 4).
- Keep the guard `src/__tests__/catalog/pipeline-e2e-coverage.test.ts` green (it runs in `npm run validate`). It fails if your pipeline has no seeded entity or is skipped without a reason.
- If a step genuinely cannot be walked in stub mode, add the catalog to `WALKER_SKIP` in `e2e/helpers/pipeline-coverage.ts` **with a precise reason** — never to mask a real failure.

Run the catalog e2e with `npm run test:e2e` (Playwright, real dev server + SQLite, stub mode — no Claude CLI / UE bridge). It is intentionally **not** part of `npm run validate` (vitest-only); the guard test is the fast `validate`-time enforcement.
```

- [ ] **Step 2: Doc-sync the catalog reference**

In `docs/README.md`, add the walker/guard to the catalog test surface (one line under the catalog-pipeline docs pointer). In `docs/catalog/PIPELINE_REVIEW.md` (or `WIRING-AND-ACCEPTANCE.md`), add a short "E2E coverage" note pointing at `e2e/catalog-pipeline-walker.spec.ts` + the guard. Keep it to 2-3 sentences (docs mirror code — Rule from CLAUDE.md).

- [ ] **Step 3: Commit**

```bash
git add .claude/CLAUDE.md docs/README.md docs/catalog/PIPELINE_REVIEW.md
git commit -m "docs(catalog): Rule 5 — every pipeline is e2e-walked (walker + guard)"
```

---

## Task 9: Final verification

**Files:** none.

- [ ] **Step 1: Guard runs inside validate's vitest**

Run: `npx vitest run src/__tests__/catalog/pipeline-e2e-coverage.test.ts`
Expected: PASS.

- [ ] **Step 2: Typecheck + lint the new/changed files**

Run: `npm run typecheck && npm run lint`
Expected: PASS (lint may warn on pre-existing foreign files in the shared tree — confirm the new e2e/test files are clean).

- [ ] **Step 3: Full catalog e2e green**

Run: `npm run test:e2e -- e2e/catalog-pipeline-walker.spec.ts e2e/catalog-items-reference.spec.ts`
Expected: PASS, all registered pipelines (minus documented skips) walked + persisted + hydrated.

- [ ] **Step 4: Report**

Summarize: pipelines covered (count), any documented skips (with reasons), guard status, and where the harness is documented (CLAUDE.md Rule 5).

---

## Self-review notes (author)

- **Spec coverage:** Hybrid (walker = Task 5 + helpers Task 4; Items reference = Task 6) ✓; deep pass+persist+hydrate (Task 5 both tests) ✓; guard + CLAUDE.md (Task 3 + Task 8) ✓; stub mode (Task 4 helpers, no CLI) ✓; tier-aware pass/deferred (CONFIG_COMPLETE set) ✓; minimal instrumentation (Task 1) ✓.
- **Type consistency:** `StepStatus` defined once in `lab-mode.ts`, imported by both specs; `WALKER_SKIP` defined once in `pipeline-coverage.ts`, imported by walker + guard; helper names (`gotoLab/openCatalog/selectStep/produceStep/acceptanceStatus/expectPersisted`) used identically across Tasks 5-6.
- **Known risk:** Task 4 probes `@/` resolution in Playwright with a documented relative-path fallback; the plan does not assume it works.
- **Known risk:** Task 7 explicitly handles steps that don't reach `{pass,deferred}` with the default seed — triaged as real bug vs. mechanics vs. documented skip, never silently hidden.
