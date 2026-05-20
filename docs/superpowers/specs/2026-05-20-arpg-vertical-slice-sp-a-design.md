---
date: 2026-05-20
status: draft
sub_project: SP-A (P0 flow-unblock reliability)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario — post-D9 roadmap (P0–P3)
predecessor_docs:
  - docs/features/arpg-vertical-slice/SCENARIO-REPORT.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-d9.md
---

# Sub-project SP-A: P0 Flow-Unblock Reliability

## Context

The ARPG vertical-slice initiative reached D9 with the dispatch loop proven and
the dispatch-race flake closed at the *harness* level. The `SCENARIO-REPORT.md`
identified two **P0** items as the foundation for all further live work:

1. **Finding A** — the live spec's Step 6 (build-verify) fails every run: the
   `pof-setup-wizard-build-verify-btn` element is never visible, so the step
   cannot dispatch.
2. **Dispatch race at the app level** — the harness re-dispatch (D9) works
   around a real app defect: `useModuleCLI.sendPrompt` fires the `pof-cli-prompt`
   event on a fixed 100 ms timer that can beat `CompactTerminal`'s listener
   registration. A real user clicking fast can hit the same lost dispatch.

SP-A fixes both. It is decomposed from the larger P0–P3 roadmap (SP-A through
SP-E); SP-A is the agreed first sub-project because it unblocks Step 6 and makes
every later live run cleaner.

### Root cause — Finding A (verified by code inspection)

The build-verify button is gated in **two stages**:

- **Stage 1 — the setup gate.** `AppShell.tsx:78-79`: when `!isSetupComplete`
  the app renders a full-screen `<SetupWizard />` and *no sidebar exists*. The
  sidebar (hence all module navigation) only appears after the wizard completes
  by selecting a project.
- **Stage 2 — the scan gate.** Once in the app shell, navigating the sidebar to
  project-setup mounts `ProjectSetupModule`, which renders `<BuildVerifyPanel>`
  (the testId owner) only when `hasProject` is true (`ProjectSetupModule.tsx:128`).
  `hasProject` (`useProjectScan.ts:198`) is the `uproject` checklist item's `ok`
  flag — true only after `projectPath` is set *and* an async, multi-roundtrip
  filesystem scan (`useProjectScan.scan`, kicked off via `setTimeout(scan, 0)`
  on mount) completes.

The live spec's `enterWorkspace` does not deterministically complete the wizard,
and Step 6 never waits for the scan — so the button is genuinely absent from the
DOM when queried.

### Root cause — dispatch race (verified by code inspection)

`useModuleCLI.sendPrompt` (`useModuleCLI.ts:119-128`): after `setActiveTab(tabId)`
it waits `UI_TIMEOUTS.mountDelay` (100 ms) then dispatches
`new CustomEvent('pof-cli-prompt', { detail: { tabId, prompt } })`.
`CompactTerminal` registers `window.addEventListener('pof-cli-prompt', handler)`
in a post-mount `useEffect` (`CompactTerminal.tsx:79-89`); the handler filters
`if (tabId !== instanceId) return`. When mount + effect flush exceeds 100 ms the
event is dispatched to a window with no matching listener and is lost.

## Goals

1. Make the live spec's Step 6 reliably reach an enabled build-verify button by
   driving the real setup-wizard flow and waiting on a deterministic scan signal.
2. Eliminate the dispatch race in the app via a ready-handshake, so dispatch no
   longer depends on a fixed timer.
3. Prove both deterministically with stub-mode / fixture tests before any live run.

## Non-goals

- **No change to the `pof-cli-prompt` event itself.** It still fires (just
  correctly timed). The harness recorder and D9's `waitForCliComplete`
  re-dispatch are intentionally left untouched as a backstop.
- **No store-pull rewrite** of prompt delivery (Approach 2, rejected — ripples
  into harness helpers, beyond P0 scope).
- **No live gameplay steps** (those are SP-B).
- **No fix for the remaining scenario steps 11–24** — SP-A is reliability only.
- **No new in-app UI** beyond observable test signals (`data-*` attributes).

## Decision record (from brainstorming)

1. **Finding A approach:** drive the real setup-wizard flow (vs. seeding
   `projectPath` into the store, or a blind-timeout wait). Most faithful; also
   exercises operator-flow steps 2–5. Requires a small app change to expose a
   stable scan-settled signal.
2. **Dispatch-race approach:** ready-handshake (Approach 1) — vs. store-pull
   (too invasive) and retry-in-app (keeps the raciness).
3. **D9's harness-side re-dispatch stays** in `waitForCliComplete` as a
   belt-and-suspenders backstop even after the app fix.
4. **Verification:** stub-mode + fixture tests are the gate; a live smoke run is
   optional, not required for SP-A's definition of done.

## Part 1 — Finding A: build-verify button reachability

### App change — expose a scan-state signal

`useProjectScan` (`src/components/modules/project-setup/useProjectScan.ts`)
gains a 3-state value:

```ts
type ScanState = 'idle' | 'scanning' | 'settled';
```

- Initial value `'idle'` — so the signal is never *prematurely* `'settled'`
  before the first `setTimeout(scan, 0)` runs.
- `scan()` sets `'scanning'` at its start and `'settled'` in place of the
  existing `setScanning(false)` at its end.
- Returned from the hook alongside the existing fields.

`ProjectSetupModule` (`ProjectSetupModule.tsx`) puts the signal on the main
content container:

```tsx
<div
  className="flex-1 overflow-y-auto p-6"
  data-testid="pof-project-setup-content"
  data-scan-state={scanState}
>
```

This is purely observable — no behavior change. Existing `scanning` boolean
usages stay; `scanState` is additive.

### Harness change — `completeSetupWizard` helper

A new exported helper in `e2e/helpers/harness-mode.ts`:

```ts
export async function completeSetupWizard(page: Page): Promise<void>;
```

Deterministically drives the real wizard (testIds verified during planning):
1. `page.getByTestId('pof-setup-wizard-tab-existing').click()`.
2. `page.getByTestId('pof-setup-wizard-project-item-pof').click()` — slug of the
   "PoF" project via `slugifyForTestId` (`SetupWizard.tsx:186`); this calls
   `handleOpenExisting`, which sets `projectPath` and completes setup.
3. Wait for the app shell to render (sidebar present) — confirms
   `isSetupComplete` flipped.

The live spec's `enterWorkspace` is updated to call `completeSetupWizard` rather
than its current best-effort "click a PoF button" logic. Step 6 then:
1. Navigates the sidebar to project-setup.
2. Waits for `[data-testid="pof-project-setup-content"][data-scan-state="settled"]`.
3. Asserts `pof-setup-wizard-build-verify-btn` is visible and enabled — the
   step can now dispatch.

### Verification — Finding A

A stub-mode e2e assertion (no live Claude): launch → `completeSetupWizard` →
navigate to project-setup → wait for `scan-state="settled"` → assert the
build-verify button is visible + enabled. The filesystem `browse` API is **not**
mocked by `setupHarnessMode`, so the scan runs for real in stub mode and this is
a faithful check.

## Part 2 — Dispatch race: ready-handshake

### App change — `CompactTerminal` announces readiness

In `CompactTerminal.tsx`, the existing `pof-cli-prompt` listener `useEffect`
also maintains a window-level ready registry keyed on `instanceId` (the terminal
identity the handler already filters on):

```ts
useEffect(() => {
  const handler = (e: Event) => { /* unchanged */ };
  window.addEventListener('pof-cli-prompt', handler);

  // Announce readiness so a just-dispatched sendPrompt can target us.
  (window.__pofReadyTerminals ??= new Set<string>()).add(instanceId);
  window.dispatchEvent(new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId } }));

  return () => {
    window.removeEventListener('pof-cli-prompt', handler);
    window.__pofReadyTerminals?.delete(instanceId);
  };
}, [instanceId]);
```

`window.__pofReadyTerminals` is declared on the `Window` interface (a typed
global, same pattern as the harness's `__pofHarnessDispatches`).

### App change — dispatch on the signal (extracted helper)

The choreography below lives in the new pure helper `src/lib/cli-dispatch.ts`
(`dispatchPromptWhenReady`, see Verification). `useModuleCLI.sendPrompt`'s
fixed-timer dispatch (`useModuleCLI.ts:121-128`) is replaced by a one-line call
to it. The logic:

```ts
const dispatch = () => {
  window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: { tabId, prompt } }));
};

if (window.__pofReadyTerminals?.has(tabId)) {
  dispatch();                       // terminal already mounted (reused session)
} else {
  // New terminal still mounting — dispatch when it announces readiness.
  let fired = false;
  const onReady = (e: Event) => {
    if ((e as CustomEvent).detail?.instanceId !== tabId) return;
    fired = true;
    window.removeEventListener('pof-cli-terminal-ready', onReady);
    dispatch();
  };
  window.addEventListener('pof-cli-terminal-ready', onReady);
  // Safety fallback: never hang silently if the terminal never mounts.
  setTimeout(() => {
    if (fired) return;
    window.removeEventListener('pof-cli-terminal-ready', onReady);
    dispatch();
  }, UI_TIMEOUTS.terminalReadyFallback);
};
```

`UI_TIMEOUTS.terminalReadyFallback` is a new constant (a few seconds — generous;
it is a loud-failure backstop, not the normal path). `UI_TIMEOUTS.mountDelay`
stays if used elsewhere; this call site stops using it.

`tabId` (the dispatch target) equals the terminal's `instanceId` — confirmed by
`CompactTerminal.tsx:83`'s `if (tabId !== instanceId) return` filter.

### Why the harness is untouched

The `pof-cli-prompt` event still fires with the same `{ tabId, prompt }` detail —
only its *timing* changes. The harness capture-phase recorder
(`harness-mode.ts:45-56`) and D9's `waitForCliComplete` re-dispatch keep working
unchanged. The new `pof-cli-terminal-ready` event is internal; the harness
ignores it. `InlineTerminal` (which also dispatches `pof-cli-prompt`) is
unaffected.

### Verification — dispatch handshake

To keep the handshake testable without mocking React internals, the dispatch
choreography is extracted into a **pure helper** rather than living inline in the
`useModuleCLI.sendPrompt` closure:

```ts
// src/lib/cli-dispatch.ts (new)
export function dispatchPromptWhenReady(tabId: string, prompt: string): void;
```

It contains exactly the registry-hit / wait-for-ready / safety-fallback logic
shown above. `sendPrompt` becomes a one-line call: `dispatchPromptWhenReady(tabId, prompt)`.

The test is a D9-fixture-style Playwright spec (`data:` URL pattern, no app, no
live Claude) that calls `dispatchPromptWhenReady` directly and asserts the event
choreography:
- **Late-mount case:** a synthetic terminal registers its `pof-cli-prompt`
  listener and announces `pof-cli-terminal-ready` *after* a delay longer than
  the old 100 ms window — the prompt still arrives, exactly once.
- **Ready-registry-hit case:** `instanceId` is pre-seeded into
  `window.__pofReadyTerminals` — dispatch is immediate, exactly once.

This mirrors how D9's fixture proved `waitForCliComplete`'s re-dispatch: real
event flow, deterministic timing, exact-count assertions.

## Cross-cutting

- **Branch:** `master` (established for this initiative).
- **Validation gate:** `npx tsc --noEmit` + `npm run lint` after app changes;
  the stub/fixture tests are the behavioral gate.
- **No worktree.**
- **PoF app source IS modified** this time (unlike D-series): `useProjectScan.ts`,
  `ProjectSetupModule.tsx`, `CompactTerminal.tsx`, `useModuleCLI.ts`,
  `constants.ts`, and new `src/lib/cli-dispatch.ts`. All changes are additive
  (new signal, new event, retimed dispatch via extracted helper) — no behavior
  regression intended. `npm run test` (vitest) must stay green.
- **UE5 project untouched** (no live dispatch in SP-A's required scope).
- **Port 3010** for any Playwright run.

## Definition of done

1. `useProjectScan` exposes `scanState: 'idle' | 'scanning' | 'settled'`;
   `ProjectSetupModule` renders `data-testid="pof-project-setup-content"` +
   `data-scan-state`.
2. `completeSetupWizard` helper added; live spec `enterWorkspace` uses it; Step 6
   waits for `scan-state="settled"`.
3. `CompactTerminal` announces readiness; `dispatchPromptWhenReady`
   (`src/lib/cli-dispatch.ts`) dispatches on the handshake instead of the 100 ms
   timer, with a safety fallback; `useModuleCLI.sendPrompt` calls it.
4. Stub-mode e2e proves the build-verify button is reachable + enabled.
5. Fixture test proves the dispatch handshake (late-mount → still delivered;
   ready-registry hit → immediate delivery).
6. `tsc`, `lint`, and `vitest` all green.
7. Changes committed to `master` (~3–4 commits); chat summary.

**Success criterion:** the build-verify button is deterministically reachable in
a test, and the dispatch handshake test proves a late-mounting terminal still
receives its prompt — closing both P0 items without a live run.

## Risks & mitigations

- **`completeSetupWizard` testIds differ from assumption** (e.g., the PoF project
  slug, or a confirm step). Mitigation: the plan verifies exact testIds in
  `SetupWizard.tsx` before writing the helper; `slugifyForTestId('PoF')` is the
  documented pattern.
- **The scan never reaches `settled`** in a test environment (filesystem API
  failure). Mitigation: `scan()`'s API calls already swallow errors and still
  call the end-of-scan setter, so `scanState` reaches `'settled'` even on a
  failed scan; `hasProject` would just be false — which the test would surface
  clearly rather than hang.
- **Ready-handshake misses if the terminal mounts, announces, and unmounts
  before `sendPrompt` checks the registry.** Mitigation: `sendPrompt` runs
  synchronously right after `setActiveTab`; the registry check + listener
  registration happen in the same tick, before any unmount. The safety-fallback
  timeout covers the pathological never-mounts case.
- **Two terminals share an `instanceId`.** Out of scope — `instanceId` is already
  assumed unique by the existing `tabId !== instanceId` filter; SP-A does not
  change session identity.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves the written spec.
3. `writing-plans` skill → implementation plan.
4. Execute (subagent-driven).
5. SP-A complete → brainstorm SP-B (gameplay chain live).
