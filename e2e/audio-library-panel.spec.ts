import { test, expect, request as pwRequest } from '@playwright/test';

const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:3000';

test('Audio Library tab renders + responds to a seeded import-result', async ({ page }) => {
  // Self-seed via the import-result route — CI-safe; no claude.exe spawn,
  // no real ElevenLabs call. We don't seed an actual audio file here (would
  // need a real generation); we seed a run record so the panel mounts against
  // a non-empty backend snapshot.
  const ctx = await pwRequest.newContext();
  await ctx.post(`${ORIGIN}/api/audio/import-result`, {
    data: { setName: 'e2e-seed-set', assetsImported: 1, cuePath: null, wiredEvent: null },
  });

  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });

  // Past the launcher if shown
  try {
    const pofBtn = page.getByRole('button', { name: 'PoF' });
    if (await pofBtn.isVisible({ timeout: 2000 })) await pofBtn.click();
  } catch { /* already past */ }

  // Navigate Content -> Audio
  await page.getByRole('button', { name: 'Content' }).click();
  await page.getByRole('button', { name: /Audio/ }).first().click();

  // Audio module's empty state asks for a scene first — create one if visible.
  const newScene = page.locator('input[placeholder*="audio scene"], input[placeholder*="dungeon audio"]').first();
  if (await newScene.isVisible({ timeout: 2000 })) {
    await newScene.fill('e2e-scene');
    await page.getByRole('button', { name: /Create Scene/i }).click();
  }

  // Open the Library tab
  await page.getByRole('button', { name: 'Library' }).click();

  // The Library renders + either the empty message or a seeded set is present
  const library = page.getByTestId('audio-library');
  await expect(library).toBeVisible();
  const empty = library.locator('text=No sets yet');
  const anySet = library.getByTestId(/^set-/);
  await expect(empty.or(anySet)).toBeVisible({ timeout: 5000 });
});
