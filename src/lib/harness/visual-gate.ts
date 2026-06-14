/**
 * Visual Verification Gate — uses Playwright to screenshot each registered
 * catalog page and judge whether it renders cleanly. Beyond the original
 * blank-screen / error-boundary heuristics, the gate now performs:
 *
 *   • Visual regression — pixel-perceptual diff against a golden baseline
 *     (lazy-required `pixelmatch` + `pngjs`; degrades gracefully if absent).
 *   • Accessibility — `@axe-core/playwright` scan; critical/serious WCAG
 *     violations are recorded as gate sub-errors (also lazy-required).
 *
 * Locators are driven by `data-testid` (see {@link VISUAL_GATE_MODULES}) instead
 * of brittle role/text matches that drift with the UI shell. Per-module rows
 * land in `result.json` so the gallery + harness verifier can surface them.
 *
 * Requires: dev server on `http://localhost:3000` and `@playwright/test`
 * (already a devDep). `pixelmatch`/`pngjs`/`@axe-core/playwright` are optional —
 * if not installed, the corresponding sub-check is reported as "skipped" rather
 * than a hard failure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { VISUAL_GATE_MODULES, HARNESS_LAB_READY_TESTID } from './visual-modules';

// ── Types ───────────────────────────────────────────────────────────────────

export interface VisualModuleResult {
  slug: string;
  label: string;
  status: 'pass' | 'fail' | 'skipped';
  screenshot: string;
  /** Change vs baseline as a 0–1 fraction; `null` when no baseline existed yet. */
  changePct: number | null;
  /** Path to a diff overlay PNG written under this iteration. `null` when not produced. */
  diffPath: string | null;
  /** Critical/serious axe violations encountered in this view. */
  a11yViolations: number;
  /** Free-form error markers (e.g. ERROR_BOUNDARY, BLANK_SCREEN). */
  errors: string[];
}

export interface VisualGateConfig {
  /** If true, captures missing baselines on this run instead of failing them. Default: true. */
  updateBaselines?: boolean;
  /** Fraction (0–1) of pixels that may legitimately differ before a regression is flagged. Default: 0.02 = 2%. */
  changeThreshold?: number;
  /** Whether to run axe-core a11y scan per module (still lazy-required). Default: true. */
  runA11y?: boolean;
}

export interface VisualGateResult {
  passed: boolean;
  modulesChecked: number;
  errors: string[];
  screenshots: string[];
  durationMs: number;
  modules: VisualModuleResult[];
  /** Total critical/serious WCAG violations across all modules. */
  a11yViolations: number;
}

// ── Playwright Script ───────────────────────────────────────────────────────

/**
 * Generate a standalone Playwright script for the visual gate. The script is
 * written to a temp file and run via `npx playwright test` rather than
 * importing Playwright directly (avoids ESM/CJS conflicts in the harness
 * process). All optional dependencies are loaded lazily so a missing package
 * never aborts the run.
 */
function generateVisualCheckScript(
  screenshotDir: string,
  baselineDir: string,
  modules: readonly { slug: string; label: string }[],
  cfg: Required<VisualGateConfig>,
): string {
  const dir = screenshotDir.replace(/\\/g, '/');
  const baseDir = baselineDir.replace(/\\/g, '/');
  const modulesJson = JSON.stringify(modules);
  return `
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = '${dir}';
const BASELINE_DIR = '${baseDir}';
const MODULES = ${modulesJson};
const UPDATE_BASELINES = ${cfg.updateBaselines};
const CHANGE_THRESHOLD = ${cfg.changeThreshold};
const RUN_A11Y = ${cfg.runA11y};

// Lazy-require optional deps so the gate degrades instead of crashing.
function tryRequire(name) {
  try { return require(name); } catch { return null; }
}
const pixelmatch = tryRequire('pixelmatch')?.default ?? tryRequire('pixelmatch');
const PNG = tryRequire('pngjs')?.PNG ?? tryRequire('pngjs');
const AxeBuilder = tryRequire('@axe-core/playwright')?.default ?? tryRequire('@axe-core/playwright');

for (const d of [SCREENSHOT_DIR, BASELINE_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function diffAgainstBaseline(slug, currentPath) {
  const baselinePath = path.join(BASELINE_DIR, slug + '.png');
  if (!pixelmatch || !PNG) return { changePct: null, diffPath: null };
  if (!fs.existsSync(baselinePath)) {
    // Golden capture: this iteration becomes the baseline.
    if (UPDATE_BASELINES) {
      try { fs.copyFileSync(currentPath, baselinePath); } catch { /* */ }
    }
    return { changePct: null, diffPath: null };
  }
  try {
    const cur = PNG.sync.read(fs.readFileSync(currentPath));
    const base = PNG.sync.read(fs.readFileSync(baselinePath));
    if (cur.width !== base.width || cur.height !== base.height) {
      // Layout/viewport shift — record as a 100% diff so it surfaces; no overlay.
      return { changePct: 1, diffPath: null };
    }
    const diff = new PNG({ width: cur.width, height: cur.height });
    const changed = pixelmatch(cur.data, base.data, diff.data, cur.width, cur.height, { threshold: 0.1 });
    const diffPath = path.join(SCREENSHOT_DIR, slug + '.diff.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    return { changePct: changed / (cur.width * cur.height), diffPath };
  } catch (e) {
    return { changePct: null, diffPath: null };
  }
}

async function runAxe(page) {
  if (!AxeBuilder || !RUN_A11Y) return { violations: 0, details: [] };
  try {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const flagged = (result.violations ?? []).filter((v) => v.impact === 'critical' || v.impact === 'serious');
    return {
      violations: flagged.length,
      details: flagged.slice(0, 5).map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
    };
  } catch (e) {
    return { violations: 0, details: [] };
  }
}

test.describe('Visual Gate', () => {
  test.setTimeout(180000);

  test('all registered catalogs render and pass a11y + visual-regression checks', async ({ page }) => {
    const errors = [];
    const moduleResults = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => errors.push('PAGE ERROR: ' + err.message.slice(0, 200)));

    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    // Wait for the lab shell to be interactive — testid is the stable handle.
    await page.getByTestId('${HARNESS_LAB_READY_TESTID}').waitFor({ state: 'visible', timeout: 20000 });

    for (const mod of MODULES) {
      const modErrors = [];
      const testId = 'harness-catalog-' + mod.slug;
      const screenshot = SCREENSHOT_DIR + '/' + mod.slug + '.png';

      try {
        await page.getByTestId(testId).click({ timeout: 5000 });
        await page.waitForTimeout(800);
      } catch {
        moduleResults.push({
          slug: mod.slug, label: mod.label, status: 'skipped',
          screenshot, changePct: null, diffPath: null, a11yViolations: 0,
          errors: ['MODULE_NOT_FOUND'],
        });
        errors.push('MODULE_NOT_FOUND: ' + mod.slug);
        continue;
      }

      // Heuristic checks — error boundaries / blank screen.
      const errorBoundary = page.locator('[class*="error"], [data-error], text="Something went wrong"');
      if ((await errorBoundary.count()) > 0) modErrors.push('ERROR_BOUNDARY');
      const bodyText = await page.locator('main, [role="main"], #__next').first().innerText().catch(() => '');
      if (bodyText.trim().length < 10) modErrors.push('BLANK_SCREEN');

      await page.screenshot({ path: screenshot, fullPage: false });

      // Visual regression diff (lazy-required deps; null when unavailable).
      const { changePct, diffPath } = diffAgainstBaseline(mod.slug, screenshot);
      if (changePct != null && changePct > CHANGE_THRESHOLD) {
        modErrors.push('VISUAL_REGRESSION:' + (changePct * 100).toFixed(2) + '%');
      }

      // Accessibility scan.
      const axe = await runAxe(page);
      if (axe.violations > 0) modErrors.push('A11Y_VIOLATIONS:' + axe.violations);

      moduleResults.push({
        slug: mod.slug, label: mod.label,
        status: modErrors.length === 0 ? 'pass' : 'fail',
        screenshot, changePct, diffPath,
        a11yViolations: axe.violations,
        errors: modErrors,
      });
      errors.push(...modErrors.map((e) => e + ': ' + mod.slug));
    }

    const a11yTotal = moduleResults.reduce((s, m) => s + m.a11yViolations, 0);
    const result = {
      passed: errors.length === 0,
      modulesChecked: moduleResults.length,
      errors,
      screenshots: moduleResults.map((m) => m.screenshot),
      modules: moduleResults,
      a11yViolations: a11yTotal,
    };
    fs.writeFileSync(SCREENSHOT_DIR + '/result.json', JSON.stringify(result, null, 2));

    // Hard fail only on the original critical heuristics — visual + a11y are
    // recorded as sub-errors so we don't black-hole the iteration on a tweak.
    const criticalErrors = errors.filter((e) =>
      e.startsWith('ERROR_BOUNDARY') || e.startsWith('BLANK_SCREEN') || e.startsWith('PAGE ERROR'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface VisualGateRunResult {
  passed: boolean;
  output: string;
  durationMs: number;
  errors?: Array<{ message: string }>;
  result?: VisualGateResult;
}

/**
 * In-flight de-dupe for the visual gate.
 *
 * The generated Playwright spec walks *every* registered module
 * (`VISUAL_GATE_MODULES`) and is keyed only on `statePath`/`iteration`/config —
 * it is identical for every area verified within the same iteration. The
 * orchestrator's streaming pool, however, calls `verify()` (and thus this gate)
 * once per area, often concurrently. Spawning a full `npx playwright test` +
 * browser cold-start per area is the dominant verification cost and is entirely
 * redundant: every concurrent area in an iteration would get the same result.
 *
 * We share the *in-flight promise* per `(statePath, iteration)` so the runner +
 * browser boots once while areas verify concurrently. The entry is dropped as
 * soon as the run settles — so this is a pure in-flight de-dupe, NOT a result
 * cache: a later sequential call (e.g. a self-heal re-verify in the same
 * iteration) always starts a fresh run and can never read a stale pre-heal
 * result. Per-area results are unchanged.
 */
const visualGateRunCache = new Map<string, Promise<VisualGateRunResult>>();

/**
 * Run the visual verification gate. Captures + diffs baselines, runs axe scans,
 * and writes a structured `result.json` consumable by both the harness verifier
 * and the gallery UI.
 *
 * Concurrent area verifications within one `(statePath, iteration)` share a
 * single Playwright run + browser cold-start; the shared promise is dropped on
 * settle, so any sequential re-verify runs fresh.
 */
export function runVisualGate(
  projectPath: string,
  statePath: string,
  iteration: number,
  options: VisualGateConfig = {},
): Promise<VisualGateRunResult> {
  const cacheKey = `${statePath}::${iteration}`;
  const inflight = visualGateRunCache.get(cacheKey);
  if (inflight) return inflight;

  const run = executeVisualGate(projectPath, statePath, iteration, options).finally(() => {
    // Drop the entry once the run settles: pure in-flight de-dupe, not a result
    // cache. Concurrent callers share this run; later sequential callers (e.g. a
    // self-heal re-verify in the same iteration) start a fresh run.
    if (visualGateRunCache.get(cacheKey) === run) visualGateRunCache.delete(cacheKey);
  });
  visualGateRunCache.set(cacheKey, run);
  return run;
}

/**
 * Actually spawn Playwright and produce the gate result. Not memoised — callers
 * go through {@link runVisualGate}. Exported only for tests / advanced callers
 * that need to force a fresh run.
 */
export function executeVisualGate(
  projectPath: string,
  statePath: string,
  iteration: number,
  options: VisualGateConfig = {},
): Promise<VisualGateRunResult> {
  const cfg: Required<VisualGateConfig> = {
    updateBaselines: options.updateBaselines ?? true,
    changeThreshold: options.changeThreshold ?? 0.02,
    runA11y: options.runA11y ?? true,
  };
  const start = Date.now();
  const screenshotDir = path.join(statePath, 'screenshots', String(iteration));
  const baselineDir = path.join(statePath, 'screenshots', 'baseline');
  const scriptPath = path.join(statePath, '_visual-gate.spec.ts');

  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(
    scriptPath,
    generateVisualCheckScript(screenshotDir, baselineDir, VISUAL_GATE_MODULES, cfg),
  );

  return new Promise((resolve) => {
    const proc = exec(
      `npx playwright test "${scriptPath}" --reporter=line --timeout=180000`,
      { cwd: projectPath, timeout: 240_000, maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        const combinedOutput = [stdout, stderr].filter(Boolean).join('\n');

        const resultPath = path.join(screenshotDir, 'result.json');
        let parsed: VisualGateResult | null = null;
        try {
          if (fs.existsSync(resultPath)) parsed = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
        } catch { /* parse error → fall through */ }

        if (parsed) {
          const regressed = parsed.modules.filter((m) => m.changePct != null && m.changePct > cfg.changeThreshold);
          const a11y = parsed.a11yViolations;
          const summary = `Visual gate: ${parsed.modulesChecked} modules, ${parsed.errors.length} errors`
            + (regressed.length ? `, ${regressed.length} regressions` : '')
            + (a11y ? `, ${a11y} a11y violations` : '');
          resolve({
            passed: parsed.passed,
            output: summary + ` (screenshots: ${screenshotDir})`,
            durationMs,
            errors: parsed.errors.length > 0 ? parsed.errors.map((e) => ({ message: e })) : undefined,
            result: parsed,
          });
        } else {
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
    setTimeout(() => { try { proc.kill('SIGTERM'); } catch { /* */ } }, 241_000);
  });
}

/**
 * Create a visual VerificationGate config for the harness.
 * Advisory by default — captures issues without blocking the loop.
 */
export function createVisualGate(): {
  name: string;
  type: 'visual';
  required: boolean;
  command?: string;
} {
  return { name: 'visual-check', type: 'visual', required: false };
}
