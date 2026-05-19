import { type Page } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DispatchRecorder } from './dispatch-recorder';

export type HarnessMode = 'stub' | 'live';

export interface StepResult {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  notes?: string;
}

export interface HarnessHandle {
  mode: HarnessMode;
  recorder: DispatchRecorder;
  setStepLabel(label: string): void;
  recordStepResult(r: StepResult): void;
  /** Drains window.__pofHarnessDispatches and merges into the recorder. */
  drainCliDispatches(page: Page): Promise<void>;
  /** Writes the findings markdown + the dispatches JSON artifact. */
  writeFindings(opts?: { filenameSuffix?: string }): Promise<void>;
}

declare global {
  interface Window {
    __pofHarnessDispatches?: Array<{ kind: 'cli-prompt'; detail: unknown; ts: number }>;
    __pofHarnessMode?: HarnessMode;
  }
}

export async function setupHarnessMode(page: Page): Promise<HarnessHandle> {
  const mode: HarnessMode = (process.env.HARNESS_MODE === 'live' ? 'live' : 'stub');
  const recorder = new DispatchRecorder();
  const startedAt = new Date().toISOString();
  const stepResults: StepResult[] = [];

  // 1. Install capture-phase listener for pof-cli-prompt CustomEvents.
  //    Stub mode: record + stop propagation so terminal doesn't spawn Claude.
  //    Live mode: record only; let propagation continue.
  await page.addInitScript((mode: HarnessMode) => {
    window.__pofHarnessMode = mode;
    window.__pofHarnessDispatches = [];
    window.addEventListener('pof-cli-prompt', (e: Event) => {
      const ce = e as CustomEvent<{ tabId: string; prompt: string }>;
      window.__pofHarnessDispatches!.push({
        kind: 'cli-prompt',
        detail: ce.detail,
        ts: Date.now(),
      });
      if (window.__pofHarnessMode === 'stub') {
        // Prevent the terminal's listener from running (it would spawn Claude Code).
        e.stopImmediatePropagation();
      }
    }, true); // capture phase
  }, mode);

  // 2. Intercept cook endpoint.
  //    Stub mode: respond with synthetic SSE; live mode: pass through.
  if (mode === 'stub') {
    // Mock /pof/status so useProjectStore.scanProject() and pofBridgeConnection
    // resolve cleanly in test env. The PoF Bridge plugin is not running on
    // localhost:30040 in headless tests; without this mock the bridge client
    // fails fast and downstream stores (including useProjectStore) are stuck.
    await page.route('**/pof/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: '1.0.0',
          pluginName: 'PillarsOfFortuneBridge',
          connected: true,
          projectName: 'PoF',
          ueVersion: '5.7.3',
        }),
      });
    });

    // Mock the Next.js proxy too (in case any caller goes through /api/pof-bridge/status).
    await page.route('**/api/pof-bridge/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { connected: true, version: '1.0.0', pluginName: 'PillarsOfFortuneBridge' },
        }),
      });
    });

    await page.route('**/api/packaging/execute', async (route) => {
      const req = route.request();
      let body: unknown = null;
      try { body = req.postDataJSON(); } catch { body = req.postData(); }
      recorder.record({ kind: 'cook-execute', url: req.url(), method: req.method(), body });

      const events = [
        { type: 'phase', phase: 'cook', t: 0 },
        { type: 'progress', percent: 50, t: 1000 },
        { type: 'phase', phase: 'stage', t: 1500 },
        { type: 'phase', phase: 'package', t: 1800 },
        { type: 'done', exePath: 'C:\\stub\\Saved\\StagedBuilds\\Windows\\PoF.exe', durationMs: 2000, sizeBytes: 0, status: 'success', t: 2000 },
      ];
      for (const ev of events) {
        recorder.record({ kind: 'cook-event', body: ev });
      }
      const sseBody = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' },
        body: sseBody,
      });
    });
  }

  return {
    mode,
    recorder,
    setStepLabel(label) { recorder.setStepLabel(label); },
    recordStepResult(r) { stepResults.push(r); },
    async drainCliDispatches(page: Page) {
      const drained = await page.evaluate(() => {
        const list = window.__pofHarnessDispatches ?? [];
        window.__pofHarnessDispatches = [];
        return list;
      });
      for (const d of drained) {
        recorder.record({ kind: 'cli-prompt', body: d.detail });
      }
    },
    async writeFindings(opts?: { filenameSuffix?: string }) {
      const finishedAt = new Date().toISOString();
      const date = new Date().toISOString().slice(0, 10);
      const jsonPath = `e2e/artifacts/dispatched-prompts-${Date.now()}.json`;
      const suffix = opts?.filenameSuffix ? `-${opts.filenameSuffix}` : '';
      const mdPath = `docs/features/arpg-vertical-slice/scenario-runs/${date}-${mode}${suffix}.md`;

      await recorder.writeJSON(jsonPath, { runMode: mode, startedAt, finishedAt });

      const passCount = stepResults.filter((r) => r.status === 'pass').length;
      const failCount = stepResults.filter((r) => r.status === 'fail').length;
      const skipCount = stepResults.filter((r) => r.status === 'skip').length;
      const cliCount = recorder.byKind('cli-prompt').length;
      const cookCount = recorder.byKind('cook-execute').length;

      const stepRows = stepResults.map((r) =>
        `| ${r.step} | ${r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏸'} ${r.status} | ${r.durationMs}ms | ${r.notes ?? ''} |`,
      ).join('\n');

      const md = `# Scenario Run — ${date} (${mode} mode)\n\n` +
        `**Result:** ${passCount}/${stepResults.length} steps passed. ${skipCount} skipped. ${failCount} failed.\n\n` +
        `**Started:** ${startedAt}\n**Finished:** ${finishedAt}\n\n` +
        `## Per-step results\n\n| Step | Status | Duration | Notes |\n|------|--------|----------|-------|\n${stepRows}\n\n` +
        `## Captured dispatches\n\n- CLI prompt dispatches: ${cliCount}\n- Cook execute dispatches: ${cookCount}\n` +
        `\nFull dispatch payloads at \`${jsonPath}\`.\n\n` +
        `## Findings for sub-project D2 (live-mode prerequisites)\n\n` +
        `- [ ] Claude Code CLI authenticated (\`claude --version\` should work in PoF's shell environment).\n` +
        `- [ ] UE5 5.7 installed at expected engine path (verify via project-setup status checks).\n` +
        `- [ ] Visual Studio 2022 + Windows SDK + .NET tools installed.\n` +
        `- [ ] UE5 project at \`C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\` builds clean.\n` +
        `- [ ] \`~/.pof/pof.db\` initialised.\n\n` +
        `## Findings for sub-project D3 (iteration)\n\n_${mode === 'stub' ? 'Empty in stub run; D2 will populate after first live run.' : 'See above per-step notes for D3 input.'}_\n`;

      await mkdir(dirname(mdPath), { recursive: true });
      await writeFile(mdPath, md, 'utf-8');
    },
  };
}

/**
 * POST a default Win64 Shipping profile to /api/packaging/profiles so the
 * BuildConfigSelector renders the start-cook button. Call this once per
 * test run before navigating to packaging.
 *
 * Returns the new profile id (or empty string if the API envelope doesn't
 * surface one — caller should handle either case).
 */
export async function seedPackagingProfile(page: Page, name: string = 'D2-Win64-Shipping-Seed'): Promise<string> {
  const profile = {
    name,
    platform: 'Win64',
    config: 'Shipping',
    isDefault: false,
    cookSettings: {
      mapsToInclude: [],
      pluginsToDisable: [],
      usePak: true,
      compressPak: true,
      encryptPak: false,
      useIoStore: true,
      iterativeCooking: false,
      cookOnTheFly: false,
      textureStreamingBudgetMB: 0,
      compressTextures: true,
    },
    platformSettings: { architecture: 'x64', customFlags: [] },
    outputDir: '',
    stage: true,
    archive: false,
    archiveDir: '',
    runAfterPackage: false,
  };
  // POST envelope: { action: 'save', profile: {...} } — server wraps response as { data: { profile } }.
  const res = await page.request.post('/api/packaging/profiles', { data: { action: 'save', profile } });
  if (!res.ok()) {
    throw new Error(`seedPackagingProfile: POST /api/packaging/profiles returned ${res.status()} — ${await res.text()}`);
  }
  const body = await res.json();
  return body?.data?.profile?.id ?? '';
}

export interface WaitResult {
  success: boolean;
  durationMs: number;
  timedOut: boolean;
  /** Captured terminal output excerpt (live mode only — empty/null in stub). */
  outputExcerpt?: string;
}

/**
 * Wait until a CLI session transitions running → stopped, OR timeoutMs elapses.
 *
 * Polling strategy: DOM-based via the `pof-cli-panel-running-indicator`
 * testId (added by sub-project B). When the indicator is no longer attached,
 * the active session is considered done.
 *
 * Stub mode: short-circuits with success=true after ~200ms (no real session
 * runs because capture-phase listener stopped propagation).
 *
 * On timeout: tries to click a Stop button (if visible) to abort; records
 * timedOut: true and success: false.
 */
export async function waitForCliComplete(
  page: Page,
  sessionLabel: string,
  timeoutMs: number = 600_000,
): Promise<WaitResult> {
  const start = Date.now();

  if (process.env.HARNESS_MODE !== 'live') {
    await page.waitForTimeout(200);
    return { success: true, durationMs: Date.now() - start, timedOut: false };
  }

  const indicator = page.getByTestId('pof-cli-panel-running-indicator');
  try {
    await indicator.first().waitFor({ state: 'attached', timeout: 10_000 });
  } catch {
    return {
      success: false,
      durationMs: Date.now() - start,
      timedOut: false,
      outputExcerpt: `waitForCliComplete(${sessionLabel}): running indicator never appeared within 10s — dispatch likely never fired`,
    };
  }

  try {
    await indicator.first().waitFor({ state: 'detached', timeout: timeoutMs });
  } catch {
    let output = '';
    try {
      const outputEl = page.getByTestId('pof-cli-panel-output');
      output = (await outputEl.first().textContent({ timeout: 2000 })) ?? '';
    } catch { /* noop */ }

    try {
      const stopBtn = page.locator('button[aria-label*="abort" i], button[aria-label*="stop" i]').first();
      if ((await stopBtn.count()) > 0) {
        await stopBtn.click({ timeout: 2000 });
      }
    } catch { /* noop */ }

    return {
      success: false,
      durationMs: Date.now() - start,
      timedOut: true,
      outputExcerpt: output.slice(-2000),
    };
  }

  let output = '';
  try {
    const outputEl = page.getByTestId('pof-cli-panel-output');
    output = (await outputEl.first().textContent({ timeout: 2000 })) ?? '';
  } catch { /* noop */ }

  return {
    success: true,
    durationMs: Date.now() - start,
    timedOut: false,
    outputExcerpt: output.slice(-2000),
  };
}

/**
 * Wait until the cook completes, signalled by the appearance of the
 * pof-cook-progress-result testId (added by sub-project B).
 *
 * Stub mode: synthetic SSE in setupHarnessMode finishes in <2s; this
 * just waits for the result element.
 */
export async function waitForCookComplete(
  page: Page,
  timeoutMs: number = 600_000,
): Promise<WaitResult> {
  const start = Date.now();
  const result = page.getByTestId('pof-cook-progress-result');
  try {
    await result.first().waitFor({ state: 'visible', timeout: timeoutMs });
    const status = await result.first().getAttribute('data-status');
    return {
      success: status === 'success',
      durationMs: Date.now() - start,
      timedOut: false,
      outputExcerpt: (await result.first().textContent()) ?? '',
    };
  } catch {
    return { success: false, durationMs: Date.now() - start, timedOut: true };
  }
}
