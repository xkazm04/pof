/**
 * Visual Verification Gate — uses Playwright to screenshot the app
 * and check for render errors after harness executor sessions.
 *
 * Runs as a VerificationGate of type 'visual'. The gate:
 * 1. Navigates to the app's core engine modules
 * 2. Takes screenshots of each module's unique tab
 * 3. Checks for React error boundaries, blank screens, JS errors
 * 4. Saves screenshots to .harness-ui/screenshots/<iteration>/
 *
 * Requires: dev server running on localhost:3000
 * Requires: @playwright/test installed (already a devDep)
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';

// ── Types ───────────────────────────────────────────────────────────────────

interface VisualCheckResult {
  passed: boolean;
  modulesChecked: number;
  errors: string[];
  screenshots: string[];
  durationMs: number;
}

// ── Playwright Script ───────────────────────────────────────────────────────

/**
 * Generate a standalone Playwright script that checks all core engine modules.
 * We write this to a temp file and run it via `npx playwright test` rather than
 * importing Playwright directly (avoids ESM/CJS conflicts in the harness process).
 */
function generateVisualCheckScript(
  screenshotDir: string,
  baseURL: string,
): string {
  // Escape backslashes for Windows paths in the generated script
  const dir = screenshotDir.replace(/\\/g, '/');

  return `
import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const SCREENSHOT_DIR = '${dir}';
const MODULES = [
  'Character', 'Animation', 'Ability', 'Combat',
  'Enemy', 'Items', 'Loot',
];

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Visual Gate', () => {
  test.setTimeout(120000);

  test('all core modules render without errors', async ({ page }) => {
    const errors: string[] = [];

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text().slice(0, 200));
      }
    });

    // Collect page crashes
    page.on('pageerror', err => {
      errors.push('PAGE ERROR: ' + err.message.slice(0, 200));
    });

    // Navigate to app
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

    // Click PoF project if launcher shown
    try {
      const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
      await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
      await pofBtn.click();
      await page.waitForTimeout(2000);
    } catch { /* already past launcher */ }

    // Click Core Engine in L1 sidebar
    const coreBtn = page.getByRole('button', { name: 'Core Engine' });
    await coreBtn.waitFor({ state: 'visible', timeout: 15000 });
    await coreBtn.click();
    await page.waitForTimeout(1000);

    let modulesChecked = 0;

    for (const mod of MODULES) {
      // Click module in sidebar
      const moduleBtn = page.locator('nav button, nav [role="button"], nav div[class*="cursor"]')
        .filter({ hasText: mod }).first();

      try {
        await moduleBtn.waitFor({ state: 'visible', timeout: 5000 });
        await moduleBtn.click();
        await page.waitForTimeout(1500);
      } catch {
        errors.push('MODULE_NOT_FOUND: ' + mod);
        continue;
      }

      // Check for React error boundaries
      const errorBoundary = page.locator('[class*="error"], [data-error], text="Something went wrong"');
      const hasError = await errorBoundary.count() > 0;
      if (hasError) {
        errors.push('ERROR_BOUNDARY: ' + mod);
      }

      // Check page is not blank (has at least some content)
      const bodyText = await page.locator('main, [role="main"], #__next').first().innerText().catch(() => '');
      if (bodyText.trim().length < 10) {
        errors.push('BLANK_SCREEN: ' + mod);
      }

      // Screenshot
      await page.screenshot({
        path: SCREENSHOT_DIR + '/' + mod.toLowerCase() + '.png',
        fullPage: false,
      });

      modulesChecked++;
    }

    // Write results file for harness to read
    const result = {
      passed: errors.length === 0,
      modulesChecked,
      errors,
    };
    fs.writeFileSync(SCREENSHOT_DIR + '/result.json', JSON.stringify(result, null, 2));

    // Assert no critical errors (error boundaries, blank screens)
    const criticalErrors = errors.filter(e =>
      e.startsWith('ERROR_BOUNDARY') || e.startsWith('BLANK_SCREEN') || e.startsWith('PAGE ERROR')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the visual verification gate.
 * Returns a result compatible with the harness verifier.
 */
export async function runVisualGate(
  projectPath: string,
  statePath: string,
  iteration: number,
): Promise<{ passed: boolean; output: string; durationMs: number; errors?: Array<{ message: string }> }> {
  const start = Date.now();
  const screenshotDir = path.join(statePath, 'screenshots', String(iteration));
  const scriptPath = path.join(statePath, '_visual-gate.spec.ts');
  const baseURL = 'http://localhost:3000';

  // Write the Playwright test script
  const script = generateVisualCheckScript(screenshotDir, baseURL);
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, script);

  // Run via npx playwright test
  return new Promise((resolve) => {
    const proc = exec(
      `npx playwright test "${scriptPath}" --reporter=line --timeout=120000`,
      {
        cwd: projectPath,
        timeout: 180_000,
        maxBuffer: 5 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        const combinedOutput = [stdout, stderr].filter(Boolean).join('\n');

        // Try to read the result file
        const resultPath = path.join(screenshotDir, 'result.json');
        let result: VisualCheckResult | null = null;
        try {
          if (fs.existsSync(resultPath)) {
            result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
          }
        } catch { /* ignore parse errors */ }

        if (result) {
          resolve({
            passed: result.passed,
            output: `Visual check: ${result.modulesChecked} modules, ${result.errors.length} errors. Screenshots: ${screenshotDir}`,
            durationMs,
            errors: result.errors.length > 0
              ? result.errors.map(e => ({ message: e }))
              : undefined,
          });
        } else {
          // Playwright itself failed (maybe no dev server)
          const passed = error === null;
          resolve({
            passed,
            output: passed
              ? `Visual gate passed (no result file). ${combinedOutput.slice(0, 500)}`
              : `Visual gate failed to run: ${combinedOutput.slice(0, 1000)}`,
            durationMs,
            errors: error ? [{ message: combinedOutput.slice(0, 500) }] : undefined,
          });
        }
      },
    );

    // Safety kill
    setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch { /* already dead */ }
    }, 181_000);
  });
}

/**
 * Create a visual VerificationGate config for the harness.
 * This is advisory (not required) — won't block progress but will record issues.
 */
export function createVisualGate(): {
  name: string;
  type: 'visual';
  required: boolean;
  command?: string;
} {
  return {
    name: 'visual-check',
    type: 'visual',
    required: false, // Advisory — captures issues but doesn't block
  };
}
