import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { POF_READY_TESTID } from './pof-identity';
import { PRODUCE_DIRECTION_KEY } from '@/lib/catalog/produceDirection';

export type StepStatus = 'pass' | 'fail' | 'deferred' | 'pending';

/** The lab is the homepage; wait for the LayoutLab root ready marker. */
export async function gotoLab(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(POF_READY_TESTID)).toBeVisible({ timeout: 30_000 });
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

/** The lab opens a catalog to `entities[0]` (the first seeded entity, since selecting a
 *  catalog clears the entity selection). We derive that entity from the same seed the
 *  store hydrates from — so we need no app-specific DOM hook to know which entity is open. */
function firstSeededEntity(catalogId: string): { id: string; name: string } {
  const e = Object.values(seedAllCatalogs()[catalogId] ?? {})[0] as { id: string; name: string } | undefined;
  return { id: e?.id ?? '', name: e?.name ?? '' };
}

/** Select a catalog; the lab auto-shows entities[0]. Returns that entity's id. */
export async function openCatalog(page: Page, catalogId: string): Promise<string> {
  await expandAllCategories(page);
  const { id, name } = firstSeededEntity(catalogId);
  await page.getByTestId(`harness-catalog-${catalogId}`).click();
  // Confirm the switch landed: the canvas <h1> shows the opened entity's name.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name, { timeout: 10_000 });
  return id;
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
 *  so the `selected` field populates and acceptance can derive.
 *  `direction` (optional) is typed into the step's Direction text area first, so the walker
 *  can prove the operator's input reaches the produced artifact (`data.produceDirection`). */
export async function produceStep(page: Page, isGallery: boolean, direction?: string): Promise<void> {
  if (direction != null) await page.getByTestId('cli-produce-direction').fill(direction);
  await page.getByTestId('cli-produce-run').click();
  if (isGallery) {
    await page.locator('[data-testid^="candidate-"]').first().click();
  } else {
    await expect(page.getByTestId('cli-produce-result')).toBeVisible({ timeout: 10_000 });
  }
}

/** Poll the server until the step's persisted artifact carries the typed direction VERBATIM.
 *  Proves the direction is a real produce input, not a write-only textarea. */
export async function expectPersistedDirection(
  request: APIRequestContext,
  catalogId: string,
  entityId: string,
  step: string,
  direction: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `/api/pipeline-artifacts?catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}`,
        );
        if (!res.ok()) return null;
        const body = (await res.json()) as { data?: Array<{ step: string; data?: Record<string, unknown> }> };
        const art = body.data?.find((a) => a.step === step);
        const stamp = art?.data?.[PRODUCE_DIRECTION_KEY] as { direction?: string } | undefined;
        return stamp?.direction ?? null;
      },
      { timeout: 10_000, message: `${catalogId} · ${step} did not persist the typed direction` },
    )
    .toBe(direction);
}

/**
 * Poll the server until the step's artifact exists, then assert the PERSISTED status
 * against its OWN source of truth.
 *
 * ── Why this is not `persisted === on-screen` ──────────────────────────────────
 * The two are DIFFERENT verdicts by design, and asserting they are equal is structurally
 * unsatisfiable the moment a judge verdict exists:
 *
 *  - the persisted row holds the **pure Checker verdict** (`POST /api/pipeline-artifacts`
 *    re-grades the submitted data and stores `graded.raw` — judge state lives apart in
 *    `judge_verdicts` and is deliberately NOT folded in);
 *  - the on-screen banner shows the **bridged** verdict (`resolveStepAcceptance` =
 *    checker → server drain overlay → judge bridge), so a content-bound judge FAIL turns a
 *    checker `pass` red on screen while the row correctly still says `pass`.
 *
 * So each truth is asserted against the rule that governs it: both must be
 * config-complete (Rule 5), and the walker checks the on-screen one separately. Equality is
 * never claimed.
 */
export async function expectPersistedConfigComplete(
  request: APIRequestContext,
  catalogId: string,
  entityId: string,
  step: string,
  allowed: ReadonlySet<StepStatus>,
): Promise<void> {
  let seen: string | null = null;
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `/api/pipeline-artifacts?catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}`,
        );
        if (!res.ok()) return null;
        const body = (await res.json()) as { data?: Array<{ step: string; status: string }> };
        seen = body.data?.find((a) => a.step === step)?.status ?? null;
        return seen;
      },
      { timeout: 10_000, message: `${catalogId} · ${step} never reached the server (no persisted artifact row)` },
    )
    .not.toBeNull();

  expect
    .soft(
      allowed.has(seen as unknown as StepStatus),
      `${catalogId} · ${step}: persisted (pure-checker) status "${seen}" is not config-complete ` +
        `(want ${[...allowed].join('|')}). This is the SERVER's own truth — the on-screen banner is ` +
        `asserted separately and may legitimately differ (judge bridge).`,
    )
    .toBe(true);
}
