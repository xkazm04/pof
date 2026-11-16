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

**The canonical form is RFC 8785 (JCS):** object keys sorted, no insignificant whitespace, array
order preserved. `contentHash` is `sha256:` over that form with the `contentHash` key itself
removed. Reference implementation: `src/lib/story/canonical.ts` (`canonicalize`, `storyContentHash`).

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
| `gate` | A deterministic branch on state; no player input. | Must branch: at least one outgoing edge carries `when`. An unguarded `then` beside a guarded edge is its default ("else") branch. |
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
  "chance": 0.78,                 // OPTIONAL, modelled traversal probability for the walker
  "mode": "all" }                 // OPTIONAL, `then` edges only: "any" (default) | "all" — see below
```

| `kind` | Traversal? | Means |
|---|---|---|
| `then` | yes | Default continuation. |
| `option` | yes | A player's choice from a `choice` node. Carries `optionId`. |
| `gate` | yes | A conditional branch. MUST carry `when`. (A `then` out of a `gate` node is its default branch, §4.) |
| `contains` | **no** | Parent→child containment. Mirrors `node.parent`; either form is accepted, both must agree. |
| `influences` | **no** | "What this node writes is read by that node's guard." The *impact* edge. Derivable from `writes`/`when`, but a producer may declare it to assert intent; a reader MUST report a declared `influences` that the data does not support. |

`writes` ops: `set`, `add`, `sub`, `min`, `max`, `push` (for `string[]`-typed sets such as a
knowledge list). Every `writes[].var` must be declared (§3) and the writing node must appear in
that variable's `writers`. **The writing node is the edge's SOURCE node** (or a container that
encloses it) — not its target, not an option or edge id.

**`mode` — what several `then` edges out of one non-choice node mean.** Omitted (= `"any"`) they are
**one-of**: the traversal takes one (a hub: "pick a quest"). Marked `"mode": "all"` they are
**parallel threads**, every one live at once (a season: "three threads run"). `mode` is meaningful
only on `then` edges that share a non-choice source; it never changes structural reachability
(every target stays reachable either way) and is ignored on `option` / `gate` edges.

**`writes` belong on the edge, not the node**, because a choice *is* what its successor states do.
The false-choice audit (§8) compares, per option, the pair `(set of writes, landing node)`.

---

## 6. `endings`, and the `Cond` grammar

```jsonc
"endings": [
  { "node": "E.breaking", "precedence": 3, "label": "The Breaking",
    "when": { … Cond … },
    "witness": [ "START", "B1.1", "…", "E.breaking" ],     // OPTIONAL minimal path claim
    "floor": 5 }                  // OPTIONAL reach floor, PERCENT; a number (every cohort) or { "cohort": 5 }
]
```

`precedence` is OPTIONAL — only projects with mutually exclusive endings need it. Where present it
must be a total order (**the lower number wins**), and an ending whose every witness also satisfies a higher-precedence ending
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
| `CHOICE_TOO_FEW_OPTIONS` | **error.** A `choice` with fewer than two **distinct** options (§4 "Needs ≥2 options"). Distinct options are the `optionId`s of its outgoing `option` edges (an `option` edge without an `optionId` counts as its own option), united with the ids in its declared `options` list. A `then` or `gate` edge out of a choice is not an option. |
| `GATE_WITHOUT_CONDITION` | **error.** Two cases (§4, §5). **(a)** A `gate` **edge** with no `when`, wherever it starts. One finding per edge, naming the edge's source. **(b)** A `gate` **node** with at least one outgoing traversal edge (`then` / `option` / `gate`) where **none** of those edges carries a `when`. Such a node branches on nothing and is really an `event`. One finding per node, `nodes: [gate]`. The detail names the edges and says "make it an `event`, or guard at least one outgoing edge". An unguarded `then` edge out of a gate node **beside a guarded edge** is the gate's **default ("else") branch**. It is allowed, and several such edges combine by `mode` (one-of unless `all`). Case (b) does not fire when one of the node's unguarded edges is a `gate` edge, because (a) already reports that edge, and guarding it is the fix that turns the remaining `then` edges into the default branch. A gate node with no outgoing traversal edge is `UNDECLARED_TERMINAL`, not this. `contains` and `influences` edges out of a gate are not branches and are not counted. |
| `UNKNOWN_KIND` | **info.** A node or edge `kind` outside the closed core set (§4: a reader must render it as a labelled generic node **and report it**). An unknown node kind is walked as an ordinary node. An unknown edge kind is kept but **not** walked, and the detail says so, which is why a node reached only through one shows up as unreachable. A `profile.nodeClasses[].coreKind` outside the seven node kinds is reported under the same code: one finding per class, with `nodes: []` (a class only labels nodes, and each node carries its own `kind`). The detail names the class and the bad value, and the class is rendered as a generic node class. |
| `PARENT_CONTAINS_MISMATCH` | **error.** `contains` mirrors `node.parent`, and where both forms name a child's parent they must agree (§5). This fires when a child declares `parent: P` and a `contains` edge places it in some Q ≠ P, or when a child declares no parent and `contains` edges place it in two different parents. A child expressed by only one form is fine. A `parent` naming a missing node is `DANGLING_EDGE` and is not compared. The finding names the child first and then the parents. |
| `STRING_VAR_NO_VALUES` | **info.** A `string` variable with no `domain.values` (§3). One finding per variable name, carrying `variables: [name]` and no nodes. |
| `PRECEDENCE_NOT_TOTAL` | **error / warn.** Where endings declare `precedence`, it must be a total order (§6, lower number wins). Two or more endings tying at one value is **error** and names the tied endings. When some endings declare a precedence and others do not, that is **warn** and names the endings that declare none. A non-finite value is already a schema error. This is the one code with two severities, documented in `STRUCTURAL_SEVERITY`. |
| `INFLUENCES_UNSUPPORTED` | **warn.** A declared `influences` edge X → Y that the data does not support (§5: "a reader MUST report a declared `influences` that the data does not support"). The edge is **supported** when some variable written by X is read by a guard that belongs to Y. *Written by X* means the `writes[].var` of every traversal edge whose `from` is X or a descendant of X (a container owns the writes made inside it). *Read by Y* means every variable referenced (with `ref` definitions resolved) in the `when` of any edge out of Y or a descendant of Y, and in the `when` of any `endings[]` entry whose node is Y or a descendant of Y. Option guards are the `when` of the option edges, so they are already counted. One finding per unsupported edge, `nodes: [X, Y]`, with no `variables`. The detail names X's written set and Y's read set (long sets are truncated after six names as `+n more`). An `influences` edge with a missing endpoint is `DANGLING_EDGE` and is not reported again here. `influences` stays non-traversal: this check reads it and never walks it. |

**One code per dead node.** Every reachable non-container node from which no ending can be reached carries
exactly one of two codes: `UNDECLARED_TERMINAL` when it has **no way on** (no outgoing traversal edge, no
enclosing container exit, not in `endings`) — a set difference, never also `NO_ENDING_REACHABLE` — and
`NO_ENDING_REACHABLE` when it **has** a way on but no ending is reachable from it (a loop with no exit),
grouped into regions. A node not reachable at all is `ORPHAN_NODE`, never either. Each structural code belongs
to exactly one acceptance checker (`storyCheckers.ts`, `STORY_SLICE_CODES`); `info` findings never fail one.

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
| `NODE_NEVER_REACHED` | A node the run covers, with a measured reach of 0 over N samples (§9). |
| `ENDING_BELOW_FLOOR` | A declared ending under its declared reach floor (`endings[].floor`, per cohort). |
| `LIVELOCK_LEAD` | Walks still moving at the step cap inside a closed loop from which no ending is reachable — not a softlock (there is a way on) and not merely long (it never leaves). |

**Every state-altitude finding carries a `lead`:**

```jsonc
"lead": { "seed": 12345, "engine": "pof-walker@1", "samples": 2000,
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

**Two silences, never confused.** An explicit `0` in `reach` is a **measured zero**: the run covered the node
and none of its `n` walks reached it. A node (or cohort) **absent** from `reach` is **unmeasured**: the run did
not cover it (an orphan, a template, a node only an unknown edge kind leads to). A reader never turns one into
the other. Where a run measures a node it gives a value for every cohort of that run.

### How a reader presents reach: cohorts across runs, mixed status, and a measured zero

**Which cohorts a reader shows.** A reader takes its cohort list as the **union over every run** in
`evidence.runs`, first-seen in document order (run 1's cohorts in its own order, then each cohort a
later run adds). It does not read the first run alone: a document that carries an imported run and
a sampled one shows both runs' cohorts side by side. A cohort that appears in a `reach` row but that
no run declares is still a measured column, appended after the declared ones; its cells belong to no
run, so they read `unverified`. A document with no run at all has no cohort list, and a reader shows
no reach lens for it.

**(a) Mixed-status cells in one view.** Status is a property of a **cell**, not of the document. Each
cell takes the status of the run that owns its cohort (`verified` when that run's `graphHash` equals
the graph being read, `stale` when it names another revision, `unverified` when it is `null`), and
where several runs of one source declare a cohort, the worst of their statuses wins. A reader shows
two things and keeps them apart:

- **Per cohort, the exact status.** Each cohort is labelled with the worst status of its own
  displayed cells and the sources that supply them (for example "fighter · imported · unverified"
  beside "uniform · sampled · verified"). A verified cohort is never dragged down by an unverified
  neighbour in this label, and an unverified cohort is never lifted by a verified one.
- **For the lens as a whole, doubt never passes.** The lens-level badge reads `unverified` if ANY
  run is unpinned, and when the reader holds merged evidence, if ANY displayed cell is `stale` or
  `unverified`. It reads `provisional` if ANY run is provisional. One honest cohort does not make the
  whole picture trustworthy.

Status is carried as text and a glyph as well as colour (`✓` verified, `?` unverified, `⚠` stale), so it
survives greyscale and a screen reader.

**(b) A measured 0 against an unmeasured node.** The evidence convention (see `StoryEvidence.reach`)
draws the line: an explicit `0` is a **measured zero** (the run covered the node and none of its `n`
walks reached it), and a node or cohort absent from `reach` is **unmeasured** (the run did not
cover it). A reader never turns one into the other, and it shows the difference in more than one
independent way:

| | Measured 0 | Unmeasured |
| --- | --- | --- |
| Lens paint | the low end of the reach ramp, with its own measured-zero outline | the unmeasured hatch |
| Inspector bar | a solid track and the figure `0%` | a hatched track and an em dash, with the note "unmeasured, which is not the same as 0%" |
| Cell table | `0%` and "measured, not reached in n walks (source, status)" | "no reach row in any source: unmeasured, which is not 0%" |
| Spoken description | "reach measured" | "no reach row: never measured, which is not zero" |
| Dataset summary | counts as a reach row | does not count |
| Container mean | contributes 0 to its parent's derived mean | contributes nothing, so it cannot drag a mean toward 0 |
| Cohort cell count | counts as a displayed cell | is not a cell |

A reader must not test reach values for truthiness: a check such as "if the value is set" or "value
greater than zero" turns every measured zero into an unmeasured node, which is the defect this rule
exists to prevent.

**How the wheel marks a cell that is not verified.** With a reach lens on, every sector whose figure is not `verified` gets an outline in the theme's warn ink, drawn on top of its fill. The fill does not change. A **stale** cell (its run is pinned to a different `graphHash`) gets a **dashed** outline. An **unverified** cell (its run is not pinned, or the cohort has no run behind it) gets a **dotted** outline. The difference between dashed and dotted is the cue that does not depend on colour. The status is read from the same evidence the lens value comes from:
- On a merged view, it is the `mergeEvidence` status of the displayed cell.
- On a plain document, it is the run's `runStatus` against the graph's current hash. If no current hash is known, a pinned run is shown as unverified. It is never treated as a pass and never claimed to be stale.

A container's derived figure takes the worst status of the measured descendants that fed its mean (stale, then unverified, then verified). Doubt never passes. The outline sits about 2px inside the sector edge, so a stale measured zero shows both its zero outline and the dashed marker. Sectors too small to hold their own outline share one outline per same-status run in a ring, so every drawn sector still sits inside its status outline. Endings docked at the hub get a ring around the dot. The status is also spoken in the live region and the tooltip ("reach 40% - sampled, stale"), and the Legend explains both outlines. **The wheel never marks:**
- a verified cell;
- an unmeasured sector, which shows the hatch only because there is no cell and so no status;
- anything under the kind lens, which shows no figure;
- a sector that LOD culled away.

---

## 9a. The walker (PoF's reference sampler)

PoF's own state-altitude engine (§8 "State pass"). It walks the **runtime** graph — (node, state)
pairs — not the authored one, and everything it reports is a **lead**, never a proven defect.

**Engine id:** `pof-walker@1`. **Code:** `src/lib/story/walker.ts` (`sampleGraph`, `createWalker`, the
report), `walker-walk.ts` (one walk: threads, scheduling, merging), `walker-sink.ts` (run state),
`walker-model.ts` (sites, `walkable()`), `walker-resolve.ts` (which way on, forks),
`walker-state.ts` (domains and writes), `walker-livelock.ts` (the closed-loop decision),
`walker-findings.ts` (leads), `walker-replay.ts` (`replayLead`, `replayFinding`), `cond-eval.ts` /
`satisfiability.ts` (guards), `evidence.ts` (merge), `walk-jobs.ts` + `/api/story/walk` (background job).

### What a walk is

- **Same graph as the structural pass.** Positions are the structural topology's walk ids (a node,
  or a container's exit). `then` / `option` / `gate` edges are walked; `contains`, `influences` and
  any unknown edge kind never are. Templates are never entered.
- **Bounded by the declared domains only** (§3). A walk starts at every variable's `initial`; a
  set (a variable some edge writes with `push`) starting `null` is the empty set; an `external`
  variable is **sampled from its declared domain** (another system owns it). A write that would
  leave the domain is **clamped** (numbers) or **rejected** (a value outside the value list) and
  every such write is **recorded** in `domainEvents` — never silently absorbed. A write to an
  undeclared name is recorded and ignored; the walker never invents a variable.
- **Guards** are the edge's `when`, AND the landing ending's own `when` (an ending fires only when
  its condition holds), AND the edge's `chance`. Evaluation is three-valued: an `expr` atom, an
  undeclared variable or an unresolvable `ref` is **unknown**, and unknown counts as *holding* —
  the walker never manufactures a lead from a guard nothing can read. A graph with any such guard
  is reported `gradeable: false` (§6).
- **Which way on.** A `choice` offers each option whose guard can hold; the cohort's policy picks
  among the **offered** options (default `uniform`); inside one option a guarded edge that holds
  outranks an unguarded one (the unguarded edge is the "else"). A `gate` is deterministic: lowest
  ending `precedence` first, then document order. Any other node picks uniformly among the edges
  that hold. A miss caused only by `chance` rolls is not a stall.
- **Parallel threads (`mode: "all"`).** Several `then` edges out of one non-choice node are ONE-OF
  by default (`mode` omitted or `"any"`: the walk takes one). Edges marked `mode: "all"` make the
  node a **fork**: every such edge whose guard holds starts a **thread**, in document order, plus
  one way on picked among the holding one-of edges exactly as above (a last line's container exit
  competes only there). A guarded parallel edge whose guard fails starts no thread. `mode` on an
  `option` or `gate` edge, or out of a `choice`, has no effect. A walk is then a set of threads
  sharing **one** variable state, one history and one path:
  - *Scheduling.* Each step advances one ready thread, picked uniformly with the walk's own seeded
    stream (no draw while only one thread is ready). A fork, with all its spawns, is one step.
  - *A guard is a join.* A thread whose guards all fail is **blocked**, not stalled: another
    thread's writes may open its way, and it is ready again after any move that writes. The walk
    **stalls** only when every live thread is blocked (recorded at the lowest-numbered one).
  - *Threads merge.* A thread arriving at a node another thread has already visited joins that
    story and completes — unless it is the only live thread. An unguarded convergence node is
    therefore read when the FIRST thread reaches it; a story that needs every thread's outcome
    before going on says so with a guard on the way on (which blocks until the writes land).
  - *Completion.* With other threads live, a thread arriving at a dead end completes there, and a
    thread arriving at an ending with no authored way on ends the walk. The last live thread
    resolves exactly as a single-thread walk does. A walk has one outcome: its first ending (an
    ending is counted once per walk), a stall, a dead end, a truncation or a livelock.
  - Reach counts a node once per walk, however many threads pass it. Without any `mode: "all"`
    edge a walk is the single-cursor walk, step for step and draw for draw.
- **Containers.** An edge into a container enters its entry children. A node with **no** authored
  way on falls through to its container's exit. On a **last line** — a non-gate position whose
  every authored edge leaves the container — the container's own continuation (when it has one)
  is one more way on beside the line's own edges. Mid-container lines do not see it.
- **Endings.** A walk ends at an ending with no way on (or none that holds). An ending *with* a
  way on is a sub-graph outcome (a conversation that ends "turned away" and returns to its quest)
  and the walk continues.
- **The step cap.** A walk still moving at the cap (default: twice the walkable positions, at least
  1,000) is never a softlock. It is a **livelock** when the walker can prove it is caught in a
  closed loop with no ending (below); otherwise it is `truncated` — merely long, or undecided.
  `truncatedAt` and `livelockedAt` record where those walks were.
- **Livelock decision.** At the cap, for a walk with one live thread, the walker enumerates every
  (position, state) reachable from where it stands over the **bounded model**: the declared
  domains (writes clamped or rejected as walked), the walker's own container semantics, and every
  guard read **optimistically** — a way on unless definitely false (`chance` as possible, an
  unknown atom as holding, `flag`/`visited` as unknown because the history is abstracted away). The
  walk is livelocked only when that closure is fully enumerated (at most 20,000 states), contains
  no position at an ending, and is strongly connected: every state in it leads back, so the walk
  can circle forever and never leave. Anything else — an ending in the closure, a dead state, a
  start not yet inside its loop, the budget exhausted, a fork met, several live threads — is no
  claim, and the walk stays `truncated`. Because the closure over-approximates every real walk,
  the claim is sound for a lead: the walker never calls a state livelocked that can still exit.

### Reproducible

Every walk draws from its own `mulberry32` stream keyed by `(seed, cohort, sample)`, so the same
`(graph, seed, samples, cohorts)` yields **byte-identical** output (canonical form, §1) however the
run is chunked — with or without parallel threads. The walker has no clock; timing lives in the job
wrapper.

### What it reports

- `evidence` — a valid `StoryEvidence` (§9): one run (`engine: pof-walker@1`, `n` = walks over all
  cohorts, `graphHash` = the stored content hash it walked, or `null` = unverified), and
  `reach[node][cohort]` = percent of that cohort's walks that reached the node. The run **covers**
  every node the walker can reach at all — from an entry over every move it can make, guards
  ignored, with the container semantics above (each covered node brings the containers above it).
  **Every covered node has a value in every cohort: an explicit `0` is a MEASURED zero** (covered,
  reached by none of that cohort's walks). A node the run does not cover — an orphan, a template, a
  node only an unknown edge kind leads to — is **absent**: unmeasured, never 0. A run of 0 walks
  measures nothing. A node that is 0 in every cohort is exactly a `NODE_NEVER_REACHED` lead.
- `outcomes` per cohort: arrivals per ending, `stalled`, `terminal` (no traversal edge at all —
  the structural pass's `UNDECLARED_TERMINAL`; recorded in `terminalAt`, not a lead), `truncated`,
  and `livelocked` (present only when some walk livelocked; those walks are not also `truncated`).
- `findings` — state-altitude leads, every one `altitude: 'state'` with
  `lead: {seed, engine, samples, state, path}`, plus `lead.threads` when the walk forked:

| Code | Fires when | `lead.state` / `lead.path` |
|---|---|---|
| `SOFTLOCK_LEAD` | a reached (node, state) has authored edges and none can hold (chance read as possible); with threads, every live thread is so blocked | the stuck state / the walk that got there |
| `GUARD_UNSATISFIABLE` | no state within the declared domains satisfies a guard (interval, value-list and subset reasoning over DNF; `unknown` past 512 terms or on an unreadable atom — never a guess) | `{}` (domain-wide) / a structural witness to the guard |
| `OPTION_NEVER_OFFERED` | a choice the walks reached offered an option at none of its visits | the first visit where it was not offered |
| `NODE_NEVER_REACHED` | samples > 0, the run covers the node, and no walk of any cohort reached it (its reach row is the explicit 0; orphans and unreachable endings stay the structural pass's) | the declared start / a structural witness |
| `ENDING_BELOW_FLOOR` | an ending's arrivals in a cohort are under its floor for that cohort: the `floors` option (by ending id) overrides `endings[].floor`; a numeric floor applies to every cohort, a record only to the cohorts it names (an omitted cohort has no floor); arrivals exactly at the floor are not under it | `{}` / a structural witness |
| `LIVELOCK_LEAD` | walks were still moving at the step cap inside a closed loop from which no ending is reachable (the livelock decision above); one lead per loop, `nodes` = the loop's nodes | the first walk's state on first entering the loop / its route there |

**Falsifiable.** `replayLead(graph, lead, budget, claim)` (or `replayFinding(graph, finding)`, which
picks the claim from the code) re-executes `lead.path` from the declared start (externals from
`lead.state`), searching every move the walker could have taken that matches the path. With
`lead.threads`, step j is a move of thread `threads[j]`; a thread number seen for the first time is
spawned from the fork the previous move left, and merges and dead-end completions follow the walk
rules, so the replay ends with the walker's live threads. It reproduces a `softlock` claim only when
it arrives at the end with exactly `lead.state` and every live thread is stalled there, and a
`livelock` claim only when it arrives with exactly `lead.state`, one live thread, and the closed,
ending-free loop is re-derived over the bounded model. A reproduced lead is still a lead: it shows
the walk is real under the walker's reading of the graph, not that a shipped runtime reads it the
same way.

### Evidence merge

`mergeEvidence({currentHash, imported, sampled})`: per (node, cohort), **imported outranks
sampled** (the sampled value — a measured 0 included — is kept as `shadowed`). A cell's status is
its run's — `verified` (hash matches), `stale` (hash differs), `unverified` (`graphHash: null`, or
no run declares the cohort); only `verified` passes. An explicit 0 is a value like any other: a
sampled 0 alone is a verified measured zero. Unmeasured stays absent.

### Running it

`POST /api/story/walk` (operator-guarded) `{graphId, project?, seed? = 1, samples? = 2000 (max
20,000 per cohort), cohorts?}` → **202** `{jobId}`; the walk runs in the background in chunks of 50
walks, yielding to the event loop between chunks. `GET /api/story/walk/:jobId` →
`{state: queued|running|done|failed, progress: {done, total}, report?, error?, durationMs?}`.
Jobs are in memory (the oldest finished ones evicted past 50); nothing is written to the database.

Measured (2026-11-01, one worker, interleaved A/B against the pre-amendment walker, median of 5):
2,000 walks over the 10,739-node `synthetic-scale` document in ~1.55 s (was ~1.33 s; the 256 walks
caught in its DEAD1/DEAD2 loops are now two `LIVELOCK_LEAD`s instead of 256 truncations); over a
10,000-node `generateStoryGraph` document (every walk crosses the whole chain, 17.7 M steps) in
~4.5 s (was ~4.0 s). Budget: 30 s. The explicit zeros add 5 reach rows (155 bytes) to the
10,739-node document's report at seed 1.

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

**What is live today (2026-11-01).** Import: `POST /api/story/graphs` (zod `storyGraphSchema`,
operator-guarded; an unreadable `variables` block refuses the whole document; unknown kinds are kept
and listed in `unknownKinds`; a declared `contentHash` that does not match is refused; `revision` is
monotonic per `(project, graphId)`). Storage: one `story_graphs` table (`src/lib/story/story-db-conn.ts`),
the full document as JSON. Read: `GET /api/story/graphs[/:graphId]`, drawn by the Orrery at `/story`.
`/story` follows the active game: with GTAI active it draws the derived GTAI campaign instead
(`GET /api/games/gtai/story`, not stored; see game-workspaces.md, "Quest loop (GTAI)").
Validate: `GET /api/story/findings` (every §8 structural code, `src/lib/story/validate.ts`). Walk:
`POST /api/story/walk` -> 202 `{jobId}`, poll `GET /api/story/walk/:jobId` (§9a, background job). Catalog: the
`story-arcs` row (Concept Brief, Story Graph graded by `storyGraphAcceptance`, Impact Walk — when the stored walk
record is stale its verdict walks the CURRENT graph itself and names the record as old). Agents: `pof_story_graph`,
`pof_story_findings`, `pof_story_walk`, `pof_story_import` (`tools/pof-mcp`). Orrery: the Walk control polls a job, merges
sampled evidence UNDER imported evidence (`mergeEvidence`), marks stale/unverified cells, and lists walker findings as a
separate "Leads - reproduce before trusting" group. What is not built is listed under "Still open" below.

**Amendments resolved (2026-11-02):** an edge's writes are made by its source node (§5); `mode: "all"` for parallel
`then` threads, one-of by default (§5, §9a); lower `precedence` wins (§6); `endings[].floor`, a number or a per-cohort
record (§6); six structural codes for the MUSTs that had none, and the NO_ENDING_REACHABLE / UNDECLARED_TERMINAL
partition (§8); `LIVELOCK_LEAD` (§8, §9a); an explicit `0` is a measured zero and absence is unmeasured (§9); mixed-status
presentation and the cohort union (§9); container exit on the "last line" (§9a); one engine name, `pof-walker@1`.
Reach paging is a transport concern, not a format rule: the API and MCP tools cap their payloads themselves.

**Resolved since (2026-11-02, second pass):** a gate's unguarded `then` is its default ("else") branch and a gate must still
branch (§4, §8); `INFLUENCES_UNSUPPORTED` (§8); an unknown `profile.nodeClasses[].coreKind` is reported under `UNKNOWN_KIND` (§8);
the wheel marks stale (dashed) and unverified (dotted) cells (§9).

**Still open:** the top-left "reach unverified · graphHash null" badge only checks whether runs are pinned, so it cannot say
"stale" for a plain document; a produce path that can read sibling steps; per-node `story_*` tables; whether `synthetic-scale`'s
96 decorative `influences` edges and `mage-arena` G2 (three unguarded `then`, nothing guarded) should be fixed in those documents
(they are true findings; the fix belongs to the producers).
