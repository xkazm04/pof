# 2a — Agentic Visual-Verification Dispatch Step (Design)

**Status:** Approved 2026-05-23. Folder-04 (HUD/UI) Phase 2a. Implements `docs/improvements/04-hud-ui/pof-app.md` §5 and `tests.md` PoF-app §3 + E2E §1.

## Goal

Make a screenshot + Gemini-vision check a standard, opt-in tail step of UI-producing dispatches, so the empty-`UProgressBar`, behind-debug-text, and wrong-pin-material-renders-black failure classes are caught automatically — without the operator running anything.

## Approach (decided in brainstorming)

**Agentic, with a thin host-side Gemini proxy.** The dispatched Claude CLI (which runs in the UE project dir) does the project-side work — confirm build, launch the slice, take a `HighResShot`, find the newest PNG. It then POSTs the screenshot *path* to a new app route that owns the Gemini call (reusing the app's existing `gemini-2.0-flash` access) and the recording. The app and the UE screenshots are on the same machine (localhost), so the route reads the PNG by path — no base64 payloads.

Decisions locked:
- **Trigger:** per-item opt-in flag `visualCheck?: boolean` on `ChecklistItem`.
- **Gemini step:** Claude reports the screenshot path to `POST /api/verify/visual`; the route runs Gemini + records + returns the verdict.
- **Semantics:** advisory. The verdict is recorded and surfaced; it never blocks the checklist `complete` callback. Failures (build/launch/no-screenshot/no-API-key) degrade gracefully.

## Architecture

```
Checklist item (visualCheck:true) dispatched
        │  buildTaskPrompt(checklist) appends buildVisualCheckSection(...)
        ▼
Claude CLI (cwd = UE project)
   1. confirm build compiles
   2. UnrealEditor.exe <uproject> <map> -game -windowed -ResX=1280 -ResY=720 \
        -ExecCmds="HighResShot 1280x720"   (then kill)
   3. find newest PNG in <projectPath>/Saved/Screenshots/WindowsEditor
   4. POST { moduleId, itemId, screenshotPath } → <appOrigin>/api/verify/visual
        │
        ▼
/api/verify/visual (Node, same machine)
   - read PNG from disk
   - Gemini gemini-2.0-flash, server-owned structured HUD-check prompt
       → { visibleElements[], anyEmptyOrZeroWidth, verdict:'pass'|'fail', notes }
   - record row via visual-verification-db
   - emit eval.visual on the event bus
   - return verdict (apiSuccess)
        │
        ▼
Claude summarizes the verdict in the terminal; checklist completion proceeds normally.
```

## Components

### 1. `ChecklistItem.visualCheck?: boolean`
`src/types/modules.ts`. Optional; absent ⇒ no visual check. Set `true` on `arpg-ui` items that render an on-screen element: `au-1`, `au-3`, `au-4`, `au-7`, `au-8`. Left unset on `au-2` (attribute binding, no new element), `au-5`/`au-6` (slice-skip).

### 2. `buildVisualCheckSection(opts)` — `src/lib/prompts/visual-check.ts`
Pure function returning the markdown section. Inputs: `{ projectPath, appOrigin, moduleId, itemId, editorExe, map, resX, resY, screenshotDir }`. Resolves:
- `editorExe`: `process.env.POF_UE_EDITOR` ?? the e2e default `C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe`.
- `map`: `process.env.POF_VERIFY_MAP` ?? `/Game/Maps/VerticalSlice`.
- `screenshotDir`: `<projectPath>/Saved/Screenshots/WindowsEditor`.
- `resX`/`resY`: 1280×720.

The section is a `## Visual Verification` block: it tells Claude the exact launch command, that it must wait ~25s then kill the editor, where to find the newest screenshot, and to POST the path to `<appOrigin>/api/verify/visual`. It states the check is advisory — report the verdict, do not loop on a fail.

### 3. `buildTaskPrompt` wiring — `src/lib/cli-task.ts`
In the `checklist` case, after the existing sections, append `buildVisualCheckSection(...)` when `(task as ChecklistTask)` is for an item with `visualCheck === true`. The item's flag is resolved from the registry (`getChecklistItem(moduleId, itemId)`), since `ChecklistTask` carries `itemId`. Add the item's `visualCheck` to `ChecklistTask` (passed by `TaskFactory.checklist`) to avoid a registry lookup in the prompt builder. Append only for UE projects (`isUE5`).

### 4. `POST /api/verify/visual` — `src/app/api/verify/visual/route.ts`
- Body: `{ moduleId: string, itemId: string, screenshotPath: string }` (+ optional `projectPath`).
- Reads the PNG; if missing → `apiError('screenshot not found', 404)`.
- Resolves the key like the agents routes: `process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY`; if absent → `apiError('Gemini API key not configured', 503)`.
- Calls `gemini-2.0-flash` with the PNG (inlineData) + a server-owned prompt that demands a strict JSON object: `{ visibleElements: string[], anyEmptyOrZeroWidth: boolean, verdict: 'pass'|'fail', notes: string }`. The prompt wording derives from `e2e/fixtures/gemini-prompts/hud-check.txt` (the load-bearing "do any read as empty/zero-width?" phrasing) but reframed for structured output.
- Records a row (component 5), emits `eval.visual` (component 6), returns `apiSuccess(verdict)`.
- Mirrors the SDK usage already in `src/app/api/agents/forge-ability/route.ts`.

### 5. `src/lib/visual-verification-db.ts`
better-sqlite3 module following the existing `*-db.ts` pattern (WAL, shared `~/.pof/pof.db`). Table `visual_verifications`: `id INTEGER PK, module_id TEXT, item_id TEXT, project_path TEXT, screenshot_path TEXT, verdict TEXT, any_empty INTEGER, elements TEXT(json), notes TEXT, created_at TEXT`. Functions: `recordVisualVerification(row)`, `listVisualVerifications(moduleId?)`.

### 6. Event bus — `src/lib/event-bus.ts`
Add `eval.visual` to the `eval.*` namespace typing. Payload: `{ moduleId, itemId, verdict, anyEmpty, notes, screenshotPath }`. Terminal/eval UI can subscribe; a dedicated panel is a follow-up (out of scope here).

## Data flow / error handling

- Advisory throughout: the checklist `complete` callback is unchanged and fires regardless of verdict.
- If the build fails or the launch produces no screenshot, Claude reports it in the terminal and skips the POST; nothing is recorded for that run. No crash, no block.
- Route validates inputs and returns the standard `{success,...}` envelope; the agentic prompt instructs Claude to surface the route's error text if `success:false`.

## Testing

| Test | Asserts |
|------|---------|
| `visual-check.test.ts` (new) | `buildVisualCheckSection` contains the launch command, the screenshot dir derived from `projectPath`, and `POST .../api/verify/visual`; honours env overrides for editor exe + map |
| `cli-task` step-injection test (extend `arpg-ui-prompt.test.ts` or new) | a `checklist` prompt for a `visualCheck:true` item contains `## Visual Verification`; a `visualCheck`-absent item does **not** (tests.md PoF §3) |
| `visual-verify-route.test.ts` (new) | with mocked Gemini: records a row, emits `eval.visual`, returns the parsed verdict; missing-file → 404; no key → 503 |
| `visual-verification-db.test.ts` (new) | insert + list round-trips; list filters by moduleId |
| `e2e/hud-from-scratch.spec.ts` (new, tests.md E2E §1) | uses the existing `launchAndScreenshot` + `geminiCheck` primitives to confirm a bar renders on a real launch (parallel e2e validation; not gated on the in-app route) |

## Out of scope / follow-ups
- A dedicated in-app "Visual checks" panel (consume `eval.visual`). MVP surface = terminal + DB row + event.
- Blocking semantics / auto-fix loops.
- Non-UE / web project support (N/A — needs a launchable game).

## File structure
- Create: `src/lib/prompts/visual-check.ts`, `src/app/api/verify/visual/route.ts`, `src/lib/visual-verification-db.ts`, `e2e/hud-from-scratch.spec.ts`, tests above.
- Modify: `src/types/modules.ts` (`visualCheck`), `src/lib/module-registry.ts` (set flags), `src/lib/cli-task.ts` (`ChecklistTask.visualCheck` + append section), `src/lib/event-bus.ts` (`eval.visual`).
