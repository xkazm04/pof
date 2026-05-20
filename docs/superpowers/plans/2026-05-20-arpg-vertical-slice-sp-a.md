# SP-A: P0 Flow-Unblock Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two P0 reliability defects — make the build-verify button (Finding A) deterministically reachable in tests, and replace `useModuleCLI`'s racy fixed-timer dispatch with a ready-handshake.

**Architecture:** Four tasks. (1) `useProjectScan` exposes a 3-state `scanState` signal rendered as a `data-*` attribute. (2) A new pure helper `src/lib/cli-dispatch.ts` (`dispatchPromptWhenReady`) contains the dispatch choreography — TDD'd with a vitest+jsdom test. (3) `CompactTerminal` announces readiness and `useModuleCLI.sendPrompt` calls the helper instead of a 100ms `setTimeout`. (4) A `completeSetupWizard` harness helper drives the real wizard, and a stub-mode Playwright e2e proves the build-verify button is reachable + enabled.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-a-design.md`

---

## Planning-time notes (deviations + verified facts)

1. **Verification mechanism for the dispatch helper — vitest, not Playwright.** The spec said "D9-fixture-style Playwright `data:` URL spec". `dispatchPromptWhenReady` is *browser-side app code* (uses `window` events), unlike D9's `waitForCliComplete` which is Node-side. The repo's vitest runs in `jsdom` (`vitest.config.ts`: `environment: 'jsdom'`) which provides `window`, `CustomEvent`, event APIs, and `vi.useFakeTimers()` for the fallback timer. vitest+jsdom is the correct deterministic equivalent and matches repo conventions (`src/__tests__/lib/`). The spec's *intent* (deterministic, exact-count, no live Claude) is fully met.

2. **`UI_TIMEOUTS.mountDelay` left in place.** `useModuleCLI.ts:98` still uses `UI_TIMEOUTS.raceConditionBuffer`, so the import stays. The `mountDelay` constant is left untouched (an unused object property trips no lint rule); a new `terminalReadyFallback` is added.

3. **`CompactTerminal` identity is `instanceId`.** The existing handler filters `if (tabId !== instanceId) return` (`CompactTerminal.tsx:83`) — so the dispatch `tabId` equals the terminal's `instanceId`. The ready registry and the `pof-cli-terminal-ready` event both key on `instanceId`.

4. **Finding A e2e environment precondition:** the test drives the real setup wizard and the real `/api/filesystem/browse` scan (not mocked by `setupHarnessMode`). It requires the PoF UE project to exist on disk at `C:\Users\kazda\Documents\Unreal Projects\PoF` and at least one UE engine installed (so the button's `disabled={engines.length === 0}` is false). Both hold on the dev machine (per D-series runs).

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/modules/project-setup/useProjectScan.ts` | Modify | Add `ScanState` type + `scanState` state + return field |
| `src/components/modules/project-setup/ProjectSetupModule.tsx` | Modify | Render `data-testid` + `data-scan-state` on content container |
| `src/lib/constants.ts` | Modify | Add `UI_TIMEOUTS.terminalReadyFallback` |
| `src/lib/cli-dispatch.ts` | Create | `dispatchPromptWhenReady` + `Window.__pofReadyTerminals` global |
| `src/__tests__/lib/cli-dispatch.test.ts` | Create | Vitest test for the dispatch handshake |
| `src/components/cli/CompactTerminal.tsx` | Modify | Announce readiness in the listener `useEffect` |
| `src/hooks/useModuleCLI.ts` | Modify | `sendPrompt` calls `dispatchPromptWhenReady` |
| `e2e/helpers/harness-mode.ts` | Modify | Add `completeSetupWizard` helper |
| `e2e/arpg-vertical-slice-live-d2.spec.ts` | Modify | `enterWorkspace` uses helper; Step 6 waits for scan-settled |
| `e2e/sp-a-finding-a.spec.ts` | Create | Stub-mode e2e: build-verify button reachable |

Total: **3 created, 7 modified, 4 commits.**

---

## Task 1: `scanState` signal in `useProjectScan` + `ProjectSetupModule`

**Files:**
- Modify: `src/components/modules/project-setup/useProjectScan.ts`
- Modify: `src/components/modules/project-setup/ProjectSetupModule.tsx`

This is a pure observable-signal addition (no behavior change). It has no standalone unit test — the behavioral proof is the Task 4 e2e, which waits on this exact signal. Verification here is `tsc` + `lint` + the existing `vitest` suite staying green.

- [ ] **Step 1: Add the `ScanState` type + state to `useProjectScan`**

Use the Edit tool on `src/components/modules/project-setup/useProjectScan.ts`. Replace:
```typescript
export function useProjectScan(projectPath: string) {
  const [engines, setEngines] = useState<DetectedEngine[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const initialScanDone = useRef(false);
```
with:
```typescript
/** Lifecycle of the project scan, for deterministic test waits. */
export type ScanState = 'idle' | 'scanning' | 'settled';

export function useProjectScan(projectPath: string) {
  const [engines, setEngines] = useState<DetectedEngine[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const initialScanDone = useRef(false);
```

- [ ] **Step 2: Set `scanState` at the start of `scan()`**

Use the Edit tool on the same file. Replace:
```typescript
  const scan = useCallback(async () => {
    setScanning(true);
```
with:
```typescript
  const scan = useCallback(async () => {
    setScanning(true);
    setScanState('scanning');
```

- [ ] **Step 3: Set `scanState` at the end of `scan()`**

Use the Edit tool on the same file. Replace:
```typescript
    setProjectFiles(files);
    setScanning(false);
  }, [projectPath]);
```
with:
```typescript
    setProjectFiles(files);
    setScanning(false);
    setScanState('settled');
  }, [projectPath]);
```

- [ ] **Step 4: Return `scanState` from the hook**

Use the Edit tool on the same file. Replace:
```typescript
  return {
    engines,
    checklist,
    projectFiles,
    scanning,
    scan,
    hasProject,
    okCount,
    missingToolCount,
  };
}
```
with:
```typescript
  return {
    engines,
    checklist,
    projectFiles,
    scanning,
    scanState,
    scan,
    hasProject,
    okCount,
    missingToolCount,
  };
}
```

- [ ] **Step 5: Consume `scanState` in `ProjectSetupModule`**

Use the Edit tool on `src/components/modules/project-setup/ProjectSetupModule.tsx`. Replace:
```typescript
  const {
    engines,
    checklist,
    projectFiles,
    scanning,
    scan,
    hasProject,
    okCount,
    missingToolCount,
  } = useProjectScan(projectPath);
```
with:
```typescript
  const {
    engines,
    checklist,
    projectFiles,
    scanning,
    scanState,
    scan,
    hasProject,
    okCount,
    missingToolCount,
  } = useProjectScan(projectPath);
```

- [ ] **Step 6: Render the signal on the content container**

Use the Edit tool on the same file. Replace:
```typescript
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
```
with:
```typescript
      {/* Main content */}
      <div
        className="flex-1 overflow-y-auto p-6"
        data-testid="pof-project-setup-content"
        data-scan-state={scanState}
      >
```

- [ ] **Step 7: Typecheck + lint + test**

```bash
npx tsc --noEmit
npm run lint
npm run test
```
Expected: `tsc` clean; `lint` clean; `vitest` suite all green (no regression — this change is additive).

- [ ] **Step 8: Commit**

```bash
git add src/components/modules/project-setup/useProjectScan.ts src/components/modules/project-setup/ProjectSetupModule.tsx
git commit -m "$(cat <<'EOF'
feat(project-setup): expose 3-state scanState signal for deterministic test waits

useProjectScan now tracks scanState ('idle' | 'scanning' | 'settled') and
ProjectSetupModule renders it as data-scan-state on a data-testid'd container.
This gives the e2e harness a deterministic signal to wait on instead of a
blind timeout — the build-verify button (BuildVerifyPanel) only renders after
the async project scan settles. Purely observable; no behavior change.

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-a-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 2: `dispatchPromptWhenReady` helper + vitest test (TDD)

**Files:**
- Modify: `src/lib/constants.ts`
- Create: `src/lib/cli-dispatch.ts`
- Create: `src/__tests__/lib/cli-dispatch.test.ts`

- [ ] **Step 1: Add the `terminalReadyFallback` constant**

Use the Edit tool on `src/lib/constants.ts`. Replace:
```typescript
  /** Delay for terminal component to mount before dispatching events. */
  mountDelay: 100,
```
with:
```typescript
  /** Delay for terminal component to mount before dispatching events. */
  mountDelay: 100,
  /** Safety fallback: dispatch a CLI prompt anyway if the terminal never
   *  announces readiness (loud-failure backstop, not the normal path). */
  terminalReadyFallback: 5000,
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/lib/cli-dispatch.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchPromptWhenReady } from '@/lib/cli-dispatch';
import { UI_TIMEOUTS } from '@/lib/constants';

/** Collect pof-cli-prompt prompts addressed to a given tabId. */
function collectPrompts(tabId: string): string[] {
  const received: string[] = [];
  window.addEventListener('pof-cli-prompt', (e) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.tabId === tabId) received.push(detail.prompt);
  });
  return received;
}

describe('dispatchPromptWhenReady', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.__pofReadyTerminals = new Set<string>();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete window.__pofReadyTerminals;
  });

  it('dispatches immediately when the terminal is already ready', () => {
    const received = collectPrompts('term-1');
    window.__pofReadyTerminals!.add('term-1');

    dispatchPromptWhenReady('term-1', 'hello');

    expect(received).toEqual(['hello']);
  });

  it('waits for the terminal-ready signal when the terminal mounts late', () => {
    const received = collectPrompts('term-2');

    dispatchPromptWhenReady('term-2', 'late');
    expect(received).toEqual([]); // not ready yet — nothing dispatched

    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'term-2' } }),
    );
    expect(received).toEqual(['late']);
  });

  it('dispatches via the safety fallback and never twice', () => {
    const received = collectPrompts('term-3');

    dispatchPromptWhenReady('term-3', 'fallback');
    expect(received).toEqual([]);

    vi.advanceTimersByTime(UI_TIMEOUTS.terminalReadyFallback);
    expect(received).toEqual(['fallback']); // fallback fired

    // A late ready signal must NOT cause a second dispatch.
    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'term-3' } }),
    );
    expect(received).toEqual(['fallback']);
  });

  it('ignores ready signals for other terminals', () => {
    const received = collectPrompts('term-4');

    dispatchPromptWhenReady('term-4', 'mine');
    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'other' } }),
    );
    expect(received).toEqual([]); // wrong terminal — ignored

    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'term-4' } }),
    );
    expect(received).toEqual(['mine']);
  });
});
```

- [ ] **Step 3: Run the test; verify it FAILS**

```bash
npx vitest run src/__tests__/lib/cli-dispatch.test.ts
```
Expected: FAIL — `dispatchPromptWhenReady` cannot be imported (`src/lib/cli-dispatch.ts` does not exist yet).

- [ ] **Step 4: Create the `cli-dispatch.ts` helper**

Create `src/lib/cli-dispatch.ts`:
```typescript
import { UI_TIMEOUTS } from '@/lib/constants';

declare global {
  interface Window {
    /** Set of terminal instanceIds that have registered their pof-cli-prompt
     *  listener and are ready to receive a dispatch. Maintained by
     *  CompactTerminal; read by dispatchPromptWhenReady. */
    __pofReadyTerminals?: Set<string>;
  }
}

/**
 * Dispatch a `pof-cli-prompt` event to the terminal identified by `tabId`.
 *
 * Replaces a fixed mount-delay timer that could fire before the terminal's
 * listener registered (the SP-A dispatch race). If the terminal is already in
 * the ready registry, dispatch immediately; otherwise wait for it to announce
 * `pof-cli-terminal-ready`. A safety-fallback timer dispatches anyway if the
 * terminal never announces — a loud-failure backstop, not the normal path.
 */
export function dispatchPromptWhenReady(tabId: string, prompt: string): void {
  const dispatch = () => {
    window.dispatchEvent(
      new CustomEvent('pof-cli-prompt', { detail: { tabId, prompt } }),
    );
  };

  if (window.__pofReadyTerminals?.has(tabId)) {
    dispatch();
    return;
  }

  let fired = false;
  const onReady = (e: Event) => {
    if ((e as CustomEvent).detail?.instanceId !== tabId) return;
    fired = true;
    window.removeEventListener('pof-cli-terminal-ready', onReady);
    dispatch();
  };
  window.addEventListener('pof-cli-terminal-ready', onReady);

  setTimeout(() => {
    if (fired) return;
    window.removeEventListener('pof-cli-terminal-ready', onReady);
    dispatch();
  }, UI_TIMEOUTS.terminalReadyFallback);
}
```

- [ ] **Step 5: Run the test; verify it PASSES**

```bash
npx vitest run src/__tests__/lib/cli-dispatch.test.ts
```
Expected: 4 passed.

- [ ] **Step 6: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/lib/cli-dispatch.ts src/__tests__/lib/cli-dispatch.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add dispatchPromptWhenReady — ready-handshake dispatch helper

Pure helper that dispatches a pof-cli-prompt event when the target terminal is
ready, instead of guessing with a fixed 100ms timer. Dispatches immediately if
the terminal's instanceId is in window.__pofReadyTerminals, else waits for the
pof-cli-terminal-ready event; a terminalReadyFallback timer is a loud-failure
backstop. TDD'd with a vitest+jsdom test (4 cases: ready-hit, late-mount,
fallback + no-double-dispatch, wrong-terminal).

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-a-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Wire the handshake into the app

**Files:**
- Modify: `src/components/cli/CompactTerminal.tsx`
- Modify: `src/hooks/useModuleCLI.ts`

- [ ] **Step 1: `CompactTerminal` announces readiness**

Use the Edit tool on `src/components/cli/CompactTerminal.tsx`. Replace:
```typescript
  // Listen for pof-cli-prompt events
  useEffect(() => {
    const handler = (e: Event) => {
      const { tabId, prompt } = (e as CustomEvent).detail;
      if (tabId !== instanceId) return;
      pendingPromptRef.current = prompt;
      setInput(prompt);
    };
    window.addEventListener('pof-cli-prompt', handler);
    return () => window.removeEventListener('pof-cli-prompt', handler);
  }, [instanceId]);
```
with:
```typescript
  // Listen for pof-cli-prompt events + announce readiness so a just-dispatched
  // sendPrompt can target this terminal (replaces the old fixed mount-delay).
  useEffect(() => {
    const handler = (e: Event) => {
      const { tabId, prompt } = (e as CustomEvent).detail;
      if (tabId !== instanceId) return;
      pendingPromptRef.current = prompt;
      setInput(prompt);
    };
    window.addEventListener('pof-cli-prompt', handler);

    (window.__pofReadyTerminals ??= new Set<string>()).add(instanceId);
    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId } }),
    );

    return () => {
      window.removeEventListener('pof-cli-prompt', handler);
      window.__pofReadyTerminals?.delete(instanceId);
    };
  }, [instanceId]);
```

Note: `window.__pofReadyTerminals` is typed via the `declare global` in `src/lib/cli-dispatch.ts` (ambient project-wide); no import is needed for the type.

- [ ] **Step 2: `useModuleCLI` imports the helper**

Use the Edit tool on `src/hooks/useModuleCLI.ts`. Replace:
```typescript
import { UI_TIMEOUTS } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';
```
with:
```typescript
import { UI_TIMEOUTS } from '@/lib/constants';
import { dispatchPromptWhenReady } from '@/lib/cli-dispatch';
import type { SubModuleId } from '@/types/modules';
```

- [ ] **Step 3: `sendPrompt` dispatches via the handshake**

Use the Edit tool on `src/hooks/useModuleCLI.ts`. Replace:
```typescript
      // Small delay to allow the terminal component to mount and attach its event listener
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('pof-cli-prompt', {
            detail: { tabId, prompt },
          })
        );
      }, UI_TIMEOUTS.mountDelay);
```
with:
```typescript
      // Dispatch when the target terminal announces readiness (handshake) —
      // replaces a fixed mount-delay timer that could lose the event.
      // See src/lib/cli-dispatch.ts.
      dispatchPromptWhenReady(tabId, prompt);
```

Note: the `UI_TIMEOUTS` import stays — `useModuleCLI.ts:98` still uses `UI_TIMEOUTS.raceConditionBuffer`.

- [ ] **Step 4: Typecheck + lint + test**

```bash
npx tsc --noEmit
npm run lint
npm run test
```
Expected: `tsc` clean; `lint` clean; `vitest` suite all green (incl. the Task 2 `cli-dispatch` test).

- [ ] **Step 5: Commit**

```bash
git add src/components/cli/CompactTerminal.tsx src/hooks/useModuleCLI.ts
git commit -m "$(cat <<'EOF'
fix(cli): replace fixed dispatch timer with terminal ready-handshake

CompactTerminal now registers its instanceId in window.__pofReadyTerminals and
fires pof-cli-terminal-ready when its pof-cli-prompt listener mounts.
useModuleCLI.sendPrompt dispatches via dispatchPromptWhenReady instead of a
100ms setTimeout — closing the dispatch race where a slow terminal mount let
the event fire into a window with no listener (D7/D8/D9 flake, root cause).

The pof-cli-prompt event and its payload are unchanged, so the e2e harness
recorder and D9's waitForCliComplete re-dispatch backstop still work as-is.

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-a-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 4: `completeSetupWizard` helper + Finding A e2e test

**Files:**
- Modify: `e2e/helpers/harness-mode.ts`
- Modify: `e2e/arpg-vertical-slice-live-d2.spec.ts`
- Create: `e2e/sp-a-finding-a.spec.ts`

- [ ] **Step 1: Add the `completeSetupWizard` helper**

Open `e2e/helpers/harness-mode.ts` and confirm `Page` is imported (it is — `import { type Page } from '@playwright/test'` at line 1). Append this exported function at the end of the file:
```typescript
/**
 * Drive the full-screen SetupWizard to completion by selecting the existing
 * PoF project. The app boots into <SetupWizard /> when setup is incomplete
 * (AppShell.tsx) — no sidebar exists until a project is chosen. Idempotent: if
 * the wizard is already past (sidebar present), it just returns.
 */
export async function completeSetupWizard(page: Page): Promise<void> {
  const existingTab = page.getByTestId('pof-setup-wizard-tab-existing');
  if ((await existingTab.count()) > 0) {
    await existingTab.click();
    // project-item testId is slugified from the project name ("PoF" -> "pof").
    await page.getByTestId('pof-setup-wizard-project-item-pof').click({ timeout: 20_000 });
  }
  // App shell renders only after isSetupComplete flips true.
  await page
    .getByTestId('pof-sidebar-nav-item-project-setup')
    .waitFor({ state: 'visible', timeout: 15_000 });
}
```

- [ ] **Step 2: Verify the wizard testIds match**

```bash
npx playwright --version
```
Then confirm in source that the testIds used above exist exactly as written:
- `pof-setup-wizard-tab-existing` — `src/components/modules/project-setup/SetupWizard.tsx` (mode tab).
- `pof-setup-wizard-project-item-pof` — `SetupWizard.tsx` interpolates `pof-setup-wizard-project-item-${slugifyForTestId(project.name)}`; for project name "PoF" the slug is "pof".
- `pof-sidebar-nav-item-project-setup` — sidebar L1 nav (already used by `e2e/arpg-vertical-slice-live-d2.spec.ts:58`).

Use the Grep tool to confirm each string is present in source. If the PoF project's display name slugifies to something other than `pof`, update the `project-item` testId in Step 1 accordingly before proceeding.

- [ ] **Step 3: Update `enterWorkspace` in the live spec to use the helper**

Use the Edit tool on `e2e/arpg-vertical-slice-live-d2.spec.ts`. Replace the import line:
```typescript
import { setupHarnessMode, waitForCliComplete, seedPackagingProfile, resetProgressForTestProject, type HarnessHandle, type StepResult } from './helpers/harness-mode';
```
with:
```typescript
import { setupHarnessMode, waitForCliComplete, seedPackagingProfile, resetProgressForTestProject, completeSetupWizard, type HarnessHandle, type StepResult } from './helpers/harness-mode';
```

Then replace:
```typescript
async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  try {
    const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
    await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pofBtn.click();
    await page.waitForTimeout(2000);
  } catch { /* already past launcher */ }
}
```
with:
```typescript
async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);
}
```

- [ ] **Step 4: Make Step 6 wait for the scan to settle**

Use the Edit tool on `e2e/arpg-vertical-slice-live-d2.spec.ts`. Replace:
```typescript
        await enterWorkspace(page);
        await page.getByTestId('pof-sidebar-nav-item-project-setup').click();
        const verifyBtn = page.getByTestId('pof-setup-wizard-build-verify-btn');
        const verifyCount = await verifyBtn.count();
```
with:
```typescript
        await enterWorkspace(page);
        await page.getByTestId('pof-sidebar-nav-item-project-setup').click();
        // Wait for the project scan to settle — BuildVerifyPanel renders only
        // after useProjectScan confirms a project (SP-A scanState signal).
        await page
          .locator('[data-testid="pof-project-setup-content"][data-scan-state="settled"]')
          .waitFor({ state: 'attached', timeout: 30_000 });
        const verifyBtn = page.getByTestId('pof-setup-wizard-build-verify-btn');
        const verifyCount = await verifyBtn.count();
```

- [ ] **Step 5: Create the Finding A e2e test**

Create `e2e/sp-a-finding-a.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { setupHarnessMode, completeSetupWizard } from './helpers/harness-mode';

/**
 * SP-A / Finding A: prove the build-verify button is deterministically
 * reachable. Stub mode — no live Claude. The project-setup filesystem scan is
 * NOT mocked by setupHarnessMode, so it runs for real; this requires the PoF
 * UE project on disk and at least one installed UE engine (button is
 * disabled={engines.length === 0}).
 */
test('build-verify button is reachable + enabled after the setup wizard', async ({ page }) => {
  await setupHarnessMode(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);

  await page.getByTestId('pof-sidebar-nav-item-project-setup').click();

  // Deterministic wait: the SP-A scanState signal — no blind timeout.
  await page
    .locator('[data-testid="pof-project-setup-content"][data-scan-state="settled"]')
    .waitFor({ state: 'attached', timeout: 30_000 });

  const btn = page.getByTestId('pof-setup-wizard-build-verify-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
});
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 7: Run the Finding A e2e test; verify it PASSES**

```bash
PLAYWRIGHT_PORT=3010 npx playwright test e2e/sp-a-finding-a.spec.ts --reporter=list
```
Expected: 1 passed — the build-verify button is visible and enabled. (A PoF dev server must be running on port 3010; `webServer.reuseExistingServer` will start one otherwise.) If it fails because the build-verify button is disabled, that means no UE engine was detected on the machine — report this rather than weakening the assertion.

- [ ] **Step 8: Commit**

```bash
git add e2e/helpers/harness-mode.ts e2e/arpg-vertical-slice-live-d2.spec.ts e2e/sp-a-finding-a.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): SP-A — completeSetupWizard helper + Finding A reachability test

Adds completeSetupWizard, which drives the full-screen SetupWizard (select the
existing PoF project) so the app shell + sidebar render. enterWorkspace in the
live spec now uses it, and Step 6 waits for the SP-A data-scan-state="settled"
signal before querying the build-verify button.

New e2e/sp-a-finding-a.spec.ts proves (stub mode, no live Claude) the
build-verify button is reachable + enabled — closing Finding A, which failed
every D-series live run because Step 6 queried the button before the async
project scan rendered BuildVerifyPanel.

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-a-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

- [ ] **Step 9: Final chat summary**

Post a single message with the 4 commit SHAs and the SP-A outcome:
```
Sub-project SP-A complete. 4 commits:
- <SHA_T1>  feat(project-setup): expose 3-state scanState signal
- <SHA_T2>  feat(cli): add dispatchPromptWhenReady — ready-handshake helper
- <SHA_T3>  fix(cli): replace fixed dispatch timer with terminal ready-handshake
- <SHA_T4>  test(e2e): SP-A — completeSetupWizard helper + Finding A test

Finding A: closed — build-verify button reachable + enabled (stub e2e passes).
Dispatch race: closed at the app level — handshake replaces the 100ms timer
(vitest: 4/4). tsc + lint + vitest all green.

Next sub-project: SP-B (gameplay chain live).
```

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** Spec Part 1 (Finding A) → Task 1 (scanState signal) + Task 4 (completeSetupWizard, Step 6 wait, e2e). Spec Part 2 (dispatch handshake) → Task 2 (helper + test) + Task 3 (wire CompactTerminal + useModuleCLI). Spec Part 3 (verification) → Task 2 vitest test + Task 4 stub e2e. DoD items 1-7 all map: DoD1→T1, DoD2→T4, DoD3→T2+T3, DoD4→T4 Step 7, DoD5→T2 Step 5, DoD6→every task's tsc/lint/test step, DoD7→4 commits + T4 Step 9.
- [x] **Placeholder scan:** the only bracketed text is the `<SHA_*>` substitutions in T4 Step 9's chat summary — explicit runtime values. All code steps show complete code; no "TBD"/"handle edge cases"/"similar to Task N".
- [x] **Type consistency:** `ScanState = 'idle'|'scanning'|'settled'` defined in T1 Step 1, consumed in T1 Step 5, matched by the `data-scan-state="settled"` selector in T4 Steps 4-5. `dispatchPromptWhenReady(tabId, prompt)` signature defined in T2 Step 4, called in T3 Step 3, tested in T2 Step 2. `window.__pofReadyTerminals: Set<string>` declared in T2 Step 4, written in T3 Step 1, read in T2 Step 4's helper. `pof-cli-terminal-ready` detail shape `{ instanceId }` consistent across T2 (helper + test) and T3 (CompactTerminal). `UI_TIMEOUTS.terminalReadyFallback` added in T2 Step 1, used in T2 Step 4 helper + T2 Step 2 test. `completeSetupWizard` exported in T4 Step 1, imported in T4 Steps 3 + 5.
- [x] **Edit uniqueness:** every `old_string` is a distinct multi-line block. T1's six edits target separate regions of two files. T4 Step 3's two edits (import line, `enterWorkspace` body) are distinct.
- [x] **TDD applied where it fits:** T2 (the pure helper) is full TDD — failing test → implement → pass. T1 (observable attribute) and T3 (React wiring) and T4 (e2e) are verified by tsc/lint/vitest + the T4 stub e2e; a renderHook unit test for T1/T3 was deliberately omitted (no `@testing-library/react` precedent in the repo; the e2e is the honest behavioral proof) — noted in T1's preamble.
- [x] **Bite-sized:** T1 = 8 steps, T2 = 7, T3 = 5, T4 = 9. All single-action.
- [x] **No live run required:** SP-A's DoD is met by vitest + stub e2e. No `HARNESS_MODE=live`, no UE5 modification, no machine-sleep risk.
