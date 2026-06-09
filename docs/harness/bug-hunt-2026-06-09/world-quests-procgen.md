# Bug Hunt — World, Quests & Procgen
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. Every generated quest's "Tell me more" dialogue choice points to a non-existent node
- **Severity**: critical
- **Category**: data-loss
- **File**: src/lib/quest-generator.ts:372
- **Scenario**: A designer generates quests, a player (or the in-engine dialogue runtime / the UI dialogue-tree viewer) opens the quest-giver conversation and clicks the always-present middle choice "Tell me more about this task."
- **Root cause**: `generateQuestDialogue` builds exactly three nodes — `openingId`, `acceptNode`, `declineNode`. The opening node's three choices wire `nextNodeId` to `acceptNode`, a fresh `did()`, and `declineNode` respectively. The fresh `did()` on line 372 mints a brand-new node id that is **never pushed into the `nodes` array**. So the choice references a dialogue node that does not exist anywhere in the tree. The design assumption — "every `nextNodeId` resolves to a node in this quest's `dialogue[]`" — is violated for one of the three branches of *every single quest* (clear/fetch/interact/traverse all use this helper). Any consumer that does `nodes.find(n => n.id === choice.nextNodeId)` gets `undefined` and either dead-ends silently or dereferences null.
- **Impact**: corruption — 100% of generated quests ship a structurally broken dialogue tree with a dangling pointer; a dialogue walker crashes (null deref) or silently traps the player on an unresolvable branch. This is the module's primary output artifact, so the corruption is total, not edge-case.
- **Fix sketch**: Make dangling references impossible by construction: either drop the "Tell me more" choice, or generate the info node first (`const infoNode = did()`), push a real `DialogueNode` with that id (text + a single `[Back]`/accept choice), and only then reference it. Add a post-build invariant assert that every non-null `nextNodeId` exists in `nodes` (a `Set` membership check) and fail/log generation if not — turning the whole class of dangling-pointer bugs into a hard build-time error.

## 2. Module-global `nextId` counter is reset and mutated per call — concurrent generations collide
- **Severity**: high
- **Category**: race-condition
- **File**: src/lib/quest-generator.ts:90-93,553
- **Scenario**: Two clients (or one client double-clicking "Generate") POST `/api/quest-generation` close together. Request A enters `generateQuests`, sets `nextId = 0`, and starts minting ids. Request B enters, resets `nextId = 0` again mid-flight, and both now interleave `++nextId` over the same module-scoped variable.
- **Root cause**: `nextId` is a single mutable module-level singleton shared by `uid()/oid()/did()/cid()`, and `generateQuests` resets it to 0 on entry (line 553) instead of using a per-invocation generator. In a long-lived Next.js server process the module is shared across all requests, so the "ids are unique within one result" assumption fails under any concurrency: a B-reset rewinds A's counter, producing **duplicate quest/objective/dialogue/choice ids across the same result and across responses**. Because `DialogueChoice.nextNodeId` is matched by id, a collision can make a choice jump to the *wrong* node; React keys built from these ids also collide.
- **Impact**: corruption / UX degradation — duplicate React keys (rendering glitches, lost state), and dialogue choices resolving to the wrong node in another quest. Intermittent and load-dependent, so it survives testing and bites in production.
- **Fix sketch**: Eliminate shared mutable state: create a per-call counter closure (e.g. `const mkId = (() => { let n = 0; return (p) => \`${p}-${++n}\`; })()`) inside `generateQuests`, or pass an id-factory through the synth functions. No module-level `let nextId`, so concurrent calls can never alias each other's counter.

## 3. `asZone` trusts `connections` array elements without validating they are strings
- **Severity**: high
- **Category**: edge-case
- **File**: src/lib/world/zone-analysis.ts:31,39
- **Scenario**: A catalog `zone-map` entity's `data` (arbitrary persisted/AI-authored JSON) has `connections: ["z2", 7, null, {"id":"z3"}]` — well-formed enough to pass the guard but with non-string members. `asZone` returns a `ZoneLike`, and `lintZone` then iterates `zone.connections` calling `byId.get(targetId)`.
- **Root cause**: The narrowing guard checks `Array.isArray(d.connections)` and then casts `d.connections as string[]` (line 39) — a cast, not a validation. The trust boundary (`asZone` exists precisely to sanitize untrusted `data: unknown`) only validates the array *container*, never its *elements*. Downstream `lintZone` assumes every entry is a real zone id: a numeric/object/null entry never matches `byId.get(...)`, so it is silently reported as a `dangling-connection` "Connects to unknown zone 'undefined'" (or `[object Object]`), and a malicious/garbled entry could also poison the reverse-reachability check on line 80 (`z.connections.includes(zone.id)`), flipping reachable zones to "unreachable".
- **Impact**: corruption of analysis output / silent failure — the lint surfaces bogus errors or, worse, *masks* real connectivity problems, and designers act on a wrong world-graph health report. A non-string id that happens to stringify to a valid id could even hide a genuinely dangling edge.
- **Fix sketch**: Validate at the boundary so bad data can't enter the model: `connections: d.connections.filter((c): c is string => typeof c === 'string')` in `asZone` (or return `null` if any element isn't a string). This makes "every `ZoneLike.connections` member is a string id" a type-level guarantee the rest of the linter can rely on.

## 4. Fetch-quest target rooms picked with un-seeded `Math.random()` — non-reproducible, hydration-divergent
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/quest-generator.ts:191
- **Scenario**: A designer generates quests, dislikes one, and clicks "Generate" again to compare — or the same `(classes, levelDoc)` input is run twice for a diff/regression check. Each run uses `explorationRooms[Math.floor(Math.random() * explorationRooms.length)]` to choose the fetch target.
- **Root cause**: The generator is otherwise a deterministic pure function of `(scannedClasses, levelDoc)` — actor classification, segment grouping, traversal arcs and coherence checks are all stable — but `generateFetchQuests` injects an un-seeded `Math.random()`. The implicit contract "same world + same level doc ⇒ same quests" is broken for the entire fetch category: target room, difficulty, description and `sourceHint` all shift run-to-run. There is no seed parameter threaded in (unlike the procgen/scatter runs which persist a `seed`), so results are unauditable and can't be regenerated. Identical inputs producing different outputs also defeats any caching, diffing, or snapshot test over the result.
- **Impact**: UX degradation / non-reproducibility — "regenerate to compare" is meaningless for fetch quests, balance reviews can't be reproduced, and any future memoization of generation results returns stale-but-different data.
- **Fix sketch**: Make generation a pure function of an explicit seed: accept a `seed` (default derived from `levelDoc.id` + item index) and use a small deterministic PRNG, or simply select the target deterministically (e.g. `explorationRooms[itemIndex % explorationRooms.length]`). Same inputs then always yield the same quests, making the whole pipeline reproducible by construction.
