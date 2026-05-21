# SP-E: Packaged-build Launch Smoke-test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the SP-C packaged `PoF.exe` launches and survives a 25 s window, then record an honest verdict on the five vertical-slice success criteria and scope the next phase.

**Architecture:** A new Playwright spec (`e2e/arpg-vertical-slice-sp-e.spec.ts`) uses Node `child_process` only — no browser, no `page` — to spawn the staged build, observe whether the real game process stays alive, capture the engine log tail, then a findings doc and a scenario-report refresh record the truthful outcome.

**Tech Stack:** TypeScript, Playwright (test runner only), Node `child_process` (`spawn`, `execFileSync`), Windows `tasklist`/`taskkill`.

**Spec:** `docs/superpowers/specs/2026-05-21-arpg-vertical-slice-sp-e-design.md`

---

## Planning-time facts (verified)

1. **Staged build exists** at `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\StagedBuilds\Windows\PoF.exe` (SP-C produced it).
2. **`PoF.exe` at the stage root is a bootstrap launcher.** The SP-C cook log printed `Patching bootstrap executable; …\Intermediate\Staging\PoF.exe`. The real game process is `PoF-Win64-Shipping.exe` (under `…\StagedBuilds\Windows\PoF\Binaries\Win64\`). The bootstrap may exit independently of the game, so the honest "is it alive" signal is **whether `PoF-Win64-Shipping.exe` is running**, checked via `tasklist` — not the spawned bootstrap's exit event.
3. **Engine log** is written to `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Logs\PoF.log`.
4. **The project has no playable content** — zero `.umap` files, no `GlobalDefaultGameMode`, no default/startup map, no Blueprints, no placed actors. So criteria #2–#5 cannot be verified; this is a fixed, known finding (not run-dependent).
5. **No app source change** — SP-E only launches an already-built artifact.
6. **ESLint** — `no-console` is a *warning*, not an error; `npm run lint` exits 0 with warnings (the repo currently carries ~813). A `console.log` of the test result is acceptable.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `e2e/arpg-vertical-slice-sp-e.spec.ts` | Create | Spawn the staged build, observe game-process survival, capture the log tail, assert |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-e-smoke.md` | Create | Honest verdict: smoke-test result + five-criteria table + next-phase scope |
| `docs/features/arpg-vertical-slice/SCENARIO-REPORT.md` | Modify | Mark steps 22–24, add the SP-E section, state the final verdict |

Total: **2 created, 1 modified, 3 commits.**

---

## Task 1: The launch smoke-test spec

**Files:**
- Create: `e2e/arpg-vertical-slice-sp-e.spec.ts`

- [ ] **Step 1: Create the smoke-test spec**

Create `e2e/arpg-vertical-slice-sp-e.spec.ts` with exactly this content:

```typescript
import { test, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { stat, readFile } from 'node:fs/promises';

const STAGE_DIR = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\Saved\\StagedBuilds\\Windows';
const BOOTSTRAP_EXE = `${STAGE_DIR}\\PoF.exe`;
/** The real game process the bootstrap launches — the honest "is it alive" signal. */
const GAME_IMAGE = 'PoF-Win64-Shipping.exe';
const LOG_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\Saved\\Logs\\PoF.log';
const OBSERVE_MS = 25_000;

function imageRunning(image: string): boolean {
  try {
    const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH'], { encoding: 'utf-8' });
    return out.toLowerCase().includes(image.toLowerCase());
  } catch {
    return false;
  }
}

function killImage(image: string): void {
  try {
    execFileSync('taskkill', ['/IM', image, '/T', '/F'], { stdio: 'ignore' });
  } catch { /* not running — fine */ }
}

test.describe('ARPG vertical slice — SP-E packaged-build smoke-test', () => {
  test('packaged PoF.exe launches and the game process survives', async () => {
    test.setTimeout(90_000);

    // 1. The staged build must exist (SP-C must have cooked it).
    try {
      await stat(BOOTSTRAP_EXE);
    } catch {
      throw new Error(`SP-E: staged exe not found at ${BOOTSTRAP_EXE} — run the SP-C cook first.`);
    }

    // 2. Launch the build the way a player would — the staged PoF.exe bootstrap.
    const child = spawn(BOOTSTRAP_EXE, ['-windowed', '-ResX=1280', '-ResY=720', '-log'], {
      cwd: STAGE_DIR,
      stdio: 'ignore',
    });
    let bootstrapExit: number | null = null;
    let spawnError = '';
    child.on('exit', (code) => { bootstrapExit = code; });
    child.on('error', (err) => { spawnError = err.message; });

    // 3. Observe for a fixed window.
    await new Promise((r) => setTimeout(r, OBSERVE_MS));

    // 4. Honest signal: is the real game process alive?
    const gameAlive = imageRunning(GAME_IMAGE);

    // 5. Clean up — kill the game process and the bootstrap.
    killImage(GAME_IMAGE);
    if (child.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch { /* already gone */ }
    }
    await new Promise((r) => setTimeout(r, 1500));

    // 6. Capture the engine log tail.
    let logTail = '(PoF.log not found)';
    try {
      const log = await readFile(LOG_PATH, 'utf-8');
      logTail = log.split(/\r?\n/).filter(Boolean).slice(-60).join('\n');
    } catch { /* keep default */ }

    console.log(
      `\n===== SP-E SMOKE-TEST RESULT =====\n` +
      `gameProcessAlive=${gameAlive}\n` +
      `bootstrapExitCode=${bootstrapExit}\n` +
      `spawnError=${spawnError || '(none)'}\n` +
      `----- PoF.log tail (last 60 non-empty lines) -----\n${logTail}\n` +
      `===== END SP-E RESULT =====\n`,
    );

    expect(gameAlive, `the packaged game process (${GAME_IMAGE}) must be alive after ${OBSERVE_MS}ms`).toBe(true);
  });
});
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean (no output).

- [ ] **Step 3: Lint the spec**

```bash
npx eslint e2e/arpg-vertical-slice-sp-e.spec.ts
```
Expected: 0 errors. A `no-console` *warning* on the `console.log` is acceptable — the test result must reach stdout. Do not remove the `console.log`.

- [ ] **Step 4: Run the smoke-test**

```bash
npx playwright test e2e/arpg-vertical-slice-sp-e.spec.ts --reporter=list
```
This launches the real `PoF.exe` in a 1280×720 window for 25 s, then terminates it. Total ~40 s.

Capture the full output. Record from the `===== SP-E SMOKE-TEST RESULT =====` block: `gameProcessAlive`, `bootstrapExitCode`, `spawnError`, and the `PoF.log` tail. Note pass/fail:
- **passed** — the game process was alive at 25 s; the build is not dead-on-arrival.
- **failed** — the game process was not alive. This is a legitimate, recorded outcome (the build packages but is not runnable), **not** something to work around. Task 2 records it honestly either way.

- [ ] **Step 5: Commit**

```bash
git add e2e/arpg-vertical-slice-sp-e.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): SP-E packaged-build launch smoke-test

Spawns the SP-C staged PoF.exe, observes whether the real game process
(PoF-Win64-Shipping.exe) survives a 25s window, captures the PoF.log tail,
then terminates it. A process-only test — no browser, no page. This is the
honest extent of verification possible: the project has no playable level, so
the gameplay success criteria cannot be exercised.

Spec: docs/superpowers/specs/2026-05-21-arpg-vertical-slice-sp-e-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 2: The honest verdict findings doc

**Files:**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-e-smoke.md`

- [ ] **Step 1: Write the findings doc**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-e-smoke.md`. Use exactly the template below; replace **only** the three bracketed `«…»` spans with the real values observed in Task 1 Step 4. Everything else is fixed content — write it verbatim.

````markdown
# Scenario Run — 2026-05-21 (SP-E: packaged-build launch smoke-test)

**Result:** «PASS — the packaged build launches and the game process survives / FAIL — the game process did not survive launch».

## Smoke-test

The SP-C staged build (`…\PoF\Saved\StagedBuilds\Windows\PoF.exe`) was spawned
windowed (`-windowed -ResX=1280 -ResY=720 -log`) and observed for 25 s.

- `PoF-Win64-Shipping.exe` alive after 25 s: «true / false»
- Bootstrap exit code: «value»

### `PoF.log` tail

```
«the PoF.log tail captured by the smoke-test»
```

## The five vertical-slice success criteria — verdict

| # | Criterion | Verdict |
|---|-----------|---------|
| 1 | Packaged Win64 Shipping build launches as a standalone `.exe` | «✅ verified — process launched and survived 25 s / ❌ failed — see above» |
| 2 | WASD moves the character on a flat level with collisions | ⛔ Not verifiable — no level |
| 3 | LMB triggers the attack ability; montage plays | ⛔ Not verifiable — nothing to run |
| 4 | Attack hits a dummy enemy and reduces its Health | ⛔ Not verifiable — no placed enemy |
| 5 | Enemy at Health ≤ 0 is destroyed; a loot pickup spawns | ⛔ Not verifiable — nothing to run |

**Why #2–#5 are not verifiable.** The UE project has no playable content:
zero `.umap` files, no `GlobalDefaultGameMode` and no default/startup map, no
Blueprints deriving from the C++ gameplay classes, and no placed actors. SP-B
generated the gameplay *systems* as C++ classes and SP-C packaged them, but a
runnable level was never assembled. The packaged build launches a process; it
does not launch a game.

## Next phase — what the full cycle needs

To accomplish the full cycle (an actually-runnable vertical slice that
satisfies criteria #2–#5), the following artifacts and dependencies are
required. This is the scope for the next brainstorm — listed here, not built
in SP-E:

- **A playable level** — a `.umap` with a floor mesh + collision, lighting, a
  `PlayerStart`, and a placed dummy enemy. UE maps are binary assets and cannot
  be authored as text; this needs an editor commandlet / Python editor script,
  or a level constructed at runtime in C++ (the project already has
  `ARPGLevelGenerator`).
- **Blueprints (or C++ class defaults)** deriving from `ARPGPlayerCharacter` /
  `ARPGEnemyCharacter`, configured with meshes, the `AnimInstance`, GAS ability
  grants, and the input mapping context.
- **GameMode + default-map wiring** — `GlobalDefaultGameMode`,
  `GameDefaultMap` / `EditorStartupMap` in `DefaultEngine.ini`, default pawn.
- **Asset dependencies** — at minimum a character skeletal mesh and an
  `IMC_Default` input mapping context wired to `IA_Move` / `IA_Attack`.
- **A verification mechanism** — once a slice exists, automated keyboard
  simulation or an in-engine automation test to check criteria #2–#5.

**Key open problem for that phase:** PoF's autonomous Claude generates *code*
well, but UE *content* (maps, Blueprints, meshes) is binary and cannot be
authored as text. The next phase must decide how content is created — editor
scripting, procedural C++ construction, or a manual content checkpoint.
````

- [ ] **Step 2: Commit**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-e-smoke.md
git commit -m "$(cat <<'EOF'
docs(features): SP-E smoke-test findings — honest packaged-build verdict

Records the launch smoke-test outcome, the five-criteria verdict (criterion 1
addressed by the smoke-test; 2-5 not verifiable — no playable level exists),
and scopes the next phase: the artifacts and dependencies needed for a
runnable vertical slice.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Close the scenario report

**Files:**
- Modify: `docs/features/arpg-vertical-slice/SCENARIO-REPORT.md`

- [ ] **Step 1: Update Phase 8 (steps 22–24) in §3**

In `SCENARIO-REPORT.md`, find the "Phase 8 — Slice verification" table. Replace its two rows:

Old:
```markdown
| 22–23 | Launch `.exe`, drive WASD+LMB, verify 5 success bullets | ○ | Not attempted. **Rec:** this is the hardest-to-automate phase (needs keyboard simulation or frame-diffing). Consider a manual checkpoint here first, automate later. |
| 24 | Capture findings | ✅ (ongoing) | This report + the per-run docs are that deliverable. |
```

New:
```markdown
| 22 | Launch the packaged `.exe` | ✅ | **SP-E: done.** `e2e/arpg-vertical-slice-sp-e.spec.ts` spawned the staged `PoF.exe`; smoke-test result in [`2026-05-21-live-sp-e-smoke.md`](./scenario-runs/2026-05-21-live-sp-e-smoke.md). |
| 23 | Drive WASD+LMB, verify gameplay bullets | ⛔ | **Not verifiable.** The project has no playable level (no `.umap`, no GameMode/default map, no Blueprints, no placed actors) — criteria #2–#5 cannot be exercised. The next phase must assemble runnable content first; scope in the SP-E findings doc. |
| 24 | Capture findings | ✅ | This report + the per-run docs. SP-E adds the packaged-build verdict. |
```

- [ ] **Step 2: Mark SP-E complete in §2 intro**

In `SCENARIO-REPORT.md` §2, find:
```markdown
A post-D9 roadmap (P0–P3, see §5) adds sub-projects SP-A through SP-E; **SP-A, SP-B, and SP-C are complete.**
```
Replace `**SP-A, SP-B, and SP-C are complete.**` with `**SP-A, SP-B, SP-C, and SP-E are complete — the roadmap is closed.**`

- [ ] **Step 3: Add the SP-E section to §2**

In `SCENARIO-REPORT.md` §2, immediately after the SP-C section (the line `**Result — SP-C delivered.** …` and its following `---`), insert:

```markdown
### Sub-project SP-E — packaged-build smoke-test + honest verdict (2026-05-21)

Final roadmap sub-project (operator-flow steps 22–24). Exploring the project
invalidated the original "verify the slice in PIE" premise: there is **no
playable content** — zero `.umap` files, no `GlobalDefaultGameMode`/default
map, no Blueprints, no placed actors. SP-B generated the gameplay systems as
C++ and SP-C packaged them, but a runnable level was never assembled.

SP-E was re-scoped to a **launch smoke-test plus an honest verdict**.
`e2e/arpg-vertical-slice-sp-e.spec.ts` spawns the staged `PoF.exe`, observes
whether the real game process survives a 25 s window, and captures the engine
log. Outcome: «PASS — the packaged build launches and the game process
survives / FAIL — the game process did not survive launch». Of the five
success criteria, **#1 (the build launches)** is addressed by the smoke-test;
**#2–#5 (gameplay)** are honestly recorded as **not verifiable** — there is
nothing runnable to exercise.

The SP-E findings doc scopes the next phase: the artifacts and dependencies
(a level, Blueprints, GameMode/default-map wiring, asset deps, a verification
mechanism) needed for an actually-runnable slice — see
[`2026-05-21-live-sp-e-smoke.md`](./scenario-runs/2026-05-21-live-sp-e-smoke.md).

---
```

Replace the `«PASS … / FAIL …»` span with the real Task 1 outcome.

- [ ] **Step 4: Update the executive summary verdict in §1**

In `SCENARIO-REPORT.md` §1, find the "What we did NOT prove" paragraph (it begins `**What we did NOT prove:** a *complete, playable* slice.`). Replace that whole paragraph with:

```markdown
**What we did NOT prove:** a *playable* slice. The live harness drives operator-flow steps 6–22 — the gameplay systems are generated (SP-B), packaged (SP-C), and the packaged build's launch is smoke-tested (SP-E). But steps 23–24's gameplay verification cannot be done: the project has **no playable content** — no level, no GameMode/default map, no Blueprints, no placed actors. The autonomous build produced gameplay *systems* as C++ and a *packaged binary*, but never an assembled, runnable game. Closing that gap — authoring UE content, which is binary and cannot be generated as text — is the next phase, scoped in the SP-E findings doc.
```

- [ ] **Step 5: Add the SP-E artifact link in §6**

In `SCENARIO-REPORT.md` §6, immediately after the SP-C artifact-index line (`- SP-C (packaging): …`), insert:

```markdown
- SP-E (packaged-build smoke-test): spec [`2026-05-21-...-sp-e-design.md`](../../superpowers/specs/2026-05-21-arpg-vertical-slice-sp-e-design.md), plan [`2026-05-21-...-sp-e.md`](../../superpowers/plans/2026-05-21-arpg-vertical-slice-sp-e.md), spec `e2e/arpg-vertical-slice-sp-e.spec.ts`, findings [`2026-05-21-live-sp-e-smoke.md`](./scenario-runs/2026-05-21-live-sp-e-smoke.md)
```

- [ ] **Step 6: Commit**

```bash
git add docs/features/arpg-vertical-slice/SCENARIO-REPORT.md
git commit -m "$(cat <<'EOF'
docs(features): close scenario report — SP-E complete, roadmap closed

Marks operator-flow steps 22-24, adds the SP-E section, and states the final
verdict: PoF drove autonomous Claude to generate the ARPG gameplay systems and
package them, and the packaged build's launch is smoke-tested — but no
runnable playable content was ever assembled, so an end-to-end playable slice
was not achieved. The path to close that gap is the next phase.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

- [ ] **Step 7: Final chat summary**

Post a single message:
```
Sub-project SP-E complete — the SP-A…SP-E roadmap is closed. Commits:
- <SHA_T1>   test(e2e): SP-E packaged-build launch smoke-test
- <SHA_T2>   docs(features): SP-E smoke-test findings
- <SHA_T3>   docs(features): close scenario report

Smoke-test: [PASS — PoF.exe launches, game process survives 25s | FAIL — ...].
Criteria: #1 launch [verified/failed]; #2–#5 gameplay not verifiable (no
playable content).

Initiative verdict: PoF drove autonomous Claude to generate the ARPG gameplay
systems (SP-B) and package them (SP-C); the packaged build launches (SP-E).
A runnable, playable slice was not achieved — no level/Blueprints/content was
generated. Next phase: assemble + run the game (scoped in the SP-E findings).
```

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec Part 1 (launch smoke-test) → Task 1. Part 2 (honest verdict report) → Task 2. Part 3 (next-phase scope) → Task 2's findings doc "Next phase" section. Part 4 (close the scenario report) → Task 3. Spec DoD 1–4 map (1 → Task 1; 2 → Task 2; 3 → Task 3; 4 → Task 3 Steps 6–7). The five-criteria disposition table from the spec → Task 2's template table.
- [x] **Placeholder scan:** the only bracketed text is the three `«…»` substitution spans in Task 2's template and the matching span in Task 3 Step 3 + the summary — each explicitly labelled as a real-value substitution from Task 1's run. No "TBD"/"handle errors"/vague steps. Task 1's code block is the complete file; Task 3's edits give exact old/new text.
- [x] **Type consistency:** the spec's identifiers are used consistently — `BOOTSTRAP_EXE` / `GAME_IMAGE` / `imageRunning` / `killImage` defined once and used as defined. `tasklist`/`taskkill` invocations match. The findings filename `2026-05-21-live-sp-e-smoke.md` and the spec path are identical across Tasks 2 and 3.
- [x] **Honest-failure handling:** Task 1 Step 4 and Task 2's template both explicitly carry the FAIL branch — a non-surviving process is recorded as-is, not worked around (matches the spec's risk section).
- [x] **No app source change:** confirmed — only `e2e/`, `docs/`. Matches spec non-goals.
- [x] **Bite-sized:** T1 = 5 steps, T2 = 2, T3 = 7. Each is a single action.
