---
name: gap-loop
description: Iterative gap-coverage loop for the PoF /status map. Each run reads the map's truth (pipeline_artifacts + judge_verdicts + step-facts audit), picks the highest-value gap batch (unpowered media steps, unwired steps, deferred UE gates, unjudged content), executes it with the proven engine palette (Leonardo 2D + Qwen-VL gate, Tripo 3D, ElevenLabs SFX, UE Python/C++ + headless drain, Sonnet judge fleet), re-verifies through the full ladder, and journals state under .claude/gap-loop/. Invoke with "run gap-loop" / "gap-loop boot | pick | execute | verify | wrap".
---

# Gap Loop — systematic /status gap coverage

One question, run over run: **which cells on /status are not verified-green, and what is the highest-value batch that moves them — honestly?** The loop is the industrialized version of the 2026-07-07 transparency campaign (fleet audit → judge fleet → fix rounds → UE test gates: verified catalogs 4→14, 178/180 judge passes). Its law is inherited from that campaign: **never move a cell by weakening a checker — move it by making the claim true and letting the gate/judge confirm.**

> Engine vs. memory: this file is the engine. Cross-session memory lives in the
> **`.claude/gap-loop/` overlay** (`state.md`, `journal.md`, `lessons.md`) — gitignored
> scratch; read it FIRST every run so sessions compound instead of restarting.

## The flow (one line)

**BOOT (read truth) → PICK (one themed batch) → EXECUTE (engine palette) → VERIFY (ladder: checker → judge → gate) → WRAP (commit + journal + next-batch pointer).**

## BOOT — read the map's truth (never guess)

1. Overlay first: `.claude/gap-loop/state.md` (last batch, in-flight work, next-batch pointer).
2. The three truth sources (dev server on :3001/:3002 — verify via `/layout` 200):
   - `GET /api/pipeline-artifacts?catalogId=<id>` per catalog — statuses/tiers/reasons.
   - `GET /api/judge-verdicts` — content-quality layer (pass/fail + findings + model).
   - `src/lib/status/step-facts.json` — the fleet audit: per step `trueEngine`, `deliverable`, `generatorWired`, `judge`, `checkerMeaningful`. THIS is the gap classifier.
3. Build the gap inventory (a script over the above beats eyeballing):
   - **unpowered** — checker passed but audited `trueEngine: None` / no wired generator (icon galleries that never called Leonardo, audio steps with hand-typed numbers, VFX with no particle engine).
   - **unwired** — no artifact at all.
   - **deferred gates** — L3/L4 declared, honestly waiting (15 catalogs have no UE-side substance yet — their gap is really "UE Packaging never creates assets", fix THAT first).
   - **judge-fail** — content condemned with findings (e.g. character-pipeline 3D face, Qwen 6/10).
   - **unjudged** — steps whose audited judge class has no verdict yet (vlm steps blocked on "no real image exists").

## PICK — one themed batch per session

Rank by: (a) how many cells flip, (b) whether it unblocks a chain (a real 2D icon unblocks the VLM judge AND the atlas step AND UE packaging), (c) reuse of one engine setup across many cells. Typical themes, roughly in dependency order:

1. **2D media truth** — icon/concept gallery steps for N catalogs: generate real images (Leonardo), face/quality-gate them (Qwen-VL), store real asset refs, replay, VLM-judge. Kills the biggest unpowered block (~80 steps audited engine-None).
2. **3D media truth** — prop/creature/item mesh steps: Tripo v3.1 image→model (+rig/retarget where animated), game-tier convert (40k/2K ≈ 4MB), UE Interchange import, replay + VLM gate.
3. **Audio truth** — SFX/voice steps via the wired `POST /api/audio-gen` (ElevenLabs); music/ambient stems stay honestly unpowered until a music engine exists — do NOT fake them.
4. **UE packaging truth** — make `UE Packaging` steps actually create the DT_/DA_/BP_ assets headless (UE Python), then write the matching `PoF.<Catalog>.<Gate>` automation spec and drain it (the 15 deferred gates).
5. **Judge sweeps** — re-run the Sonnet fleet on new/changed content; VLM-judge every step that now has real pixels.

Present the picked batch in one short table (theme, cells expected to flip, engines used) before executing. Auto-proceed (the user opted into the loop); stop only for spend beyond ~$5 of paid API credits or destructive/product decisions.

## EXECUTE — the proven engine palette (recipes, hard-won)

- **Leonardo 2D**: `scripts/visual-gen/` (LEONARDO_API_KEY in `.env`). Every gen is download-then-delete. Face-priority prompts for characters; gate BEFORE spending downstream credits. **Style DNA (2026-07-13): campaign art must be style-consistent** — the repo batch tools `scripts/gap-loop/{power-icon,batch-generate}.mjs` pass `applyStyleDna: true` by default, so `/api/leonardo` appends the ACTIVE project style profile to every prompt and echoes `styleDnaApplied` (record it in findings/journal). Before a 2D batch: check `GET /api/visual-gen/style-dna` — if no active profile, distill one from a mood board (`POST` with data-URL images) or set `POF_STYLE_DNA=off` deliberately (journal why). Hand-rolled `/api/leonardo` calls in new batch scripts must pass the flag too.
- **Qwen-VL gate/judge (vision — ALWAYS before Gemini)**: `scripts/visual-gen/pof_vlm_critique.py --render <img> [--reference <img>] --model "Qwen/Qwen3-VL-4B-Instruct" --subject "<what+criteria>"` via the TripoSR venv python (`C:/Users/kazda/kiro/TripoSR/.venv/Scripts/python.exe`). Emits `POF_VLM_SCORE` (0-10; pass ≥7) + defects. POST the verdict to `/api/judge-verdicts` (judge `vlm`, model `qwen3-vl-4b`, findings citing defects).
- **Tripo 3D**: `scripts/visual-gen/pof_tripo.mjs` (image→model; `--model v3.1-20260211` for hero, NEVER default v2.5 for faces) and `pof_tripo_animate.mjs` (prerigcheck→rig→retarget presets). `convert_model` 40k faces/2K tex ≈ 14× smaller for game tier. Wallet is credits — check balance, gate 2D first.
- **UE headless**: `-run=pythonscript` for asset ops (PS 5.1: `& "C:\...\UnrealEditor-Cmd.exe" ...` — Start-Process NEVER, it drops quoting and boots the wrong project). Verify saves by re-reading; judge by `-abslog` markers, not exit code. Editor must be CLOSED for drains — ask the user.
- **UE tests**: before writing new C++ check `Source/PoF/Test/` — the 2026-07-07 lesson: most "missing" tests existed but were never compiled (rebuild first!) or name-mismatched (reconcile `runtimeDeferred('<name>')` ↔ registered spec names). New specs: IMPLEMENT_SIMPLE_AUTOMATION_TEST `"Project.Functional Tests.PoF.<Area>.<Name>"`, pure NewObject logic (ClassWithin classes need the right transient outer). Build: `& Build.bat PoFEditor Win64 Development <uproject> -waitmutex`.
- **Materials via MEL**: MaterialEditingLibrary can't introspect connections — classify TextureSamples by texture NAME; parameterize with NEUTRAL defaults (Tint white × albedo, Scale 1.0 × map) so visuals are preserved exactly. UE python f-strings forbid same-quote nesting.
- **Replay + drain**: after fixing content, `POF_WALK_APP_ORIGIN=<origin> POF_REPLAY_SPECS='[{catalogId,entityId,name,steps:[...]}]' npx vitest run src/__tests__/lib/catalog/pipelines/replay.walk.integration.test.ts` (server re-grades; also resets fail→deferred so the drain requeues), then `POST /api/pipeline-artifacts/drain {"tier":"L3","executor":"spawn","allowSpawn":true}` (needs POF_UE_EDITOR_CMD/POF_UE_UPROJECT in the dev server's env).
- **Sonnet judge fleet**: Workflow fan-out, one judge per catalog, schema-forced; verdicts POSTed to `/api/judge-verdicts` (judge `llm-panel`, findings citing actual values). **Judges must cross-check the row's SIBLING artifacts** — the round-2 lesson: fixes authored in isolation invent new contradictions (invented quest lore/reagents; wrong file — bespoke `itemsSteps.ts` ≠ artifact-truth `pipelines/items.ts`). Re-judge after EVERY fix.

## VERIFY — the ladder, no shortcuts

A batch is done only when each touched cell moved by EVIDENCE: server-graded artifact (checker) → judge verdict where the audited judge class demands one (llm-panel/vlm) → live gate for L3/L4 claims. Update `step-facts.json` entries whose facts changed (a step that now truly calls Leonardo flips `trueEngine`/`generatorWired` — that's what un-does UNPOWERED on the map). Honest reds STAY (the Qwen 3D-face ceiling is truth, not a bug). Run `npm run validate` before committing.

## WRAP — compound the memory

1. Commit app repo + UE repo separately, narrow `git add` (shared trees!). User pushes the app repo (kazimi66 403s on xkazm04/pof).
2. Update `.claude/gap-loop/state.md` (batch done, cells flipped counts from /status, next-batch pointer) + `journal.md` (one dated entry) + `lessons.md` (anything hard-won).
3. Print the delta: verified/unpowered/unwired counts before → after.

## Common mistakes (from the source campaign)

- Moving a cell by weakening its checker or hand-editing artifact status — the server re-grades; the judge re-catches; don't try.
- Authoring content without reading sibling artifacts (invents contradictions the panel will fail).
- Writing new UE tests before rebuilding + reconciling names against `Source/PoF/Test`.
- Faking media claims (music stems, VFX particles) with config prose — unpowered is the honest state until a real engine is wired.
- Blind-sweeping temp dirs or broad `git add` in the shared trees.
- Forgetting the drain only requeues DEFERRED artifacts — replay the gate step first to reset a fail.
