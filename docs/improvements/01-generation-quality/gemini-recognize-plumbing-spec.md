# Gemini-Recognize Plumbing — Test Spec

**Date:** 2026-05-24
**Status:** Spec only — no test code yet (see "Why no code" below).
**Source requirement:** `docs/improvements/01-generation-quality/tests.md` → "E2E harness extensions" #2:
> A `gemini-recognize.mjs` plumbing test — a Playwright e2e that runs the `gemini-recognize.mjs`
> CLI against a known reference PNG (committed into `e2e/fixtures/`) and snapshots the response shape.

## Why no code (the ground-truth correction)

`gemini-recognize.mjs` **does not exist** anywhere in the repo (verified 2026-05-24). There is nothing
to plumb against in CLI form, so a test that invokes it would test nothing. **But the underlying
capability the sub-projects actually depended on is alive** — it just lives in a server route, not a
standalone CLI:

- **Load-bearing path:** `POST /api/verify/visual` (`src/app/api/verify/visual/route.ts`). The
  dispatched Claude CLI takes a HighResShot and POSTs `{ moduleId, itemId, screenshotPath, projectPath?,
  mode? }`; the route reads the PNG (same machine), calls **Gemini** via `@google/genai`
  (`GoogleGenAI`, model `gemini-2.0-flash`, key from `GEMINI_API_KEY` || `GOOGLE_AI_API_KEY`), runs a
  server-owned prompt per `mode`, records the verdict, emits `eval.visual`, and returns the raw verdict
  in the `{ success, data }` envelope.
- **Prompt builder side:** `src/lib/prompts/visual-check.ts` injects the screenshot+verify dispatch step.
- The HUD / Characters / PS-3 / texture / lighting gates all flowed through **this route** (each gate is
  a `mode`: `hud` | `texture` | `lighting` | `character`). A silent break here would degrade those gates
  exactly as a broken CLI would.

So this spec re-targets tests.md's intent at the path that actually carries the risk, and additionally
defines the CLI-form test for *if/when* a `gemini-recognize.mjs` is (re)added.

## What "plumbing" must guard

The failure mode to catch is **silent degradation of the Gemini integration** — the API client, key
wiring, request shape, or response parsing breaking so a visual gate quietly stops discriminating
pass/fail. The test asserts the *contract* (shape + the no-key path), **not** model judgement (which
drifts and would make the test flaky).

## Test 1 — `/api/verify/visual` no-key path (deterministic, runs in `npm run validate`)

A vitest test (no network, no key) that guards the wiring around the Gemini call.

- **File:** `src/__tests__/api/verify-visual-route.test.ts` (extend if it already exists; otherwise create).
- **Setup:** ensure `GEMINI_API_KEY` and `GOOGLE_AI_API_KEY` are unset for the test (`vi.stubEnv`).
- **Cases:**
  1. Missing `screenshotPath`/`moduleId`/`itemId` → `apiError` 400 (`{ success: false }`).
  2. Valid body but no API key configured → 503 with the "Gemini API key not configured" message
     (`getClient()` returns null). This proves the key-gate plumbing without calling Gemini.
  3. `screenshotPath` that does not exist on disk → 404.
- **Why deterministic:** none of these reach the network, so the test is hermetic and belongs in the
  default suite. It catches the most common plumbing regressions (envelope, validation, key-gate).

## Test 2 — Live shape snapshot (opt-in, gated on a real key)

A Playwright (or node) integration test that exercises the real Gemini round-trip against a committed
fixture and snapshots only the **response shape**.

- **Files:** `e2e/gemini-plumbing.spec.ts` (new); fixture `e2e/fixtures/hud-reference.png` (commit a
  small, license-clean PNG showing a HUD with a filled bar + a label).
- **Guard:** `test.skip(!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY, 'no Gemini key')`
  so it no-ops in normal CI and only runs where a key is present.
- **Body:**
  1. `POST /api/verify/visual` with `{ moduleId: 'gemini-plumbing', itemId: 'ref', mode: 'hud',
     screenshotPath: <abs path to e2e/fixtures/hud-reference.png> }`.
  2. Assert the envelope is `{ success: true, data: {...} }`.
  3. **Shape-only** assertions on `data` (per the route's `HudVerdict`): `visibleElements` is a
     `string[]`, `anyEmptyOrZeroWidth` is a `boolean`, `verdict` is `'pass' | 'fail'`, `notes` is a
     `string`. Do **not** assert the verdict value (model judgement drifts).
  4. Optionally repeat for `mode: 'texture' | 'lighting' | 'character'` with their respective fixtures,
     asserting each mode's documented shape (`tileable`/`issues`, `lit`/`shadowed`,
     `humanoidVisible`/`tPosed`/`distinct`).
- **Pin the model:** the route hardcodes `gemini-2.0-flash`; if that changes, this test re-snapshots.

## Test 3 — CLI form (only if `gemini-recognize.mjs` is added)

If a standalone `gemini-recognize.mjs` is (re)introduced, mirror Test 2 at the CLI boundary:
- Run `node gemini-recognize.mjs <e2e/fixtures/hud-reference.png>` via `execFile`.
- Parse stdout as JSON and apply the same **shape-only** assertions.
- Same key-gate skip. This is the literal tests.md ask; until the CLI exists it is not applicable.

## Implementer checklist

- [ ] Commit a small, license-clean reference PNG under `e2e/fixtures/` (HUD with a filled bar + label;
      add texture/lighting/character fixtures if covering those modes).
- [ ] Snapshot **shape, not content** — never assert the `verdict` value or `notes` text.
- [ ] Gate the live test on a key env var; keep the no-key path test in the default suite.
- [ ] Pin the model id; re-snapshot deliberately when the route's model changes.
- [ ] If `gemini-recognize.mjs` is added, add Test 3 and point it at the same fixtures.

## Motivation (from tests.md)

> Each Gemini check was load-bearing for a sub-project's gate. The plumbing test stops a silent
> regression in the CLI tool from passing a broken visual gate.

The risk is real but the surface moved from a CLI to `/api/verify/visual`; Tests 1–2 cover that surface
today, and Test 3 covers the CLI if it returns.
