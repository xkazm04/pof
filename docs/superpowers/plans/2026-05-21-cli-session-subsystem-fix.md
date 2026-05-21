# CLI-Session Subsystem Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two app bugs that hung SP-B's gameplay-chain live runs — `CompactTerminal`'s unreliable auto-submit and `useTaskQueue` leaving `session.isRunning` stuck on an abnormal process exit — and investigate the code-1 exit.

**Architecture:** Two targeted app-source fixes following existing patterns: (#1) the `pof-cli-prompt` handler submits the prompt directly via a render-current `tqRef`, deleting the racy `setInput → effect → clearTimeout'd timer` mechanism; (#2) `connectToStream`'s `eventSource.onerror` completes the in-flight task as failed (once-guarded by a per-connection flag) so `isRunning` is always released. Plus a scoped investigation of `cli-service.ts` for the code-1 exit.

**Tech Stack:** React 19, TypeScript, Zustand, the PoF CLI terminal subsystem.

**Spec:** `docs/superpowers/specs/2026-05-21-cli-session-subsystem-fix-design.md`

---

## Planning-time facts (verified)

1. **`CompactTerminal.tsx`** — `tq = useTaskQueue({...})` at line 35-39. `pendingPromptRef` declared at line 58. `handleSubmit` (60-68) reads `input` from state; `tq.submitPrompt(prompt: string, resume: boolean)` is the queue submit entry point. The `pof-cli-prompt` listener effect (79-99, keyed `[instanceId]`) sets `pendingPromptRef.current` + `setInput`. The buggy auto-submit effect is lines 101-108. `handleBuildFix` (110-115) ALSO relies on the auto-submit effect — it sets `pendingPromptRef.current` + `setInput` expecting the effect to submit. `pendingPromptRef` has exactly 3 use-sites: the listener, the auto-submit effect, `handleBuildFix`.

2. **`useTaskQueue.ts`** — `connectToStream` (356-373): `onmessage` handles SSE events and closes the EventSource on a `result`/`error` event; `onerror` (372) just closes — it never calls `onTaskComplete`. `onTaskComplete` is what releases `session.isRunning` (`InlineTerminal.tsx:154`); it currently fires only from the `result` handler (line 334), the `error` handler (349), and `executeTask`'s catch (411). `currentTaskIdRef.current` holds the in-flight task id. `registerTaskComplete(taskId, instanceId, success)` is the existing completion-register call used alongside every `onTaskComplete`.

3. Per the EventSource spec, calling `.close()` does not fire `onerror` — so after a clean `result` the `onerror` path is not normally hit. The once-guard is belt-and-suspenders, kept per-connection (local flag) to avoid cross-task leakage.

4. **`UI_TIMEOUTS.autoSubmitDelay`** (constants.ts:91) is used only by the auto-submit effect being deleted. Leave the constant in place — an unused object property trips no lint rule; removing it is needless churn.

5. **App source** — `npm run validate` (typecheck + lint + full vitest) is the regression gate.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/cli/CompactTerminal.tsx` | Modify | #1 — direct submit from the dispatch handler + `handleBuildFix`; delete the auto-submit effect |
| `src/components/cli/useTaskQueue.ts` | Modify | #2 — `connectToStream.onerror` completes the in-flight task as failed |
| `src/lib/claude-terminal/cli-service.ts` | Read (modify only if #3 finds a fix) | #3 investigation |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-cli-subsystem-findings.md` | Create | #3 written conclusion |

Total: **2 modified, 1 created (findings), ~3–4 commits.**

---

## Task 1: Fix #1 — reliable direct submit (`CompactTerminal.tsx`)

**Files:**
- Modify: `src/components/cli/CompactTerminal.tsx`

- [ ] **Step 1: Add a render-current `tqRef`**

Use the Edit tool. Replace:
```typescript
  const tq = useTaskQueue({
    instanceId, projectPath, taskQueue, autoStart, enabledSkills, visible,
    onTaskStart, onTaskComplete, onQueueEmpty, onStreamingChange,
    onBatchFlushed,
  });
```
with:
```typescript
  const tq = useTaskQueue({
    instanceId, projectPath, taskQueue, autoStart, enabledSkills, visible,
    onTaskStart, onTaskComplete, onQueueEmpty, onStreamingChange,
    onBatchFlushed,
  });
  // tqRef always points at the latest task queue. The pof-cli-prompt handler
  // is registered in an [instanceId]-keyed effect, so it must reach the
  // current submitPrompt/sessionId through this ref, not a stale closure.
  const tqRef = useRef(tq);
  tqRef.current = tq;
```

- [ ] **Step 2: Rewrite the `pof-cli-prompt` handler to submit directly**

Use the Edit tool. Replace:
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
```
with:
```typescript
  // Listen for pof-cli-prompt events + announce readiness so a just-dispatched
  // sendPrompt can target this terminal (replaces the old fixed mount-delay).
  useEffect(() => {
    const handler = (e: Event) => {
      const { tabId, prompt } = (e as CustomEvent).detail;
      if (tabId !== instanceId) return;
      // Submit the dispatched prompt DIRECTLY. The previous design set `input`
      // state and relied on a separate effect to auto-submit it — but that
      // effect's clearTimeout cleanup cancelled the submit timer on every
      // re-render (unstable handleSubmit dep), so the prompt routinely sat
      // unsent. Submitting straight through removes the race entirely.
      const queue = tqRef.current;
      if (typeof prompt !== 'string' || !prompt.trim() || queue.isStreaming) return;
      void queue.submitPrompt(prompt, queue.sessionId !== null);
    };
    window.addEventListener('pof-cli-prompt', handler);
```

- [ ] **Step 3: Delete the racy auto-submit effect**

Use the Edit tool. Replace:
```typescript
  // Auto-submit when input is set from a pof-cli-prompt event
  useEffect(() => {
    if (pendingPromptRef.current && input === pendingPromptRef.current && !tq.isStreaming) {
      pendingPromptRef.current = null;
      const timer = setTimeout(() => handleSubmit(tq.sessionId !== null), UI_TIMEOUTS.autoSubmitDelay);
      return () => clearTimeout(timer);
    }
  }, [input, tq.isStreaming, tq.sessionId, handleSubmit]);

  // Build fix prompt injection
  const handleBuildFix = useCallback((prompt: string) => {
    if (tq.isStreaming) return;
    setInput(prompt);
    pendingPromptRef.current = prompt;
  }, [tq.isStreaming]);
```
with:
```typescript
  // Build fix prompt injection — submit directly (the auto-submit effect that
  // this previously depended on has been removed; see the pof-cli-prompt
  // handler above).
  const handleBuildFix = useCallback((prompt: string) => {
    if (!prompt.trim() || tq.isStreaming) return;
    void tq.submitPrompt(prompt, tq.sessionId !== null);
  }, [tq]);
```

- [ ] **Step 4: Delete the now-unused `pendingPromptRef`**

Use the Edit tool. Replace:
```typescript
  // --- Submit / Resume / BuildFix ---

  const pendingPromptRef = useRef<string | null>(null);

  const handleSubmit = useCallback(async (resume = false) => {
```
with:
```typescript
  // --- Submit / Resume / BuildFix ---

  const handleSubmit = useCallback(async (resume = false) => {
```

- [ ] **Step 5: Validate**

```bash
npx tsc --noEmit
npm run lint
npm run test
```
Expected: `tsc` clean (note: `useRef` is already imported in `CompactTerminal.tsx`); `lint` 0 errors, no new warnings in the file; `vitest` suite all green. If `tsc` reports `input` / `UI_TIMEOUTS` as now-unused: `input`/`setInput` are still used by `handleSubmit`, the input box, and `handlePromptFill` — they stay. `UI_TIMEOUTS` is still imported and used elsewhere in the file — leave the import. If `tsc` flags a genuinely unused symbol caused by this change, remove it.

- [ ] **Step 6: Commit**

```bash
git add src/components/cli/CompactTerminal.tsx
git commit -m "$(cat <<'EOF'
fix(cli): submit dispatched prompts directly — remove racy auto-submit effect

A pof-cli-prompt event filled the terminal input, and a separate effect was
meant to auto-submit it. That effect returned clearTimeout as cleanup and
re-ran on every render (its handleSubmit dep is unstable — keyed on `input`
and the per-render `tq` object), so the 50ms submit timer was cancelled before
it fired. The prompt routinely sat in the input unsent, terminal "Ready", no
session — the SP-B chunk-1 failure.

The pof-cli-prompt handler (and handleBuildFix) now call tq.submitPrompt
directly via a render-current tqRef — no input round-trip, no timer, no race.
The auto-submit effect and pendingPromptRef are deleted. handleSubmit's own
empty-input/isStreaming guard and the task queue's dispatchedTaskIds
idempotency guard still prevent any double-submit.

Spec: docs/superpowers/specs/2026-05-21-cli-session-subsystem-fix-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 2: Fix #2 — abnormal stream exit releases the session (`useTaskQueue.ts`)

**Files:**
- Modify: `src/components/cli/useTaskQueue.ts`

- [ ] **Step 1: Make `connectToStream`'s `onerror` complete the in-flight task**

Use the Edit tool. Replace:
```typescript
  const connectToStream = useCallback((streamUrl: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    savedStreamUrlRef.current = streamUrl;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CLISSEEvent;
        handleSSEEvent(data);
        if (data.type === 'result' || data.type === 'error') {
          eventSource.close();
          eventSourceRef.current = null;
          savedStreamUrlRef.current = null;
        }
      } catch (e) { console.error('Failed to parse SSE:', e); }
    };
    eventSource.onerror = () => { eventSource.close(); eventSourceRef.current = null; };
  }, [handleSSEEvent]);
```
with:
```typescript
  const connectToStream = useCallback((streamUrl: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    savedStreamUrlRef.current = streamUrl;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;
    // Tracks whether this connection has already completed its task — set by a
    // terminal result/error SSE event, checked by onerror, so the task is
    // completed exactly once regardless of which path observes the stream end.
    let completed = false;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CLISSEEvent;
        handleSSEEvent(data);
        if (data.type === 'result' || data.type === 'error') {
          completed = true;
          eventSource.close();
          eventSourceRef.current = null;
          savedStreamUrlRef.current = null;
        }
      } catch (e) { console.error('Failed to parse SSE:', e); }
    };
    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      // Abnormal stream termination — e.g. the Claude process exited non-zero
      // without emitting a clean result/error SSE event. Complete the in-flight
      // task as failed so onTaskComplete fires and session.isRunning is
      // released; otherwise every same-module dispatch stays blocked behind a
      // disabled "Claude" button (the SP-B chunk-1 37-minute hang).
      if (completed) return;
      completed = true;
      const tid = currentTaskIdRef.current;
      if (tid) {
        registerTaskComplete(tid, instanceId, false);
        onTaskComplete?.(tid, false);
      }
    };
  }, [handleSSEEvent, instanceId, onTaskComplete]);
```

- [ ] **Step 2: Validate**

```bash
npx tsc --noEmit
npm run lint
npm run test
```
Expected: `tsc` clean — `registerTaskComplete`, `currentTaskIdRef`, `instanceId`, `onTaskComplete` are all already in scope in `useTaskQueue` (used by the existing `result`/`error` handlers and `executeTask`). `lint` 0 errors, no new warnings. `vitest` suite all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/cli/useTaskQueue.ts
git commit -m "$(cat <<'EOF'
fix(cli): release session on abnormal stream exit — onerror completes the task

useTaskQueue.connectToStream's eventSource.onerror closed the SSE stream but
never called onTaskComplete. When a Claude process exited abnormally (e.g.
code 1) without a clean result/error SSE event, the stream just error-closed,
onTaskComplete never fired, and session.isRunning stayed stuck true forever —
every same-module "Claude" button is disabled={isRunning}, so the next
same-module dispatch could never proceed (the SP-B chunk-1 37-minute hang).

onerror now completes the in-flight task as failed (registerTaskComplete +
onTaskComplete), releasing isRunning. A per-connection `completed` flag,
also set by a terminal result/error event, guarantees the task is completed
exactly once.

Spec: docs/superpowers/specs/2026-05-21-cli-session-subsystem-fix-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Investigate #3 — the code-1 exit under chained dispatch

**Files:**
- Read: `src/lib/claude-terminal/cli-service.ts` (and any server route it implies)
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-cli-subsystem-findings.md`
- Modify (only if a concrete low-risk fix is found): `src/lib/claude-terminal/cli-service.ts`

- [ ] **Step 1: Read and analyse the Claude CLI spawn/exit path**

Read `src/lib/claude-terminal/cli-service.ts` fully. Determine and note:
- How the Claude CLI process is spawned (command, args, cwd, env).
- How stdout/stderr/exit are handled, and what produces the "Process exited with code 1" text seen in the SP-B run #3 terminal.
- Whether a non-zero process exit emits a `result` SSE event (`isError: true`) or an `error` SSE event — or whether the stream simply ends/errors with no terminal event (which is the case Task 2 now covers).
- Whether anything in the spawn/session handling differs for back-to-back same-module sessions: acb-1 and acb-4 reuse one combat session via `findSessionByKey`; look for shared state, a session-id collision, a not-yet-released resource, or a resume-vs-fresh-session decision that an isolated single dispatch would not hit.

- [ ] **Step 2: Write the findings conclusion**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-cli-subsystem-findings.md` with a `## Bug #3 investigation` section stating, concretely:
- What the Claude spawn/exit path does.
- Whether a code-1 exit surfaces as a terminal SSE event or only an `onerror` (and therefore whether Task 2's fix is what makes it non-fatal).
- The verdict: either **(a)** a specific cause was found (describe it, and whether a low-risk fix is warranted), or **(b)** no deterministic cause — the code-1 exit is likely transient/environmental, and Task 2's fix guarantees it is non-fatal (the session releases, the step records a fail, the chain continues).
Write only what the code actually shows — no speculation presented as fact.

- [ ] **Step 3 (conditional): Apply a fix only if Step 1 found a concrete, low-risk cause**

If and only if Step 1 identified a specific, low-risk bug (e.g. a missing cwd quote, a session-id reuse error, an unhandled spawn error), apply the minimal fix to `cli-service.ts`. If the investigation found nothing deterministic, **skip this step** — that is an acceptable, spec-sanctioned outcome. Do not invent a fix.

- [ ] **Step 4: Validate (only if Step 3 applied a fix)**

```bash
npx tsc --noEmit
npm run lint
npm run test
```
Expected: all green. If Step 3 was skipped, no code changed — skip this step.

- [ ] **Step 5: Commit**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-cli-subsystem-findings.md
# If Step 3 applied a fix, also: git add src/lib/claude-terminal/cli-service.ts
git commit -m "$(cat <<'EOF'
docs(features): bug #3 investigation — Claude code-1 exit under chained dispatch

[One paragraph from the actual investigation: what the spawn/exit path does,
 whether a code-1 exit emits an SSE event or only onerror, and the verdict —
 a found cause + fix, or transient/environmental with Task 2 ensuring it is
 non-fatal.]

Spec: docs/superpowers/specs/2026-05-21-cli-session-subsystem-fix-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```
Substitute the `[One paragraph...]` with the actual conclusion. If Step 3 applied a fix, mention it and stage `cli-service.ts` too.

---

## Task 4: Live verification of #1 (CONTROLLER-DRIVEN)

> **Controller-driven task.** Creates a throwaway diagnostic probe, runs it live, confirms #1, deletes the probe. Run the live spec via the Bash tool with `run_in_background: true`.

**Files:**
- Create then delete: `e2e/cli-fix-probe.spec.ts`

- [ ] **Step 1: Pre-flight**

```bash
git log --oneline -4
npx tsc --noEmit
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://localhost:3010
```
Expected: Task 1 + Task 2 (+ Task 3) commits present; `tsc` clean; dev server on 3010 responds `200`. If the server is down, start `npm run dev -- -p 3010` separately — do not kill any process.

- [ ] **Step 2: Create the #1 probe**

Create `e2e/cli-fix-probe.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { setupHarnessMode, completeSetupWizard, waitForCliComplete } from './helpers/harness-mode';

/**
 * Verifies fix #1: a dispatched pof-cli-prompt now auto-submits and starts a
 * session WITHOUT the harness Send-click workaround. Dispatches acb-1 by
 * clicking only the module "Claude" button — never pof-cli-panel-send-btn —
 * then waits for the session to complete. Throwaway diagnostic, not a
 * regression test. Run with HARNESS_MODE=live.
 */
test('fix #1: dispatched prompt auto-submits without the Send-click', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  expect(process.env.HARNESS_MODE, 'requires HARNESS_MODE=live').toBe('live');

  await setupHarnessMode(page);
  page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);

  await page.getByTestId('pof-sidebar-nav-item-core-engine').click();
  await page.getByTestId('pof-sidebar-l2-nav-item-arpg-combat').click();
  await page.getByRole('tab', { name: 'Roadmap' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Card view' }).click();
  await page.waitForTimeout(300);

  const row = page.getByTestId('pof-module-arpg-combat-checklist-item-acb-1');
  await row.hover();
  await row.getByRole('button', { name: /^Claude$/i }).click();
  // Deliberately do NOT click pof-cli-panel-send-btn — fix #1 must auto-submit.

  const result = await waitForCliComplete(page, 'fix1-acb-1', 6 * 60_000);
  console.log(`[probe] success=${result.success} durationMs=${result.durationMs} timedOut=${result.timedOut}`);
  expect(result.success, 'a session must start + complete from the dispatch alone').toBe(true);
});
```

- [ ] **Step 3: Run the probe live (background)**

Run via the Bash tool with `run_in_background: true` and `timeout: 660000`:
```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/cli-fix-probe.spec.ts --reporter=list
```

- [ ] **Step 4: Wait for completion, read the result**

When notified, read the task output. Expected: `1 passed`, and the `[probe]` line shows `success=true` with a real duration (tens of seconds — a real session), not `timedOut` and not the 90 s appear-ceiling. This proves fix #1: the dispatched prompt auto-submitted and ran with no Send-click.

If it fails (`success=false` / timed out): fix #1 is not working — STOP, do not delete the probe, report the failure with the probe output for diagnosis.

- [ ] **Step 5: Delete the probe + final summary**

On success:
```bash
rm e2e/cli-fix-probe.spec.ts
```
The probe is throwaway — nothing to commit. Post a single chat summary:
```
CLI-session subsystem fix complete. Commits:
- <SHA_T1>  fix(cli): submit dispatched prompts directly
- <SHA_T2>  fix(cli): release session on abnormal stream exit
- <SHA_T3>  docs(features): bug #3 investigation [+ fix if applied]

#1 verified live: dispatched acb-1 auto-submitted and ran ([Ns], success) with
no Send-click. #2 verified by inspection + npm run validate; its real-world
proof is the resumed SP-B chunk run no longer hanging on a failed process.
#3: [found cause + fix | transient, non-fatal via #2].

Next: resume SP-B at Task 3 (gated chunk-1 live run).
```

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec "Fix #1" → Task 1 (tqRef + direct-submit handler + handleBuildFix + delete effect/pendingPromptRef). Spec "Fix #2" → Task 2 (`onerror` completes the task, `completed` once-guard). Spec "Investigate #3" → Task 3 (read, conclude, conditional fix). Spec "Verification" → Task 1/2 Steps validate + Task 4 (#1 live probe); #2-by-inspection is stated honestly in Task 4 Step 5. Spec DoD items 1-6 all map.
- [x] **Placeholder scan:** the only bracketed text is `[One paragraph...]` in Task 3 Step 5's commit and `<SHA_*>` / `[Ns]` / `[found cause...]` in Task 4 Step 5's summary — all explicit runtime substitutions labelled "from the actual investigation/run". Every code step shows complete code.
- [x] **Type consistency:** `tqRef` (a `useRef(tq)`) is read as `tqRef.current` in Task 1 Step 2; `tq.submitPrompt(prompt: string, resume: boolean)` matches the signature `handleSubmit` already uses. `handleBuildFix` keeps the `(prompt: string)` signature. Task 2's `completed` flag, `currentTaskIdRef`, `registerTaskComplete`, `onTaskComplete` all match existing `useTaskQueue` symbols. The `pof-cli-prompt`/`pof-cli-panel-send-btn`/`waitForCliComplete` names in Task 4 match the harness.
- [x] **`handleBuildFix` dependency handled:** it relied on the deleted auto-submit effect — Task 1 Step 3 rewrites it to submit directly in the same edit, so deleting the effect does not silently break build-fix.
- [x] **No double-submit:** Task 1's direct submit + the surviving harness Send-click + a manual click are all guarded by `handleSubmit`'s empty-input/isStreaming check and the task queue's `dispatchedTaskIds` idempotency — noted in the Task 1 commit message.
- [x] **Bite-sized + controller-driven flagged:** Tasks 1-2 are ~6/3 steps; Task 3 is investigation; Task 4 header + Step 3 explicitly say `run_in_background: true`.

---

## After this plan — resume SP-B

Once committed and the #1 probe is green, SP-B resumes at **Task 3 (chunk 1 live run)** from `docs/superpowers/plans/2026-05-20-arpg-vertical-slice-sp-b.md`: a gated live re-run of `arpg-vertical-slice-sp-b.spec.ts --grep "chunk 1"` (keep-awake pre-flight, ~40 min cap), the artifact-inspection checkpoint, then Task 4 (chunk 2). The harness Send-click workaround is kept as defense-in-depth; the real fix is now in the app.
