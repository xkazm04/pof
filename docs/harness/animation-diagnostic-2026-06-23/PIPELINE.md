# Animation Subsystem — Diagnostic & Pipeline Map (2026-06-23)

Project: `pof` (Next.js 15 + TS authoring tool that generates Unreal Engine 5 animation content)
Scope: read-only investigation. The owner reports generated animation outputs are "out of reality and make no sense," with no way to see/validate what the system produces.

Verification note: in-editor Grep/Glob give false "no matches" on this repo; all reference checks below were done with Bash ripgrep against `C:/Users/kazda/kiro/pof/src`.

---

## 1. End-to-end flow (ASCII)

```
                         ┌─────────────────────────────────────────────────────────┐
                         │  AnimationsView.tsx  (5 tabs, moduleId = 'animations')    │
                         └─────────────────────────────────────────────────────────┘
   Setup Guide              State Machine            Combo Designer          Mixamo / Ask
        │                        │                        │                       │
        ▼                        ▼                        ▼                       │
 AnimationChecklist        AnimationStateMachine    AIComboChoreographer          │
 ANIMATION_STEPS[]          FALLBACK_STATES[] +       (100% deterministic,        │
 hardcoded prompts          generic per-state         local RNG + templates,      │
 (steps 1,4,5,6)            prompts. Data src:        NO LLM, NO network)         │
        │                   manifest > scan > fallback        │                   │
        │                        │                            │                   │
        │ onGenerate(step)       │ onSelectState(id,prompt)   │ generateMontageCode/JSON
        ▼                        ▼                            ▼ (string-templated C++/JSON
 handleGenerateStep        smCli.sendPrompt              shown in UI; NOT persisted,
 TaskFactory.checklist     (same checklist path)         NOT written to project)
        │                        │
        └────────────┬───────────┘
                     ▼
       useModuleCLI/useChecklistCLI.execute
         scanProject() ─► buildTaskPrompt(task, ctx)   ◄── cli-task-handlers.ts (checklist handler)
                     │            │
                     │            └─ prompt = projectHeader + dynamicContext(class-name inventory only)
                     │                       + "## Task" + step.prompt (hardcoded generic text)
                     │                       (NO skeleton/AnimSequence/slot/notify/montage asset names)
                     ▼
       /api/claude-terminal/query  ─► cli-service.startExecution
                     │
                     ▼
       spawn `claude` CLI  -p --output-format stream-json --dangerously-skip-permissions
              cwd = <user's UE project path>   (e.g. C:\Users\kazda\Documents\Unreal Projects\PoF)
                     │
        ┌────────────┼─────────────────────────────┐
        ▼            ▼                              ▼
   model writes   .claude/logs/terminal_*.log   SSE stream  ─► UI terminal panel
   .h/.cpp into   (raw stdout)                  (transient, in-memory events[] only)
   Source/<Mod>/  
   directly via
   its own tools
                     │
                     ▼ (optional @@CALLBACK)
       /api/checklist/complete  ── payload = { "completed": true }   (marks step done only;
                                                                      carries NO generated content)

  ── GROUND TRUTH FEEDS (exist, but disconnected from generation) ──
   live UE plugin ──► /api/pof-bridge/manifest ──► useManifest() ──► AnimationStateMachine (DISPLAY only)
                                                              └──► verification-rules.ts (loose existence check,
                                                                    Feature-Matrix status flags; NEVER loops back)
   regex over C++ ──► /api/filesystem/scan-animbp ──► AnimationStateMachine (DISPLAY only; never to a prompt)
   UE Remote Control searchAssets/describeObject (30010) ── BUILT BUT UNWIRED: no caller in app code
```

---

## 2. Output sinks — every place generated animation content can land

| # | Sink | Location | What lands there | How to re-query / inspect |
|---|------|----------|------------------|---------------------------|
| 1 | **User's UE project source files** | `<projectPath>/Source/<Module>/Animation/*.{h,cpp}` (NOT in this repo; e.g. `C:\Users\kazda\Documents\Unreal Projects\PoF`) | The model authors C++ AnimInstance / montage / notify classes directly via its own Write/Edit tools | Open the external UE project's `Source/` dir. The app never copies these back. |
| 2 | **CLI terminal log** | `<projectPath>/.claude/logs/terminal_<id>_<ts>.log` | Raw stdout of the spawned `claude` run (the only durable record of a generation session) | `ls <projectPath>/.claude/logs/` then read the newest `terminal_*.log` |
| 3 | **SSE → UI terminal (transient)** | in-memory `execution.events[]` (globalThis map in `cli-service.ts`) | text/tool_use/tool_result events; gone on restart; raw stdout deliberately NOT retained | Only visible live in the UI panel |
| 4 | **Combo Designer output (transient)** | rendered in `AIComboChoreographer.tsx`; copyable in UI | string-templated `FComboSectionDef` C++ + JSON | Open Combo Designer tab; it is NOT written to disk or DB |
| 5 | **checklist_metadata table** | `~/.pof/pof.db` | step completion flags only — **0 rows currently** | see DB command below; `SELECT * FROM checklist_metadata` |
| 6 | **review_snapshots table** | `~/.pof/pof.db` | aggregate review SCORES (counts/avg quality), not content | `SELECT * FROM review_snapshots ORDER BY rowid DESC` |
| 7 | **Blender MCP (optional)** | `/api/blender-mcp/execute` | generated python NLA/combo scripts (not UE content) | n/a unless Blender MCP running |

**DB re-query (PowerShell-safe, uses project's better-sqlite3):**
```bash
cd C:/Users/kazda/kiro/pof
node -e "const p=require('path'),o=require('os'),D=require('better-sqlite3');const db=new D(process.env.POF_DB_PATH||p.join(o.homedir(),'.pof','pof.db'),{readonly:true});console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\").all().map(r=>r.name).join('\n'));"
```
There is **NO animation-content table in the DB at all** (no state_machine / montage / combo / cli_task_result table). The 49 tables were enumerated; none hold generated animation content. **The DB is not an animation output sink.**

---

## 3. LLM-driven vs deterministic

- **LLM/CLI-driven (spawns `claude`, writes C++ into the project):** AnimationChecklist steps 1/4/5/6, and AnimationStateMachine per-state clicks (reuse the same checklist handler with a generic per-state prompt). No in-app C++ AnimNode/AnimInstance template engine exists for these — the model authors them freehand.
- **Deterministic (no LLM):** `AIComboChoreographer` (`generateMontageCode`/`generateJSON` — string templates + seeded RNG) and the Blender NLA/combo python scripts.

---

## 4. Ground truth — is it wired in?

**NO. Generation injects zero real-asset data. Validation is loose and never loops back.**

Three real ground-truth feeds EXIST but none reaches the generators:

1. **PoF Bridge manifest** (`/api/pof-bridge/manifest` ← live UE plugin). Type `AssetManifest.animAssets[]` is rich: `skeletonPath`, `assetType`, `notifies[]`, `sections[]`, `stateMachines[]` (`src/types/pof-bridge.ts:124-152`). Consumed ONLY by: (a) `AnimationStateMachine` to DRAW the graph (`useManifest`, line 200-238), and (b) `verification-rules.ts` for loose existence-by-substring checks that set Feature-Matrix flags. It is **never injected into any generation prompt**, and the validation result **never returns to generation**.

2. **AnimBP scanner** (`/api/filesystem/scan-animbp/route.ts`). This is **regex over C++ text files**, not `.uasset` and not the live engine. Output is consumed ONLY by the UI graph (`AnimationStateMachine.tsx:285`). A grep for any flow of `AnimBPScanResult`/`montageRefs`/`animVariables` into prompt/task code returns **zero hits**.

3. **UE Remote Control client** (`src/lib/ue5-bridge/remote-control-client.ts`, port 30010) has `searchAssets`/`describeObject` — but **no app-code caller**. Built but unwired.

4. **Curated real-asset registry EXISTS but is gated off the animation path.** `src/lib/knowledge/ue-known-assets.ts` has real entries (`SKM_Manny`, `SK_Mannequin`, `ABP_Manny`) under a header "use these EXACT paths — do not invent paths." But `knownAssetDomainsForModule(moduleId)` returns the animation domains ONLY for `moduleId` `'arpg-animation'`/`'arpg-character'` (lines 217-219), and `return []` for everything else (line 233). **The Animations UI dispatches `moduleId: 'animations'`** (`AnimationsView.tsx:35,61,74`) → falls to `[]` → the known-asset block is never added. A one-word module-id mismatch silently disables the only real-asset injection that exists.

5. **No animation ground truth on disk in this repo.** `ue/PoFToolset` is a Python-only "Phase-0 spike" plugin: **0 `.uproject`, 0 `.uasset`, 0 skeletons/AnimSequences/AnimBPs.** The real assets live only inside the external UE project the bridge connects to when running.

---

## 5. Diagnosis — concrete "out of reality" failure modes

1. **Prompts invent asset names; real ones are never injected.**
   The generation prompt = project header + a *class-name inventory* (`formatDynamicContext`, no asset names) + hardcoded generic step text. Socket/slot/section names in the prompts (`DefaultSlot`, `Attack1/2/3`, `foot_l`, `weapon_start`) are **literal strings in the hardcoded checklist text** (`AnimationChecklist.tsx`), not data scanned from the user's skeleton/assets. The model therefore guesses names that need not exist in the real skeleton/AnimBP. Evidence: `sample-prompt-builder.ts`, `sample-checklist-montage-step.txt`, and the gating bug in `sample-known-assets-gating.ts`.

2. **The known-asset registry is silently bypassed by a module-id mismatch.**
   `ue-known-assets.ts` would inject real paths (`ABP_Manny`, `SKM_Manny`) — but only for module ids `arpg-animation`/`arpg-character`. The Animations tab uses `animations`, so `knownAssetDomainsForModule('animations') → []`. The single safeguard against invented paths is disabled for the exact module that authors animations. Evidence: `ue-known-assets.ts:215-233` vs `AnimationsView.tsx:35`.

3. **No validation against reality, and the engine itself rejects the output.**
   Nothing validates generated montages/states against the real skeleton bone list, real AnimSequence names, real slots, or real notify placements — `verification-rules.ts` only does fuzzy substring existence checks and never feeds back. Direct engine ground truth confirms breakage: a real headless capture run logs `[GA_EnemyMelee] No playable swing montage; using 0.30s timer-driven attack window` (`scn-5_8-walk-run.log:1703`) — the generated montage is missing/unplayable at runtime, and nothing surfaces that back to the tool. The deterministic Combo codegen compounds this: `generateMontageCode` emits an `FComboSectionDef` of pure numbers with **no AnimMontage/AnimSequence asset reference at all** (`sample-combo-codegen.ts`), so it is structurally disconnected from any real animation asset.

**Why there's "no way to see what it produces":** the durable outputs land in an *external* UE project's `Source/` tree and a `.claude/logs/*.log` inside that project — not in this app's DB, not in `generated/`, not in any in-app viewer. The DB stores only completion flags and review scores. The Combo Designer output is transient UI only.

---

## Sample files in this directory
- `sample-prompt-builder.ts` — verbatim `buildAnimationChecklistPrompt` (proves no asset injection)
- `sample-montage-prompt.ts` — verbatim `buildMontagePrompt` (says "reuse the skeleton" but never reads it)
- `sample-checklist-montage-step.txt` — a hardcoded checklist step prompt (literal slot/section names)
- `sample-combo-codegen.ts` — deterministic combo C++/JSON generator (no real asset refs)
- `sample-statemachine.ts` — hardcoded FALLBACK_STATES + transitions + generic scanned-state prompts
- `sample-known-assets-gating.ts` — real asset registry + the module-id gate that disables it for `animations`
- `sample-db-tables.txt` — full DB table list + anim-relevant counts (no animation content table)
- `sample-engine-groundtruth.txt` — runtime "No playable swing montage" evidence + the external project path
- `sample-ue-stub-tree.txt` — proof `ue/PoFToolset` has 0 `.uasset`/`.uproject`
