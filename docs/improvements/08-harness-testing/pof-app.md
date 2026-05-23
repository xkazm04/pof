# 08 · Harness & Testing — PoF App Improvements

## Goals

Codify the verification patterns the vertical-slice initiative proved into
first-class harness primitives, surface them in PoF, and reduce the cost of
adding a new system-level test from "rewrite one of PS-1/HUD/Characters' specs"
to "compose a few harness helpers + a Gemini-prompt fixture."

## Status — implemented

Delivered in the PoF app repo (local commits `bf13f09`, `225298c`):

- ✅ **Reusable harness primitives** — `e2e/helpers/verification-core.ts`
  (pure, anti-gaming `parseAutomationLog`, `pickNewestScreenshot`,
  `resolveGeminiPrompt`, `parseVerifyResult`), `ue-verification.ts`
  (`runFunctionalTest`, `launchAndScreenshot`, `geminiCheck`,
  `runCookedVerifySlice`), `single-dispatch.ts`.
- ✅ **`gemini-prompts/` fixture directory** — `e2e/fixtures/gemini-prompts/*.txt`
  (character / hud / arena / texture / enemy-distinction), loaded by short name.
- ✅ **Composite "run all verifications" spec** — `e2e/all-verifications.spec.ts`,
  single-dispatch-isolated, mode-gated.
- ✅ **CI-runnable harness mode** — `e2e/helpers/ci-harness.ts`: resolves a third
  `ci` mode, gates UE checks on install presence, needs no dev server / no
  Gemini, and defines the CI vs full verification plans.
- ✅ **Dispatch-reliability dashboard** — `computeDispatchHealth()` +
  `DispatchHealthPanel.tsx` (sent / acked / in-flight / **stuck** / failed).
- ✅ **Fix-and-rerun-trap detector** — `detectFixAndRerunViolations()` (pure).

The items below are the parts of this brief that remain.

## Remaining planned work

### 1. Keep-alive editor — the live transport

The session manager exists: `KeepAliveEditor` (lazy start, command
serialization, reuse counting) + an injectable `EditorTransport`, unit-tested
with a fake transport. **Still planned:** a real transport implementing UE's
Python remote-execution protocol (the official `remote_execution.py` UDP
multicast handshake) so a single `UnrealEditor` process genuinely stays alive
between dispatches. Until that lands the wall-clock win — and the one-time
solve of the `MoverTests` plugin-content mount under the full editor — is
unrealized.

### 2. Fix-and-rerun linter — enforcement

`detectFixAndRerunViolations()` is a pure, tested detector but nothing calls it
on a PR. **Still planned:** a git-diff-driven wrapper (reads `git diff
--name-only`, greps CI config for an added `HARNESS_MODE=live` run, content-greps
changed specs for a `page.setContent`-style fixture) wired into `npm run
validate` or a GitHub Action so it actually **blocks** an unproven live-run
addition.

### 3. CI against a checked-in UE snapshot

CI mode currently gates on a local UE install and skips UE checks when none is
present. **Still planned:** a minimal checked-in UE-project snapshot (or a
containerized UE runner) so the functional test actually runs on CI without a
full engine install on the runner — the original §4 ambition.

## Verification this work succeeded

- ✅ A new system's verification can be composed from helpers in ~10 lines.
- ⚠️ The composite `all-verifications` spec runs end-to-end in < 10 min —
  **unverified end-to-end** (needs a UE-free editor window; see README).
- ⬜ The CI harness runs on every PoF-app PR — pending §2 enforcement + §3 snapshot.
- ✅ The fix-and-rerun detector flags a live-run addition lacking fixture
  coverage (unit-tested); ⬜ not yet a blocking CI gate.
