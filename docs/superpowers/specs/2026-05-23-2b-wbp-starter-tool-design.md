# 2b — WBP-Starter Tool (Design)

**Status:** Approved 2026-05-23. Folder-04 (HUD/UI) Phase 2b. Implements `docs/improvements/04-hud-ui/pof-app.md` §6.

## Goal

Give the operator a one-click way to scaffold a stub Widget Blueprint for a `BindWidget`-coupled C++ widget class, plus a README that says exactly which child widgets to add and at what names — the documented path to "use the project's real HUD widgets" (the `UARPGHUDWidget` family) when the autonomous-only path is insufficient.

## Approach (decided in brainstorming)

**Agentic, parameterized dispatch.** The operator picks a target C++ widget class in a small arpg-ui panel. The dispatch runs in the UE project, reads that class's header, and produces two artifacts in the UE repo:
1. a stub `WBP_<name>` (empty shell, reparented to the C++ class) via UnrealEditor Python;
2. a README listing the required `BindWidget` children (name, type, placement) + the reminder that Python can't author the tree.

PoF's role is the trigger UI + the prompt. No C++ parser or duplicated child-list data lives in the app (the agent reads the real header for truth). Artifact-only for MVP.

## Architecture

```
WBPStarterPanel (arpg-ui) — operator picks target class (suggestions = HUD_WBP_CLASSES)
        │ useModuleCLI.execute(TaskFactory.wbpStarter(moduleId, targetClass, appOrigin, label))
        ▼
buildTaskPrompt('wbp-starter') → agentic prompt naming <targetClass>
        ▼
Claude CLI (cwd = UE project)
   1. read Source/.../<TargetClass>.h
   2. extract every UPROPERTY(meta=(BindWidget[Optional])) member → (name, UWidget subtype)
   3. UnrealEditor.exe <uproject> -ExecutePythonScript="<script>"   (NOT -run=pythonscript; see gotcha)
        - AssetTools.create_asset("WBP_<name>", "/Game/UI", WidgetBlueprint, WidgetBlueprintFactory)
        - reparent the new WBP to <TargetClass>
   4. write Source/PoF/UI/WBP_<name>.README.md: one row per BindWidget child
      (property name, widget type, suggested parent/slot), + the "drag these in the UMG editor" note
   5. report a short summary in the terminal
```

## Components (PoF app side)

### 1. Task type `'wbp-starter'` — `src/lib/cli-task.ts`
- Add `'wbp-starter'` to `CLITaskType`.
- `WBPStarterTask extends CLITask { type:'wbp-starter'; targetClass: string; appOrigin: string }`.
- `buildTaskPrompt` `'wbp-starter'` case: project context header (UE, `ue-cpp`) + an agentic body that:
  - names `targetClass` and tells Claude to locate and read its header under `Source/`;
  - instructs extraction of `meta=(BindWidget)` and `meta=(BindWidgetOptional)` members with their `UWidget` subtypes;
  - gives the Python create-asset + reparent pattern, explicitly via `-ExecutePythonScript=` (full editor), **not** `-run=pythonscript` (cites the `interchange-fbx-commandlet-crash` gotcha rationale: the commandlet path is unreliable);
  - specifies the README path `Source/PoF/UI/WBP_<name>.README.md` and its required contents (a table of children + the note that the tree/Canvas-slot layout + `BindWidget` name resolution must be done by hand in the UMG editor);
  - notes the WBP is necessarily an empty shell (Python limitation) — that's intended.

### 2. `TaskFactory.wbpStarter(moduleId, targetClass, appOrigin, label)` — `src/lib/cli-task.ts`
Returns a `WBPStarterTask` (`prompt: ''`, assembled by `buildTaskPrompt`).

### 3. `WBPStarterPanel.tsx` — `src/components/modules/core-engine/arpg-ui/`
- A small control: a text input + a suggestions dropdown sourced from `HUD_WBP_CLASSES`, and a "Scaffold WBP" button.
- On submit: `useModuleCLI({ moduleId:'arpg-ui', sessionKey:'arpg-ui-wbp-starter', ... }).execute(TaskFactory.wbpStarter('arpg-ui', targetClass, getAppOrigin(), \`Scaffold WBP_${targetClass}\`))`.
- Disabled while `isRunning`. Rendered within the arpg-ui module view (wire into the existing arpg-ui component/tab).

### 4. `HUD_WBP_CLASSES` suggestion constant
The known `BindWidget` HUD classes: `UARPGHUDWidget`, `UARPGMainHUDWidget`, `UAbilityBarWidget`, `UAbilitySlotWidget`, `UEnemyHealthBarWidget`, `UCharacterStatsWidget`. Suggestions only — the agent reads the real header for the authoritative child list. Location: a small `src/components/modules/core-engine/arpg-ui/wbp-classes.ts` (or inline in the panel).

## Semantics
Artifact-only MVP. Deliverables are the stub WBP + README in the UE repo; the operator follows the README in the editor. The matrix "needs binary content" dot already flags the gap (`moduleNeedsBinaryContent('arpg-ui')`). A future enhancement could record "stub created → children pending" to flip the matrix indicator (kept out per the pure-agentic choice).

## Testing

| Test | Asserts |
|------|---------|
| `wbp-starter-prompt.test.ts` (new) | `buildTaskPrompt` for a `wbp-starter` task names the target class; instructs reading the header + extracting `meta=(BindWidget)`/`BindWidgetOptional`; includes the `create_asset`(WidgetBlueprint, WidgetBlueprintFactory) + reparent Python; specifies the README path + contents; uses `-ExecutePythonScript` and forbids `-run=pythonscript` |
| `TaskFactory.wbpStarter` shape | returns `type:'wbp-starter'`, carries `targetClass` + `appOrigin` |
| `WBPStarterPanel` render/dispatch test | renders the suggestions; clicking "Scaffold WBP" with a chosen class calls `execute` with a `wbp-starter` task for that class (mock `useModuleCLI`) |

No E2E: the output is editor artifacts requiring a human UMG-editor pass — not automatable end-to-end. Documented as out of scope.

## File structure
- Create: `src/components/modules/core-engine/arpg-ui/WBPStarterPanel.tsx`, `src/components/modules/core-engine/arpg-ui/wbp-classes.ts`, tests above.
- Modify: `src/lib/cli-task.ts` (`'wbp-starter'` type + `TaskFactory.wbpStarter` + `buildTaskPrompt` case), and the arpg-ui module view to render `WBPStarterPanel`.
