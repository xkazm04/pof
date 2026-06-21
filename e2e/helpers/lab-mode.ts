import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { POF_READY_TESTID } from './pof-identity';

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
