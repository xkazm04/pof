# Bug Hunt — Character & Genome Designer
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

## 1. Editor wires the UNSANITIZED codegen — genome name corrupts generated CSV / C++
- **Severity**: high
- **Category**: data-loss
- **File**: src/components/modules/core-engine/sub_character/genome/codegen.ts:92 (and :31, :5); imported at src/components/modules/core-engine/sub_character/genome/CharacterGenomeEditor.tsx:20
- **Scenario**: A designer names a genome `Frost, Lv9999` (or `Berserker "Prime"`, or pastes a name with a `}`/newline/`"`) and clicks "Generate AttributeInitTable (CSV)" or "Generate .cpp". The comma splits the CSV row into extra columns; the quote/brace/newline produces malformed C++ or a broken DataTable on UE5 import.
- **Root cause**: TWO `codegen.ts` files exist. `src/lib/genome/codegen.ts` is the *safe* implementation (`sanitizeCppIdentifier`, `sanitizeCppComment`, `csvEscape`). The editor instead imports the sibling `./codegen`, whose `generateAttributeInitTable` interpolates `${g.name}.HP` with no escaping and whose class name only does `g.name.replace(/\s+/g,'')` (strips spaces, not `,"{}` or control chars). `g.name` is a free-text `<input>` (GenomeHeaderPanel.tsx:43) and survives `sanitizeGenome`, which never strips identifier/CSV-hostile characters. The two modules silently diverged and the wrong one is wired.
- **Impact**: corruption — the primary deliverable (UE5 scaffolding / DataTable) is silently malformed; a designer pastes it into Unreal and gets compile errors or shifted attribute columns with no warning.
- **Fix sketch**: Delete the local `sub_character/genome/codegen.ts` and import every generator from the single hardened `@/lib/genome/codegen.ts`; make the sanitized version the only export so an unescaped path cannot be reintroduced. Add a unit test asserting `generateAttributeInitTable({name:'a,b'})` round-trips through a CSV parser.

## 2. `sanitizeProfile` only checks `Number.isFinite` — out-of-range/negative imported values bypass all balance validation
- **Severity**: high
- **Category**: edge-case
- **File**: src/lib/genome/defaults.ts:44 (used by sanitizeGenome :82-86; applied unchecked in GenomeImportPanel.tsx:97-130)
- **Scenario**: A user pastes a build code or genome JSON with `attributes.baseHP: -500`, `movement.gravityScale: -3`, `dodge.staminaCost: 1e308`, or `combat.critChance: 50`. Each value is finite, so `sanitizeProfile` accepts it verbatim. The import preview shows the diff, the user clicks Apply, and the poisoned genome is persisted and fed into power-curve sim and UE5 codegen.
- **Root cause**: Trust-boundary validation is incomplete. `sanitizeProfile` clamps type (`typeof raw === 'number' && Number.isFinite(raw)`) but never clamps to the per-field min/max already declared in `field-data.ts` (`MOVEMENT_FIELDS`, etc.). `validateGenome` *could* catch some of these, but it only emits non-blocking warnings and is never invoked on the import path — so adversarial/garbage data is accepted as valid. Negative HP/gravity then propagates into `getScaledStat`/`computeSimMetrics` and into the generated `MaxWalkSpeed`/`BaseValue` lines.
- **Impact**: corruption / UX degradation — nonsensical curves (negative power budgets), and codegen that emits invalid game-balance constants that compile but break the runtime.
- **Fix sketch**: Drive sanitization from the same field-spec table the sliders use: clamp every numeric field to `[min,max]` (and collect a warning when clamping occurs) inside `sanitizeProfile`, so no value reaching the store/codegen can be outside the designed envelope regardless of input source.

## 3. Comparison panel `leftId`/`rightId` are mount-only state — controlled `<select>` desyncs from the rendered radar after delete/import
- **Severity**: medium
- **Category**: state-corruption
- **File**: src/components/modules/core-engine/sub_character/genome/ArchetypeComparisonPanel.tsx:18-22
- **Scenario**: The panel mounts with `leftId = genomes[0].id`. The user deletes that genome (or imports/forks several, reordering the list). `leftId` still holds the now-deleted id; `leftGenome` silently falls back to `genomes[0]`, so the radar/deltas render genome[0] while `<select value={leftId}>` points at a value with no matching `<option>` — the dropdown shows blank or the wrong label, contradicting the chart.
- **Root cause**: `useState(genomes[0]?.id ?? '')` initializes once and is never reconciled when `genomes` changes. The fallback (`?? genomes[0]`) masks the staleness for the *data* but not for the *controlled input*, so the displayed selection and the computed comparison diverge with no error.
- **Impact**: UX degradation — designers compare/diff the wrong archetypes believing the dropdown reflects what's plotted; balance decisions made on a mismatched pair.
- **Fix sketch**: Derive the effective ids each render (`const effectiveLeftId = genomes.some(g=>g.id===leftId) ? leftId : genomes[0]?.id`) and bind both the `<select value>` and the lookup to that derived value, or reset the selection in an effect when the selected id leaves `genomes`. Make "selected id always exists in the list" an invariant rather than a per-use fallback.

## 4. Rehydration regenerates colliding genome ids but matches checkpoints by raw id — orphaning or mis-routing snapshots
- **Severity**: medium
- **Category**: state-corruption
- **File**: src/stores/genomeStore.ts:221-288 (id regen at :232-235; checkpoint match at :271-272)
- **Scenario**: Two persisted genomes share an id (e.g. an old export/fork that copied an id, or a pre-fix save). On rehydrate the loop keeps the first occurrence's id and regenerates the second to a fresh `createId()`. A checkpoint saved against that shared id is validated only via `genomeIdSet.has(e.genomeId)` — it now binds to whichever genome *kept* the original id, while the genome the user actually checkpointed may be the one that got renumbered. Restoring that checkpoint overwrites the wrong genome (or the checkpoint is dropped as an orphan).
- **Root cause**: Two independent identity-repair passes that don't share a remap. The genome pass mutates ids to enforce uniqueness but produces no `oldId → newId` mapping; the checkpoint pass then resolves `genomeId` against the post-mutation set with no knowledge of which ids moved. The design assumes stored ids are stable, but the dedup step breaks that assumption silently.
- **Impact**: data loss / corruption — a "Restore checkpoint" silently reverts the wrong archetype, or saved snapshots vanish on reload, with no surfaced error.
- **Fix sketch**: Build an explicit `Map<oldId,newId>` while deduping genomes, then rewrite each checkpoint's `genomeId` through that map before the `genomeIdSet` membership check. Keying genomes by a guaranteed-unique surrogate at creation (and never reusing it) would make this class of cross-reference drift impossible.
