# 01 · Generation Quality — PoF App Improvements

## Goals

Raise the *runnable-out-of-the-box* quality of code Claude generates through
PoF's module checklists, so future runs do not need a multi-sub-project
fix-loop to make the generated code actually execute end-to-end.

## Improvements

### 1. A "wiring requirements" section in every checklist-item prompt

`src/lib/module-registry.ts` checklist items currently prompt for *the class*
("create a melee attack ability"). Extend the prompt builder
(`src/lib/prompts/prompt-builder.ts`) to append, for every gameplay item, a
**Wiring Requirements** section that lists what the class needs in addition
to compile-success:

- *Granting* — how does the player/enemy get this ability/component/widget?
- *Activation* — what triggers it (input, event, delegate)? Is the trigger
  itself created?
- *Dependencies* — what companion assets does it need (montage, GE,
  AttributeSet, Widget Blueprint)? Are those created or stubbed?
- *Verification* — what one-line check proves the wiring? (a `UE_LOG` in the
  trigger, a console command, a functional test assertion)

The output schema (Section "Output Schema" in `prompt-builder.ts`) gains a
required `wiring` field per generated artifact.

### 2. A "binary-content tripwire" check in the prompt context

`src/lib/prompt-context.ts`'s `buildProjectContextHeader()` learns a fixed
warning: *"Several UE asset types are binary and cannot be authored from
Python or text. If your solution depends on a `WBP_*` Widget Blueprint, an
Animation Blueprint, a `.umap`, a Behaviour Tree graph, or a Material
Function graph, **say so explicitly in the Wiring Requirements** and prefer
a pure-C++ pattern (e.g. `UBossHealthBarWidget`'s `WidgetTree->ConstructWidget`)
when one exists in the project."*

This stops a class of "compiles but never displays / fires / runs" defects at
generation time.

### 3. A small in-PoF "known UE-API gotchas" knowledge pack

Add `src/lib/knowledge/ue-gotchas.ts` exporting a curated list of pitfalls,
each with a one-line description + a citation:

- `MaterialExpressionConstant3Vector` output pin is `""`, not `"RGB"`.
- `UUserWidget` builds the Slate tree in `RebuildWidget()`, not
  `NativeConstruct()` — assignments to `WidgetTree->RootWidget` in
  `NativeConstruct` have no effect.
- `cmd.exe /c` with embedded quotes needs `windowsVerbatimArguments: true`
  *and* an outer-quote wrapper.
- UE 5.7 routes FBX import through Interchange; `-run=pythonscript` may
  crash on FBX import — use `UnrealEditor.exe -ExecutePythonScript=`.
- A `UWidgetComponent` in a runtime module that uses `FEditorDelegates`
  needs `#if WITH_EDITOR` guards or it breaks the Shipping build.
- The `MoverTests` engine plugin's content mount needs an asset-registry
  rescan under `-run=pythonscript`.

The shared prompt context appends these for any C++ / Python / packaging
prompt. New pitfalls discovered in production runs are appended here.

### 4. A "ground-truth first" template for evaluator + planning prompts

`src/lib/evaluator/module-eval-prompts.ts` adds, before the standard 3-pass
(structure / quality / performance) prompts, an explicit **Pass 0 — Ground
Truth**: *"For each class you reference, name its parent, its exact file
path, the UPROPERTY/UFUNCTION you depend on, and one observable runtime
behaviour you can verify. If you cannot, do not propose changes — request
a read-only inventory of the missing class first."*

This formalises the pattern every successful sub-project followed
(SP-C/PS-1/Characters all dispatched inventory agents before plans) into the
prompt machinery itself.

### 5. Cross-module dependency declarations need a "wiring asset" type

`src/lib/feature-definitions.ts` declares features depend on each other by
name. Extend each feature's record with an optional
`wiringAssets: string[]` listing companion content assets the feature needs
(WBPs, AnimBPs, GameMode, IMC, etc.). The matrix UI surfaces missing wiring
assets as a separate column from missing source files, so the operator sees
"compiled, not wired" at a glance.

### 6. Suspend the LRU module-cache eviction during a dispatch

A non-blocking issue SP-A flagged but did not fix: a CLI session can be
evicted from the 5-session terminal LRU and lose its dispatch after the 5 s
fallback. Guard the LRU eviction in `useSuspendableEffect` so a session with
`isRunning` is pinned. Low priority, but a real-user-could-hit-this.

## Verification this work succeeded

- The PoF unit-test suite (`src/__tests__/`) gains coverage for the new
  prompt fields (`wiringAssets`, `ground-truth` Pass 0).
- A re-run of one SP-B-style module checklist (e.g. "arpg-loot") on a fresh
  copy of the UE project produces a generated system whose first verification
  passes without a fix-loop on the *wiring* (logic bugs remain a separate
  concern).
- The `ue-gotchas` list is referenced from at least every prompt builder
  that emits UE C++ or Python.
