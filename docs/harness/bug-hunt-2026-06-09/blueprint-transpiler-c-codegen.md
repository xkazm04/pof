# Bug Hunt — Blueprint Transpiler & C++ Codegen
> Total: 4
> Severity: 0 critical, 1 high, 3 medium, 0 low

## 1. C++ header parser silently drops every UPROPERTY/UCLASS/UFUNCTION that uses `Meta=(...)`
- **Severity**: high
- **Category**: silent-failure
- **File**: src/lib/cpp-semantic-parser.ts:41,44,50
- **Scenario**: A user pastes real UE5 C++ (or the project's *own* GAS-generated header) into the Semantic Diff pane, where a property is declared `UPROPERTY(BlueprintReadOnly, Category="Attributes|vital", Meta=(AllowPrivateAccess="true"))` — and the parser returns zero classes/properties for that member.
- **Root cause**: `CLASS_REGEX`, `PROPERTY_REGEX`, and `UFUNCTION_REGEX` all match the macro argument list with `\([^)]*\)`. `[^)]*` stops at the *first* `)`, so any specifier list containing a nested paren group (`Meta=(...)`, `meta=(ClampMin=...)`, `UCLASS(meta=(DisplayName=...))`) fails to match the whole construct — the regex assumes specifier lists never contain parentheses, which is false for the most common real-world UE5 specifiers. I reproduced this: a `Meta=(...)` UPROPERTY yields **0 matches**, and a `UCLASS(... meta=(...))` yields **NO MATCH**. This is self-inflicting because `src/lib/gas-codegen.ts:72` emits exactly `Meta=(AllowPrivateAccess="true")`.
- **Impact**: corruption of analysis results — `computeSemanticDiff` reports valid C++ properties as "missing in C++" (false ADD changes) and never detects type conflicts on them; `checkExpectations` flags a fully-implemented class as `missing`/`stub`. Users get confidently wrong diffs/verification with no error.
- **Fix sketch**: replace the brittle `\([^)]*\)` argument matcher with a balanced-paren scan (the file already has `extractClassBody`'s brace-matcher — add a paren-matched `consumeArgList` helper and feed the parser the post-arglist offset), so the *class* of "nested parens in macro args" can never desync the parse again.

## 2. Semantic diff is one-directional for functions and ignores events — "in sync" success theater
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/lib/blueprint-semantic-diff.ts:100-115
- **Scenario**: A designer deletes a function from the Blueprint but the C++ class still defines it (orphan), or renames an event handler — then runs Semantic Diff to confirm the two sides agree before regenerating.
- **Root cause**: variables are diffed in *both* directions (BP→C++ adds at lines 52-82, C++→BP removes at lines 85-98), but functions are diffed in only *one* direction: the code loops `asset.functions` to emit `add` changes (line 101) and never loops `cppFunctions` to emit `remove` changes. Event-graph events (BeginPlay/Tick/custom) are not compared against C++ at all. The design assumes function/event drift only ever happens in the add direction.
- **Impact**: UX degradation bordering on data loss — the panel shows "Blueprint and C++ are in sync" (or only compatible changes) while the C++ has orphaned/renamed functions. A user trusting that "in sync" verdict and regenerating can ship stale or conflicting code, exactly the silent-overwrite the explainer warns about.
- **Fix sketch**: after the BP-function loop, iterate `cppFunctions` and emit `remove`/`function` changes for any name absent from `asset.functions` (mirroring the variable pass), and diff `asset.eventGraph` event nodes against parsed C++ overrides — make the diff symmetric by construction so neither direction can be forgotten.

## 3. GAS tag codegen emits invalid C++ identifiers from unsanitized ability/tag names
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/gas-codegen.ts:93-96,109-113
- **Scenario**: An author names a loadout ability `Fire Ball` (or `Dash-Strike`, or any name with a space/hyphen/symbol) and generates the gameplay-tags header.
- **Root cause**: `generateTagsHeader` builds tags as `Ability.${s.abilityName}` and `s.cooldownTag` straight from free-text editor fields, then derives the C++ field name with only `tag.replace(/\./g, '_')`. It assumes every authored name is already a legal C++ identifier (no spaces, no symbols, no leading digit). I reproduced output `FGameplayTag Ability_Fire Ball;` and `FGameplayTag Ability_Dash-Strike;` — both are non-compiling C++.
- **Impact**: crash/corruption of the build — the generated `FARPGGameplayTags` header fails to compile, and the failure surfaces only later in the UE5 toolchain with a confusing message far from the editor input that caused it. Two distinct names that differ only by `.`/`_`/symbol also silently collide into one field (duplicate-member compile error).
- **Fix sketch**: route every tag/identifier through one shared `toCppIdentifier()` sanitizer (strip/replace non-`[A-Za-z0-9_]`, prefix a leading digit, dedupe collisions) used by *all* generated-symbol paths in this module, so no codegen string can reach output as an illegal identifier.

## 4. Diff reports spurious type "conflict" for every object/struct/enum property
- **Severity**: medium
- **Category**: edge-case
- **File**: src/lib/blueprint-parser.ts:89-90 (consumed at src/lib/blueprint-semantic-diff.ts:56-69)
- **Scenario**: A Blueprint has a variable whose type is an object/class/enum reference (e.g. a `StaticMesh`, a custom `UMyComponent`, or a BP enum), the matching C++ declares it idiomatically as `UStaticMesh*` / `UMyComponent*`, and the user runs Semantic Diff.
- **Root cause**: `blueprintTypeToCpp` only maps a fixed primitive/container `TYPE_MAP`; for anything else it falls through to `return bpType` verbatim (line 90). The diff then compares this raw BP type string against the parsed C++ type with strict `!==` (line 57). For object/struct/enum properties the BP form (`StaticMesh`) never equals the real C++ form (`UStaticMesh*`), so a `modify`/`conflict` change is emitted even when the two sides are semantically identical.
- **Impact**: UX degradation — the diff marks in-sync object properties as red `conflict`s ("pick a winner before regenerating"), training users to ignore real conflicts and blocking the otherwise-safe auto-apply path. Worsened by finding #1 (which removes the C++ side of these comparisons entirely).
- **Fix sketch**: normalize both sides before comparing — strip pointer/`const`/`*` decoration and prefix conventions (`U`/`A`/`F`) into a canonical type token, and treat unmapped BP types as "unknown, compare loosely" rather than asserting strict string equality, so non-primitive types can't produce phantom conflicts.
