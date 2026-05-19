import { test, expect, type Page } from '@playwright/test';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { setupHarnessMode, waitForCliComplete, seedPackagingProfile, type HarnessHandle, type StepResult } from './helpers/harness-mode';

const PROJECT_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const STEP_TIMEOUT_MS = 10 * 60_000;

async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  try {
    const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
    await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pofBtn.click();
    await page.waitForTimeout(2000);
  } catch { /* already past launcher */ }
}

async function runLiveStep(
  harness: HarnessHandle,
  page: Page,
  label: string,
  body: () => Promise<{ success: boolean; durationMs: number; timedOut: boolean; notes?: string }>,
): Promise<void> {
  await test.step(label, async () => {
    harness.setStepLabel(label);
    const result = await body();
    await harness.drainCliDispatches(page);
    harness.recordStepResult({
      step: label,
      status: result.timedOut ? 'fail' : (result.success ? 'pass' : 'fail'),
      durationMs: result.durationMs,
      notes: result.notes,
    });
  });
}

test.describe('ARPG vertical slice — D2 live attempt', () => {
  test.setTimeout(30 * 60_000);

  test('attempts Step 6 + Step 8 ih-1 in live mode', async ({ page }) => {
    expect(
      process.env.HARNESS_MODE,
      'D2 live spec requires HARNESS_MODE=live; run with HARNESS_MODE=live npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts',
    ).toBe('live');

    const harness = await setupHarnessMode(page);

    try {
      await runLiveStep(harness, page, 'Step 6 (LIVE): Verify build', async () => {
        await enterWorkspace(page);
        await page.getByTestId('pof-sidebar-nav-item-project-setup').click();
        const verifyBtn = page.getByTestId('pof-setup-wizard-build-verify-btn');
        const verifyCount = await verifyBtn.count();
        if (verifyCount === 0) {
          return { success: false, durationMs: 0, timedOut: false, notes: 'pof-setup-wizard-build-verify-btn not visible — Step 6 cannot dispatch' };
        }
        await verifyBtn.click();
        const result = await waitForCliComplete(page, 'build-verify', STEP_TIMEOUT_MS);
        return {
          success: result.success,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          notes: result.outputExcerpt ?? '',
        };
      });

      await runLiveStep(harness, page, 'Step 8 ih-1 (LIVE): Input Actions', async () => {
        await page.getByTestId('pof-sidebar-nav-item-game-systems').click();
        await page.getByTestId('pof-sidebar-l2-nav-item-input-handling').click();
        await page.getByRole('tab', { name: 'Roadmap' }).click();
        await page.waitForTimeout(500);

        // D3: switch to Cards layout — per-row "Claude" button only renders there
        // and has an accessible name. Compact layout (default) uses an icon-only
        // Play button with no text/aria-label that's hard to locate uniquely.
        // Cards toggle has title="Card view" per RoadmapChecklist.tsx:331-337.
        await page.getByRole('button', { name: 'Card view' }).click();
        await page.waitForTimeout(300);

        const ih1 = page.getByTestId('pof-module-input-handling-checklist-item-ih-1');
        const ih1Count = await ih1.count();
        if (ih1Count === 0) {
          return { success: false, durationMs: 0, timedOut: false, notes: 'pof-module-input-handling-checklist-item-ih-1 not visible after layout switch' };
        }

        // Hover the row to reveal hover-only action buttons.
        // Cards: opacity-30 → group-hover:opacity-100 at RoadmapChecklist.tsx:613.
        await ih1.hover();

        // Locate by accessible name (AccentButton text "Claude" at RoadmapChecklist.tsx:656).
        const claudeBtn = ih1.getByRole('button', { name: /^Claude$/i });
        const btnCount = await claudeBtn.count();
        if (btnCount === 0) {
          return { success: false, durationMs: 0, timedOut: false, notes: 'No "Claude" button inside ih-1 row (Cards layout); hover may not have triggered the visibility change' };
        }
        await claudeBtn.click();
        const result = await waitForCliComplete(page, 'input-handling-ih-1', STEP_TIMEOUT_MS);

        const expectedPaths = [
          join(PROJECT_PATH, 'Content', 'Input', 'Actions', 'IA_Move.uasset'),
          join(PROJECT_PATH, 'Content', 'Input', 'Actions', 'IA_Attack.uasset'),
        ];
        const found: string[] = [];
        const missing: string[] = [];
        for (const p of expectedPaths) {
          try {
            await stat(p);
            found.push(p);
          } catch {
            missing.push(p);
          }
        }
        const artifactCheck = `\nArtifact check: found=${found.length} missing=${missing.length}\n` +
          (found.length > 0 ? `  Found: ${found.join(', ')}\n` : '') +
          (missing.length > 0 ? `  Missing: ${missing.join(', ')}\n` : '');

        return {
          success: result.success && missing.length === 0,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          notes: (result.outputExcerpt ?? '') + artifactCheck,
        };
      });
    } finally {
      await harness.writeFindings({ filenameSuffix: 'd3' });
    }
  });
});
