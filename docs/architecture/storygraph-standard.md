# The `pof.storygraph/1` standard

**What this is.** One interchange format for a branching storyline — decisions, events,
consequences and the state they read and write — that any project can emit and PoF can validate,
measure and draw. A project keeps its own authoring format; it emits `storygraph` as a *lossless
superset* so a round-trip can regenerate the original file.

**Direction of travel.** PoF is a **reader**. The project owns the truth. PoF validates, measures
and renders; it writes back only as an export or patch a human applies. PoF never silently edits a
producer's repository, and never runs a producer's simulator implicitly.

**What this standard owns, and what it does not.** A branching story is two artifacts wearing one
skin: the *writing*, and a *directed graph with guarded edges*. This standard owns the second — the
proof that the graph is **playable**. It says nothing about whether the prose is good, whether a
consequence matters to a player, or whether the pacing works. A scene can be a project's best
writing and this standard's worst artifact at the same time; that is the normal case, and the two
judgments must never stand in for each other.

> Governed by the registry subjects `game-production/branching-narrative-graph-validation` and
> `software-engineering/canvas-graph`. Where this document states a rule, the rule comes from there.

---

## 1. The envelope

Self-describing and versioned. Unknown top-level fields MUST be ignored by a reader, so a producer
may carry its own keys through for round-tripping.

```jsonc
{
  "format": "pof.storygraph/1",       // REQUIRED, exact
  "project": "mage-arena",            // REQUIRED. Scopes every row PoF stores.
  "graphId": "arc-mage-arena-s1",     // REQUIRED. Stable across revisions.
  "revision": 7,                      // REQUIRED. Monotonic. Identity of THIS version.
  "contentHash": "sha256:…",          // OPTIONAL. Over the canonical form, excluding this field.
  "producer": { "tool": "spine_to_graph", "version": "0.3.0", "generatedAt": "2026-10-04T…Z" },
  "source":   { … },                  // OPTIONAL, free-form provenance the producer wants kept.

  "profile":    { … },   // §2  what this project's vocabulary IS
  "variables":  [ … ],   // §3  the state-variable declaration contract  (the keystone)
  "nodes":      [ … ],   // §4
  "edges":      [ … ],   // §5
  "entries":    [ "START" ],  // REQUIRED, non-empty. Declared entry points.
  "endings":    [ … ],   // §6  DECLARED endings. The basis of the terminal set difference.
  "budgets":    { … },   // §7  text budget per node class, with unit AND basis
  "definitions":{ … },   // OPTIONAL. name -> Cond, for `{"ref": …}`
  "evidence":   { … }    // OPTIONAL. §9 imported run results
}
```

`revision` is **ordering**; `contentHash` is **identity**. A stored measurement pinned to a hash
that no longer matches the current graph is **stale**, and stale never renders as a pass.

---

## 2. `profile` — where project specifics live

The core vocabulary (§4, §5) is **closed**. Everything a project calls its own goes here. This is
what keeps the format universal: a reader needs no knowledge of any game to validate a graph.

```jsonc
"profile": {
  "axis":  { "name": "day", "unit": "in-game day", "min": 1, "max": 42 },
  "lanes": [ { "id": "main", "label": "Main spine" },
             { "id": "villain", "label": "Villain" } ],
  "nodeClasses": [
    { "id": "beat",   "coreKind": "event",  "label": "Beat" },
    { "id": "games",  "coreKind": "gate",   "label": "Arena games" } ],
  "languages": [ "en", "cs" ],
  "voicedFraction": 0.35
}
```

- **`axis`** is OPTIONAL. Present, it declares the project's ordering dimension with **its unit and
  its range** — a number carries its unit and its basis, so `day: 27` is only meaningful once
  somebody says the season is 42 days. Absent, ordering falls back to **topological depth**.
  A calendar (weeks, acts, chapters) is a *lane grouping over the axis*, never a second axis.
- **`lanes`** are presentation and filtering groups. A lane is not structure: nothing about
  validity may depend on a lane.
- **`nodeClasses`** map a project's own words onto the closed `coreKind` set. `beat` is an `event`;
  a *villain* is a **lane**, not a kind. A node class is what the text budget is stated per (§7).
- **`languages`** and **`voicedFraction`** are the basis of the localization surface (§7).

---

## 3. `variables` — the state-variable declaration contract

**This is the keystone of the standard.** Without it a narrative variable is an untyped,
undefaulted global with dozens of authors. One row per variable, and every field earns its place by
making a specific check possible.

```jsonc
"variables": [
  { "name": "trust.quill.player",
    "type": "int",                              // bool | enum | int | float | string
    "domain": { "min": -100, "max": 100 },      // enum: { "values": ["cold","warm","sworn"] }
    "initial": 0,                               // or null, WITH requiresWrite: true
    "requiresWrite": false,
    "writers": [ "CP3.1", "S-2" ],              // THE OWNING WRITERS. Everything else only reads.
    "scope": "playthrough",                     // conversation | quest | playthrough | persistent
    "external": false,
    "doc": "Quill's trust toward the player." }
]
```

**Rules.**

- **A name used anywhere MUST be declared.** An undeclared name is an error, never an implicit
  declaration — the permissive default is exactly what lets a misspelling become a new variable.
- **`domain` is required.** `reputation` is not a quantity until somebody says whether it runs
  0–100 or −3…+3, and two authors will assume differently.
- **`initial: null` with `requiresWrite: true` is the stronger statement** and is preferred where
  "not yet decided" and "decided no" genuinely differ. A defaulted flag makes a character treat
  those two states the same.
- **`writers` is the field producers leave out and the field that pays most.** It is one authority
  per quantity applied to narrative state. When four scenes may all write `trustsTheCaptain`, the
  value at any read is a race between authors who never met.
- **`external: true`** means another system owns the value (health, time of day, an inventory
  count). Its domain is still checked; reaching-write analysis is **skipped**, because the answer
  is always "no reaching write" and the finding would be noise.
- **`string` with no `values` is unconstrained** and is declared deliberately, for genuinely
  free-form state (a player-entered name). It is reported as `info`, never silently accepted as a
  typed variable.
- **A parse failure of this block is a loud error.** A reader MUST NOT fall back to
  "unconstrained", because a silent fallback turns the contract off at the moment it matters most.
- **The declaration travels with the graph.** A declaration kept in a separate design document
  drifts from the graph within a sprint, and the drift is invisible from both sides. The domain a
  checker validates against must be the same text an author reads when choosing a value.

---

## 4. `nodes` — a closed set of seven core kinds

```jsonc
{ "id": "S-5",                    // REQUIRED. Stable forever. A rename is a rename, not delete+add.
  "kind": "choice",               // REQUIRED. One of the seven below.
  "class": "beat",                // OPTIONAL. A profile nodeClasses id.
  "title": "The Last Lantern: tell or keep",
  "axis": 27,                     // OPTIONAL. Position on the declared axis.
  "lanes": [ "main" ],
  "parent": "ARC.w4",             // OPTIONAL. Containment. See `container`.
  "text": "…",                    // OPTIONAL. Counted against the budget (§7).
  "options": [ … ],               // `choice` only. See §5.
  "realises": [ { "catalogId": "dialog-trees", "entityId": "dialog-lantern", "role": "scene" } ],
  "status": "proposed-accepted",  // producer's own ladder; opaque to validation
  "authoring": "authored",        // authored | hybrid | generated
  "source": "season-spine.md §6c" }
```

| `kind` | Means | Validation consequence |
|---|---|---|
| `entry` | A declared start. Must appear in `entries`. | Forward reachability roots. |
| `event` | Something happens; no player agency. | Must have an outgoing traversal edge unless declared an ending. |
| `choice` | A player decision point, carrying `options`. | Needs ≥2 options; subject to the false-choice audit (§8). |
| `gate` | A deterministic branch on state; no player input. | Its outgoing edges must carry `when`. |
| `container` | A node that **contains a sub-graph** (a conversation, a quest, an act). | Children declare `parent`. Containment must be acyclic. A collapsed container is one node. |
| `ending` | A declared terminal. Must appear in `endings`. | Backward-reachability target. |
| `template` | An authored unit a runtime may *select* (a storylet). | Never an instance. Excluded from forward reachability; validated for its own internals. |

**Why seven.** Anything project-specific is a `class` or a `lane`, and anything that points at
content elsewhere is `realises` — an attribute, never a kind. A reader that meets an unknown
`kind` MUST render it as a labelled generic node **and report it**; a missing kind that renders as
nothing is the defect this rule exists to prevent.

**Containment is what makes 10,000 nodes legible.** A conversation is a `container` whose children
are its lines; collapsed, it is one node with one label. The levels are one graph, not separate
views, so an edge may cross a level — but a reader is never obliged to draw every leaf at once.

---

## 5. `edges` and `options`

```jsonc
{ "id": "e-S5-a", "from": "S-5", "to": "S-6",
  "kind": "option",               // then | option | gate | contains | influences
  "optionId": "tell",
  "label": "Tell her",
  "when":   { … Cond … },          // §6
  "writes": [ { "var": "trust.quill.player", "op": "add", "value": 10 },
              { "var": "knows.quill.secret", "op": "set", "value": true } ],
  "chance": 0.78 }                // OPTIONAL, modelled traversal probability for the walker
```

| `kind` | Traversal? | Means |
|---|---|---|
| `then` | yes | Default continuation. |
| `option` | yes | A player's选 choice from a `choice` node. Carries `optionId`. |
| `gate` | yes | A conditional branch. MUST carry `when`. |
| `contains` | **no** | Parent→child containment. Mirrors `node.parent`; either form is accepted, both must agree. |
| `influences` | **no** | "What this node writes is read by that node's guard." The *impact* edge. Derivable from `writes`/`when`, but a producer may declare it to assert intent; a reader MUST report a declared `influences` that the data does not support. |

`writes` ops: `set`, `add`, `sub`, `min`, `max`, `push` (for `string[]`-typed sets such as a
knowledge list). Every `writes[].var` must be declared (§3) and the writing node must appear in
that variable's `writers`.

**`writes` belong on the edge, not the node**, because a choice *is* what its successor states do.
The false-choice audit (§8) compares, per option, the pair `(set of writes, landing node)`.

---

## 6. `endings`, and the `Cond` grammar

```jsonc
"endings": [
  { "node": "E.breaking", "precedence": 3, "label": "The Breaking",
    "when": { … Cond … },
    "witness": [ "START", "B1.1", "…", "E.breaking" ] }   // OPTIONAL minimal path claim
]
```

`precedence` is OPTIONAL — only projects with mutually exclusive endings need it. Where present it
must be a total order, and an ending whose every witness also satisfies a higher-precedence ending
is **unreachable by construction**.

### `Cond` — a closed, typed grammar

```jsonc
{ "all": [ Cond, … ] }  |  { "any": [ Cond, … ] }  |  { "not": Cond }
{ "var": "<name>", "op": ">=", "value": 60 }       // ops: == != < <= > >= in
{ "flag": "<nodeId|optionId>" }                     // that node fired / that option was taken
{ "visited": "<nodeId>" }
{ "axis": { "op": ">=", "value": 27 } }             // position on the declared axis
{ "ref": "<definitionName>" }                       // resolves through top-level `definitions`
{ "chance": 0.78 }                                  // a modelled probability; walker-only
{ "expr": "<free text>" }                           // ESCAPE HATCH
```

**`expr` is always reported** as an `UNTYPED_CONDITION` finding. It exists so a project can import
before it has finished typing its guards — never so an untyped guard can pass quietly. A graph with
`expr` atoms is importable, measurable at the structural altitude, and **not** gradeable at the
state altitude, because nothing can evaluate it.

---

## 7. `budgets` — the text budget is a design input

A conversation graph is the only content class whose production cost multiplies by its own
topology. A node is a line; a line is a translation unit in every shipping language; voiced, it is
a recording, an asset, a lip-sync pass and a re-record when one word changes. Add a branch and the
whole subtree's cost duplicates. So the budget is stated **up front, per node class**, and the
surface is reported in a unit **with its basis**.

```jsonc
"budgets": {
  "unit": "words",                       // words | characters
  "basis": "per node, per language; branch multiplicity counted; voiced fraction from profile",
  "perClass": { "event": 60, "choice": 25, "option": 12 }
}
```

A reader reports the localization surface as a figure that carries its basis — never a bare
"700-line scene", which means four incompatible things depending on whether it counts nodes,
options, translation units or recorded assets.

This block is also what enforces the operator-facing constraint that **a map view must never
overflow with text**: a node whose `text` exceeds its class budget is a finding at authoring time,
not a rendering problem discovered later.

---

## 8. Validation: two altitudes, and every finding says which

> Structural proof is **necessary and never sufficient**. The structural pass is cheap enough to be
> continuous; it never entitles anyone to say the graph is playable.

The load-bearing distinction: **the graph a runtime walks is not the graph an author drew.** The
authored graph has nodes and edges; the runtime graph has **(node, state) pairs**. A node with
three outgoing edges is not a node with three exits — it has between zero and three depending on
state, and the case that matters is zero. **A softlock is not a node with no edges; it is a
reachable (node, state) pair from which no guard evaluates true.**

### Finding shape

```jsonc
{ "code": "ENDING_UNREACHABLE",
  "altitude": "structural",        // structural | state
  "severity": "error",             // error | warn | info
  "nodes": [ "E.martyr" ], "variables": [],
  "detail": "No backward path from E.martyr to any declared entry.",
  "lead": null }                   // state-altitude only; see below
```

### Structural pass — total, milliseconds, runs on every save

| Code | What it proves |
|---|---|
| `DANGLING_EDGE` / `DUPLICATE_ID` / `CONTAINMENT_CYCLE` | The document is a graph at all. |
| `ORPHAN_NODE` | Not reachable **forward** from any declared entry. |
| `ENDING_UNREACHABLE` | A **declared** ending with no **backward** path to an entry — an ending the game promises and cannot deliver. |
| `NO_ENDING_REACHABLE` | **Co-reachability**: a node that *is* reachable but from which no ending is. Worse than an orphan, because players get there. |
| `UNDECLARED_TERMINAL` | A node with no outgoing traversal edge that is not in `endings`. A set difference, not a heuristic. |
| `VAR_UNDECLARED` | A name read or written with no declaration. |
| `VAR_NO_REACHING_WRITE` | Definite assignment: a read on some path to which no write reaches, where the variable has no initial value. **Reports the path, not just the node.** Fails at joins, which is why per-node review never finds it. |
| `VAR_DOMAIN_VIOLATION` | A write outside the declared domain — the enum value a generator invented, so the branch it was meant to open never opens. |
| `VAR_WRITER_NOT_OWNER` | A write from a node absent from that variable's `writers`. |
| `VAR_SINGLETON` | A name occurring exactly once in a graph that uses forty — in practice a misspelling or dead state. Ten lines of code; finds the bug otherwise found in play. |
| `FALSE_CHOICE` | Two options of one `choice` whose `(writes, target)` pairs are identical. Convergence is craft; an identical rejoin means the branch was decoration. |
| `TEXT_BUDGET_EXCEEDED` | A node over its class budget (§7). |
| `UNTYPED_CONDITION` | An `expr` atom. |

### State pass — a bounded search, and its findings are **leads**

Bounded by the **declared variable domains**, never by everything a runtime could hold. Seeded and
reproducible. Two engines are permitted: PoF's own sampler (so a project with no simulator still
gets impact), and imported run results from a project that has one — imported evidence outranks
sampled evidence.

| Code | What it suggests |
|---|---|
| `SOFTLOCK_LEAD` | A reached `(node, state)` with no satisfiable outgoing guard. |
| `GUARD_UNSATISFIABLE` | A guard no state within the declared domains can satisfy. |
| `OPTION_NEVER_OFFERED` | An option whose guard no sampled reachable state satisfies — a choice the player is never actually offered. |
| `NODE_NEVER_REACHED` | Reach 0 over N samples. |
| `ENDING_BELOW_FLOOR` | A declared ending under its declared reach floor. |

**Every state-altitude finding carries a `lead`:**

```jsonc
"lead": { "seed": 12345, "engine": "pof-sampler/1", "samples": 2000,
          "state": { "trust.quill.player": 12, "knows.quill.secret": false },
          "path": [ "START", "B1.1", "…", "S-5" ] }
```

An automated traversal reliably declares unwinnable what is merely long or resource-gated. **A
softlock report is a lead to reproduce, not a finding to ship**, and it must carry the state it got
stuck in so the claim stays falsifiable. A reader MUST NOT present a state-altitude finding as a
proven defect.

### No gate self-certifies

A producer that emits a graph and validates it in one pass has produced a **self-report**. The
validation that counts is a separate reader of the stored artifact. Where a graph is generated and
checked together, the check is an *input* to the verdict and never the verdict.

---

## 9. `evidence` — imported run results

```jsonc
"evidence": {
  "runs": [ { "runId": "fix-fantasy-v6@0-7", "engine": "season-sim", "config": "fix-fantasy-v6",
              "seeds": "1-40", "n": 960, "graphHash": "sha256:…", "capturedAt": "…",
              "cohorts": [ "schemer", "optimizer", "fighter", "social", "rebel" ] } ],
  "reach": { "S-5": { "schemer": 98.1, "optimizer": 0.0 },
             "E.breaking": { "optimizer": 56.2 } },
  "unit": "percent of runs, per cohort"
}
```

`cohorts` are the producer's own segmentation (personas, difficulties, classes) — opaque to
validation, carried through for display. **`graphHash` pins which graph produced the numbers.**
A reach row whose `graphHash` differs from the current graph is **stale** and renders as stale; it
is never a pass.

---

## 10. Revisions: classify a change by what it invalidates

The first validation of a graph is the easy one. Every one after it happens against a graph
carrying verdicts, translations, recordings and possibly a save file pointing into it, and the
question is no longer "is this valid" but **"what did this edit invalidate"**. Node identity is
stable (§4), so a rename is a rename.

| Class | What changed | What it invalidates |
|---|---|---|
| `cosmetic` | `title`, `text`, `label`, `doc` | That node's translation unit, and its text-budget finding. Nothing topological. |
| `topological` | nodes, edges, containment, `options` | Every reachability, terminal and false-choice finding, and **all reach evidence**. |
| `contract` | `variables`, any `domain`, `endings`, `profile.axis` | All of the above **plus verdicts recorded against branches that no longer exist**. A domain change re-runs the whole graph, not the changed nodes, because conditions anywhere may be affected. |

Reporting an edit as one undifferentiated "modified" is how a team re-records a whole scene for a
comma and ships a stale verdict on a rewired branch.

---

## 11. Conformance

A **producer** is conformant when it emits `format`, `project`, `graphId`, `revision`, `entries`,
`nodes`, `edges`, `endings`, `variables` and `budgets`; every name used appears in `variables`;
every `realises` reference names a real row or is absent; and node ids are stable across revisions.

A **reader** is conformant when it: refuses a document whose `variables` block fails to parse
rather than degrading it; reports an unknown `kind` as a labelled generic node; labels every
finding with its altitude; attaches every finding to the node or variable that caused it; carries a
`lead` on every state-altitude finding; marks evidence stale on `graphHash` mismatch; and never
presents a state-altitude finding as proven.

**Minimum viable graph** — this validates, and is the smallest useful conformance test:

```jsonc
{ "format": "pof.storygraph/1", "project": "demo", "graphId": "g1", "revision": 1,
  "profile": { "lanes": [ { "id": "main", "label": "Main" } ],
               "nodeClasses": [ { "id": "beat", "coreKind": "event", "label": "Beat" } ],
               "languages": [ "en" ] },
  "variables": [ { "name": "tookTheCoin", "type": "bool", "domain": { "values": [ true, false ] },
                   "initial": false, "writers": [ "C1" ], "scope": "playthrough",
                   "external": false } ],
  "entries": [ "START" ],
  "nodes": [ { "id": "START", "kind": "entry", "title": "Start" },
             { "id": "C1", "kind": "choice", "title": "The offer",
               "options": [ { "id": "take" }, { "id": "refuse" } ] },
             { "id": "E1", "kind": "ending", "title": "Bought" },
             { "id": "E2", "kind": "ending", "title": "Clean" } ],
  "edges": [ { "id": "e0", "from": "START", "to": "C1", "kind": "then" },
             { "id": "e1", "from": "C1", "to": "E1", "kind": "option", "optionId": "take",
               "writes": [ { "var": "tookTheCoin", "op": "set", "value": true } ] },
             { "id": "e2", "from": "C1", "to": "E2", "kind": "option", "optionId": "refuse",
               "writes": [ { "var": "tookTheCoin", "op": "set", "value": false } ] } ],
  "endings": [ { "node": "E1" }, { "node": "E2" } ],
  "budgets": { "unit": "words", "basis": "per node, per language",
               "perClass": { "beat": 60 } } }
```

---

## 12. How a project joins

1. Write an exporter that emits the envelope. Start with `entries`, `nodes`, `edges`, `endings` and
   a `variables` block that declares every name already used — even if every `when` is an `expr`
   to begin with. The graph is immediately importable and structurally gradeable.
2. Type the guards, replacing `expr` atoms. Each one removed is one `UNTYPED_CONDITION` closed and
   moves that part of the graph into state-altitude reach.
3. Fill `writers` per variable. This is the single highest-value field and the one most producers
   skip.
4. State `budgets` before authoring more nodes, not after.
5. Optionally emit `evidence` from your own simulator. Without it, PoF's sampler supplies reach.

PoF stores the result in project-scoped `story_*` tables and grades it through the `story-arcs`
catalog pipeline; the graph's nodes link out to the `quests`, `dialog-trees`, `cutscenes`, `codex`
and `factions` rows that realise them via `realises`.
