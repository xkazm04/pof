# Bug Hunt — Inventory System
> Total: 4
> Severity: 0 critical, 3 high, 1 medium, 0 low

The Inventory System spans the item DNA/genome engine (`src/lib/item-dna/*`), the item-genome Zustand store, the DNA-genome editor (`sub_inventory/dna-genome/*`), and the gear catalog (`sub_inventory/catalog/*`). The four findings below are the highest-severity real bugs: one state-corruption landmine in the store, one input that silently poisons genome state with `NaN`, one render-time crash in the catalog, and one silently-dead "evolution" feature.

## 1. Item genome store has no id-uniqueness guard — edit/delete/evolve can hit the wrong genome
- **Severity**: high
- **Category**: state-corruption
- **File**: src/stores/itemGenomeStore.ts:42-44, 72-122, 200-215
- **Scenario**: A user imports/pastes a genome whose JSON `id` collides with an existing one, OR `createItemId()` (an 8-char `Math.random().toString(36).slice(2,10)` string) collides while adding/duplicating/breeding. The user then drags a trait slider, clicks delete, or evolves — and a *different* genome silently changes or disappears.
- **Root cause**: Every mutation is keyed by `g.id === id` via `map`/`filter`. The sibling **character** store (`src/stores/genomeStore.ts`) carries an explicit `withUniqueId` helper plus a rehydration loop that regenerates duplicate/empty ids — with a comment warning this exact failure. The item store omits all of it: `createInitialGenomes()` (l.42) assigns preset ids with no collision check, the rehydration `merge` (l.200-215) preserves persisted ids verbatim with no dedup, and `addGenome`/`importGenome`/`duplicateGenome`/`breedSelected` never verify uniqueness. With duplicate ids, `genomes.find(g => g.id === selectedId)` always returns the *first* match, so the user may be permanently unable to select/edit the second copy.
- **Impact**: corruption / data loss — silent mutation or deletion of the wrong saved genome; one genome becomes unreachable.
- **Fix sketch**: Mirror `genomeStore`: add a `withUniqueId(genome, existingIds)` helper applied in every add path, and enforce id uniqueness (regenerate duplicate/empty) inside the rehydration loop and in `createInitialGenomes`. Better: make ids structurally unique (counter or `crypto.randomUUID()`).

## 2. Mutation Rate/Max fields write `NaN` into genome state, silently disabling mutations
- **Severity**: high
- **Category**: state-corruption
- **File**: src/components/modules/core-engine/sub_inventory/dna-genome/EditorTab.tsx:128-131, 140-143
- **Scenario**: In the DNA Editor's Mutation Config, the user clears the "Rate" (or "Max") number input (or types non-numeric text). `e.target.value === ""`, so `parseInt("")` is `NaN`. `mutationRate: parseInt(e.target.value) / 100` writes `NaN` straight into `selected.mutation.mutationRate` (and `maxMutations: parseInt(...)` writes `NaN`), which is then persisted to localStorage.
- **Root cause**: Live edits bypass validation. `sanitizeItemGenome` (`src/lib/item-dna/defaults.ts`) coerces `NaN` back to defaults — but only on import/rehydration, never on a keystroke. So within the session the genome holds `NaN`. Downstream, `rollAffixesWithDNA` does `Math.random() < genome.mutation.mutationRate` (`< NaN` → always `false`) and `mutationCount < genome.mutation.maxMutations` (`0 < NaN` → always `false`): mutations are silently turned off with no error. `MonteCarloSimulator`/`predictDistribution` then surface `NaN%`.
- **Impact**: corruption + silent failure — persisted genome is poisoned; the mutation system stops working with zero feedback until a reload re-sanitizes it.
- **Fix sketch**: Parse defensively at the trust boundary: `const n = Number(e.target.value); if (!Number.isFinite(n)) return;` then clamp (`clamp01` for rate, `Math.max(0, Math.min(6, Math.round(n)))` for max) before writing. Run the same `sanitizeItemGenome` numeric guards on live edits, not just on import.

## 3. `entries[0]!` feeds `undefined` into `useGeneration`, crashing the catalog tab when the items catalog is empty
- **Severity**: high
- **Category**: edge-case
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:83-84
- **Scenario**: `const primaryEntry = (primaryItem && entryByItemId.get(primaryItem.id)) ?? entries[0]!;` then `const gen = useGeneration(primaryEntry);`. If `useItemEntries()` returns `[]`, `entries[0]!` is `undefined` (the `!` only silences TypeScript). `useGeneration` immediately calls `catalogModule(entity.catalogId)` on `undefined`, throwing `Cannot read properties of undefined (reading 'catalogId')` during render → the whole Catalog & Gear tab errors out.
- **Root cause**: A non-null assertion treated as a guarantee. The items catalog is normally seeded (`seedItemEntries`), but the catalog store's persist `merge` does `{ ...current.entitiesByCatalog, ...(persisted.entitiesByCatalog ?? {}) }` (`src/stores/catalogStore.ts:118-125`) — a persisted blob containing `items: {}` (older/partially-cleared state) overrides the freshly seeded items with an empty map, making `entries` empty. `useGeneration` has no `undefined`-entity defense either.
- **Impact**: crash — unrecoverable white-screen/error-boundary for the primary inventory catalog view.
- **Fix sketch**: Make the empty case representable: guard with `if (entries.length === 0) return <EmptyCatalog/>;` before calling `useGeneration`, or change `useGeneration` to accept `StoredCatalogEntity | undefined` and no-op (`isRunning:false`, `generate` warns) when undefined. Also harden the catalog `merge` to re-seed any catalog whose persisted map is empty.

## 4. Item evolution's tag bonus is permanently dead — `dominantTraits` is never populated
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/lib/item-dna/rolling-engine.ts:59-63, 246-264
- **Scenario**: A user repeatedly "Simulate Combat Usage" in the Evolution tab; the item tiers up and the UI advertises "items develop stronger versions of used affixes" and "+5/10/15% dominant weight." But the per-affix evolution weighting in `calcEffectiveWeight` never actually changes roll outcomes.
- **Root cause**: `evolveGenome` returns `dominantTraits: evo.dominantTraits` unchanged — nothing in the codebase ever writes into `dominantTraits`, so it stays `[]`. In `calcEffectiveWeight`, `evoBonus = 1 + tier*0.15 * (dominantTraits.some(t => affix.tags.includes(t)) ? 1 : 0)` collapses to `1 + tier*0.15*0 = 1` for every affix. The documented "evolution strengthens used affixes" behavior is unreachable. (Only the separate flat trait-weight bump on tier-up, l.246-251, has any effect, so the feature looks half-alive.)
- **Impact**: UX degradation — a shipped, prominently-displayed mechanic silently does nothing; balance/simulation numbers shown to designers are misleading.
- **Fix sketch**: Populate `dominantTraits` where rolls are recorded (e.g., accumulate the tags of affixes that actually rolled during simulated usage and store the top-N back into `evolution.dominantTraits`), or, if the tag bonus is intentionally deferred, remove the dead `evoBonus` term and the UI copy so the displayed effect matches reality.
