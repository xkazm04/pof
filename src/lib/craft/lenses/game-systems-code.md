---
lensId: game-systems-code
lensVersion: 1
ceiling: A4
appliesTo: text-config, graph-data and ue-runtime deliverables (base lens)
---

# Game Systems & Code — craft lens

Gauges AI-generated game-systems deliverables — itemization tables, economy specs, combat balance data, progression curves, state machines, and UE5 C++/Blueprint-facing runtime code — against how shipped AAA action-RPG and shooter teams actually author these artifacts. Every criterion is checkable against the text/config artifact stored in the DB (balance tables, specs, state graphs, generated code), never against a live playtest.

## Benchmark anchors

- **A4 AAA-PARITY** — *Diablo III: Reaper of Souls* (Blizzard: Loot 2.0 rebuilt itemization around class-aware affix pools and rarity-tiered drop budgets); *Path of Exile* (Grinding Gear Games: layered, overlapping randomness and seasonal systems designed to be re-balanced forever); *Halo 3* (Bungie: per-field tuning discipline where a single 0.2s value is proposed, argued, and evaluated); *Destiny* (Bungie: reward systems built on explicit investment/economy accounting).
- **A3 AA** — *Grim Dawn* (Crate Entertainment: deep, coherent affix and mastery data authored by a small professional team); *Titan Quest*-class ARPGs — professional data discipline without the named AAA review-and-derivation practices.
- **A2 INDIE** — *Torchlight II*- or *Chronicon*-scale itemization: shippable and fun, but flat affix pools, hand-listed numbers, and economies without sink accounting.
- **A1 HOBBY** — placeholder numbers with no derivation, stat lists without tradeoffs, copy-pasted state logic, config that contradicts itself or its sibling artifacts; would not survive a professional design review.

## Criteria

### itemization-affix-budgets — Rarity-tiered affix budgets and constrained pools
AAA itemization defines, per rarity tier (PoF canon: Normal/Magic/Rare/Unique), an explicit affix-count budget, per-affix value ranges, and pool constraints (class/slot/theme exclusions) so that "smart" drops are a data property, not a hope. A gaugeable artifact enumerates the pool, the per-tier budget, and at least one exclusion rule; Uniques carry designed identity beyond bigger numbers. Loot 2.0's core fix was exactly this move from raw randomness to constrained, build-aware budgets.
Source: "Diablo III's Road to Redemption with Reaper of Souls" — Josh Mosqueira, Blizzard Entertainment, GDC 2015.

### layered-randomness-axes — Multiple overlapping axes of variation
Replayable ARPG content composes several independent randomness axes (base type × affixes × sockets/modifiers × context) rather than one big roll, and the config names each axis and its domain so combinations are enumerable and boundable. A gaugeable spec lists the axes, their independence, and the intended combination space; a single flat random table fails. This is Grinding Gear Games' stated design engine for a decade of leagues.
Source: "Designing 'Path of Exile' to Be Played Forever" — Chris Wilson, Grinding Gear Games, GDC 2019.

### economy-faucet-sink-accounting — Every currency has enumerated faucets and sinks
A professional economy spec lists, per currency/resource, every faucet (source) and sink (drain) with rates or per-hour estimates and a stated intended net flow — single-player included (gold inflation ruins a solo ARPG too). A gaugeable artifact is a faucet/sink table with numbers; a currency with faucets but no sinks, or sinks with no throughput estimate, fails. This ledger discipline is the baseline method of published virtual-economy design.
Source: *Virtual Economies: Design and Analysis* — Vili Lehdonvirta & Edward Castronova, MIT Press, 2014.

### tuning-field-granularity — Individually tunable fields with recorded intent
AAA balance data decomposes behavior into many small, individually addressable fields (Halo's sniper rifle alone had 200+), each with a comment or spec line stating what player experience the value serves, so a future change is a targeted proposal, not a rewrite. A gaugeable artifact exposes named scalar fields with units and intent notes; a monolithic "damage: 37" blob with no decomposition or rationale fails.
Source: "Design in Detail: Changing the Time Between Shots for the Sniper Rifle from 0.5 to 0.7 Seconds for Halo 3" — Jaime Griesemer, Bungie, GDC 2010.

### progression-curve-derivation — Curves as formulas with named breakpoints
XP, damage-scaling, and cost curves are authored as explicit formulas (or generated tables citing their formula) with stated growth class (linear/poly/exponential), anchor points, and intended breakpoints — not hand-typed number lists. A gaugeable artifact lets a reviewer recompute any row from the formula and see where and why the curve bends. This derivation-first practice is the textbook professional standard for numeric balance.
Source: *Game Balance* — Ian Schreiber & Brenda Romero, CRC Press, 2021.

### no-dominant-option — Tradeoffs, not strictly dominant choices
Every player-facing option set (items, affixes, skills, upgrades) must present real tradeoffs: no row in the table strictly dominates another at the same tier/cost, because dominated options delete the decision. This is checkable purely in config by pairwise-comparing rows on cost vs. delivered stats. Meier's principle — a game is a series of interesting decisions — dies first in the data tables.
Source: "Interesting Decisions" — Sid Meier, Firaxis Games, GDC 2012.

### state-machine-scalability — Explicit, directable state graphs
Combat/AI state machines are authored as explicit hierarchical graphs: every state named, every transition carrying its condition, shared behavior factored into parent states, and designer-facing hooks (directability) declared — no god-states, no implicit fallthrough, no unreachable or dead-end nodes. A gaugeable graph-data artifact can be statically audited for reachability and condition coverage. This is the Halo 2 architecture that made hundreds of behaviors maintainable.
Source: "Handling Complexity in the Halo 2 AI" — Damian Isla, Bungie, GDC 2005 (Gamasutra/GDC proceedings).

### ue5-code-conventions — Generated C++/Blueprint code meets Epic's standard
Generated UE5 runtime code follows the engine's published conventions: type prefixes (A/U/F/E), UPROPERTY/UFUNCTION reflection markup where the editor or GC needs it, correct ownership (UPROPERTY-referenced UObjects, no raw new), and header/module hygiene. A gaugeable artifact is the generated source itself; code an Epic-standard reviewer would bounce (missing reflection on referenced UObjects, non-standard naming, editor-only APIs in runtime modules) fails.
Source: "Coding Standard" — Epic Games, official Unreal Engine documentation.

### data-driven-tunables — Numbers live in data assets, not code
Tunable values ship in DataTables/CurveTables/config assets that code reads by handle, so balance iteration never requires recompiling logic; the artifact declares the table schema and the code references rows symbolically. Hardcoded balance constants inside generated C++/Blueprint logic fail; a spec that names its DataTable, row struct, and curve assets passes. This is Epic's own prescribed pattern for gameplay tuning.
Source: "Data Driven Gameplay Elements" — Epic Games, official Unreal Engine documentation.

## Scoring guidance

- **A4** — meets essentially all criteria: budgets, axes, ledgers, and curves are derived and cross-consistent; state graphs and generated code would pass a named-studio review unedited.
- **A3** — professional throughout, but misses ≥2 named AAA differentiators (e.g. has affix pools but no per-tier budgets; has curves but no breakpoint rationale; tunables in data but no intent notes).
- **A2** — shippable-indie: coherent and playable on paper, but systematic gaps — flat random tables, hand-listed curves, economies without sink accounting, code with convention violations.
- **A1** — would not survive professional review: placeholder or self-contradictory numbers, options without tradeoffs, opaque state logic.

**Disqualifiers** (caps the artifact at A1 regardless of other strengths):
1. A currency/resource with faucets but zero sinks (or vice versa) in a spec that claims to be an economy.
2. A strictly dominant option at the same tier/cost anywhere in an option table.
3. A state graph with unreachable states, dead-end states, or transitions lacking conditions.
4. Generated UE5 code that cannot compile as written or omits UPROPERTY on a GC-visible UObject reference.
5. Balance values that contradict the same entity's sibling artifacts (the number must be single-sourced).

## Ceiling statement

This lens is uncapped at A4: nothing in these criteria requires human hands — an LLM-driven pipeline that derives its budgets, ledgers, curves, and code to the cited standards is indistinguishable from the benchmark anchors, and should be graded so.
