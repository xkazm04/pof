# ARPG Systems Laws — the Diablo/PoE-grade rules catalog generation must obey

This is the **systems reference** for PoF: the real ARPG design laws (rarity, affixes, damage math, ailments, loot, defenses, progression, crafting, endgame) that make catalog-pipeline output *faithful to the genre* instead of generic. Catalog rows generate game content; these laws define the shape, the numbers, and the wiring each system carries.

**Read alongside (source of truth for their own topic — not duplicated here):**
- [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) — the data contract (UE ↔ SQLite, schema-down/content-up) + the 4-tier acceptance ladder (L0 data · L1 selection · L2 static · L3 runtime · L4 visual). **Where an artifact's truth lives and how it's proven.**
- [`AUTHORING.md`](AUTHORING.md) — *how* to build a catalog row (the StepSpec chassis recipe + the loop). **How to wire these laws into a pipeline.**
- The Project Canon (`src/lib/catalog/canon/canon-seed.ts`) — the distilled, prompt-injected subset of these laws (scoped by catalogId). **This doc is the long form; the canon is the in-prompt cheat sheet.**

**Anchoring numbers.** All envelopes extend the existing canon `proj-balance` rule: *tier power target ≈ 100 (±10%); price/power ratio 0.8–1.2×*. ARPG-specific envelopes below are concrete so a generator can act on them; document any intentional outlier.

**Direction of truth (from WIRING-AND-ACCEPTANCE §1).** Schema + math flow **UE → app** (the app validates, never re-authors): attributes live in `UARPGAttributeSet`, row shapes in the `F*Row` structs, damage math in `ARPGDamageExecution`. Content/spec flows **app → UE** via seed scripts / generated C++. Every "UE mapping" below names the struct/GE/DataTable the artifact realizes against.

---

## 1. Item Rarity & Item Level

**(a) Rule / intent.** Every item is one base type carrying an implicit, plus 0–N explicit affixes whose budget scales with **rarity**. Power is *earned* (canon `game-pillars`) — higher rarity = more affixes, not bigger raw numbers on the same affix. Rarity is a budget tier, not a quality multiplier on a single stat.

Rarity ladder (maps the existing `ItemData.rarity` strings):

| Rarity | Affix budget | Identity | Drop posture |
|--------|--------------|----------|--------------|
| **Normal** (`Common`) | base + implicit only, 0 explicit | the clean base type | floor of every roll |
| **Magic** (`Uncommon`) | ≤1 prefix + ≤1 suffix | focused, predictable | common |
| **Rare** (`Rare`) | ≤3 prefix + ≤3 suffix | the build-defining roll | uncommon |
| **Set** (`Epic`) | fixed mods + a set bonus that unlocks by pieces equipped | curated synergy | rare, named pool |
| **Unique** (`Legendary`) | fixed/range-rolled mods + ≥1 mod that *changes a rule* | a mechanic, not a stat-stick | rarest, named pool |

**(b) Data shape.** `{ baseType, slot, rarity, itemLevel (ilvl), requiredLevel, implicit: Affix, explicits: Affix[], sockets?, links?, gems? }`. Weapons add `{ damageMin, damageMax, attackSpeed (APS), critChance, critMulti, damageType }`. Armour pieces add `{ armour?, evasion?, energyShield?, block? }`.

**(c) Balance envelopes.**
- **ilvl** 1–100; **requiredLevel** ≈ `ilvl − (5..15)` (you can use an item a bit below its drop level). Set/Unique may pin a fixed requiredLevel.
- **Base weapon DPS** = `((damageMin+damageMax)/2) × APS`; APS envelope 1.0–1.8 (daggers/claws fast ~1.5–1.8, two-handers slow ~1.0–1.2). Base crit chance per weapon class 5%–6.5%; global crit multi base **+150%** (×2.5 on crit).
- **Armour/evasion/ES base rolls** scale with ilvl and slot; a chest carries ~the defence of 2–3 small slots. Sockets: gear holds **1–6** sockets (weapons/chests up to 6, gloves/boots/helms up to 4, rings/amulets 1); links group sockets that power a skill+supports.
- **Implicit** is base-type identity (e.g. a ruby ring's implicit = fire resist); explicit budget is the rarity table above. Total item power still targets the tier ≈100 (±10%) envelope — rarity spends that budget across *more* affixes, not a larger sum.

**(d) Catalog + UE mapping.** Owner: **`items`** (`ItemEntry` / `ItemData`, slot via `type`+`subtype`). Realizes to `DT_Items` row + `SM_`/`MI_` mesh/material + equip GE. The base type's stat block validates against `UARPGAttributeSet` (Armour, AttackSpeed, etc.). Each explicit affix is a `GE_` (see §2). Drop ilvl is set by area/monster level (§7, §11), never by the item itself.

---

## 2. Affix System

**(a) Rule / intent.** An item's variable power is a set of **prefixes** (offensive/defensive numeric mods, e.g. *added damage*, *increased armour*, *max life*) and **suffixes** (utility/conditional mods, e.g. *resistances*, *attributes*, *speed*). Counts are capped by rarity (§1); each affix is one **GameplayEffect** applied while equipped. The roll is constrained by **ilvl** — bigger magnitudes require a higher item level to roll.

**(b) Data shape.** `Affix = { id, slot: 'prefix'|'suffix', mod: 'StatId', tier: 1..N, valueMin, valueMax, rolledValue, ilvlReq, weight, group?, tags?: string[] }`. `group` blocks two affixes of the same family on one item (one "life" prefix max). Hybrid mods carry two stats in one affix line; meta/crafted mods occupy an affix slot and modify *other* mods.

**(c) Balance envelopes.**
- **Count by rarity:** Magic ≤1 prefix + ≤1 suffix; Rare ≤3 prefix + ≤3 suffix. (Set/Unique mods are fixed, not rolled into the prefix/suffix pool.)
- **Tier gating by ilvl:** each affix family has tiers T1 (best) … Tn (worst). A tier rolls only if `ilvl ≥ ilvlReq(tier)`. Example "Maximum Life" prefix: T8 +10–19 (ilvl 1), T6 +30–39 (ilvl 18), T4 +50–59 (ilvl 36), T2 +80–89 (ilvl 60), T1 +100–119 (ilvl 80+). **Top tiers only on high-ilvl bases** — this is the core ilvl→affix law.
- **Magnitude bands:** a tier's `valueMax/valueMin` spread is ~1.4–1.6× (a roll feels variable but not random); adjacent tiers step ~1.5–2× in magnitude.
- **Weighting:** rarer/stronger mods carry lower `weight` (the relative pick chance within the pool). High-tier mods are weighted lower than low-tier so good rolls stay scarce.
- **Affix pool per base/slot:** the pool is gated by base type + slot (a wand can roll spell mods a sword can't; boots roll move-speed, weapons don't).

**(d) Catalog + UE mapping.** Affix *catalogue* is content owned by **`items`** (the affix pool that bases draw from). Each affix → a `GE_` GameplayEffect (e.g. `GE_Affix_AddedFireDamage`) that modifies a `UARPGAttributeSet` attribute or grants a `Stat.*`/`Keyword.*` tag; magnitude is the rolled value. Meta/crafted mods come from the crafting bench (§10). **Wiring law: an affix IS a GameplayEffect** — granted while equipped, never an inert tooltip string.

---

## 3. Damage & Combat Math

**(a) Rule / intent.** All offensive numbers route through one pipeline so cross-catalog content composes predictably. Damage types: **Physical, Fire, Cold, Lightning, Chaos** (Chaos/Poison = the armour-bypassing, DoT-leaning type). The stacking model is the genre invariant — **added → increased (additive %) → more (multiplicative %)** — and it must be respected by every generator that touches a number.

**(b) Data shape.** Hit = `{ baseDamage per type, addedFlat[], increasedPct (sum), morePct[] (each its own multiplier), conversionPct?, critChance, critMulti, accuracy }`. Defender side: `{ resists per type, armour, evasion, block, maxResist }`.

**(c) The math (the law).**
1. **Base + Added:** sum flat base and flat added of each type → `dmg`.
2. **Increased (additive %):** all `increased`/`reduced` of a stat **sum into one multiplier**: `× (1 + Σincreased%)`. Two "+20% increased fire" = ×1.40, *not* ×1.44.
3. **More (multiplicative %):** every `more`/`less` is **its own multiplier**, applied in sequence: `× (1+more₁) × (1+more₂)…`. "more" is the scarce, powerful keyword — reserve it for support gems, ailments, and big conditional bonuses.
4. **Conversion:** a % of one type becomes another *before* that target type's increases apply (skill conversion then gear conversion; never >100% total).
5. **Crit:** `effectiveCrit = baseCrit × (1 + increasedCritChance)`, capped 95%; on crit, `× critMulti` (base 2.5 = +150%).
6. **Accuracy vs evasion** (for attacks; spells/DoT never miss): `hitChance = acc / (acc + (evasion/4)^0.8)`, floor ~5%, no hard cap below 100%.
7. **Mitigation order (defender):** evasion (avoid) → block (avoid) → armour (physical reduction) → resist (elemental/chaos reduction).
8. **Armour mitigation formula:** `reduction = armour / (armour + 5 × rawPhysicalHit)`, soft-capped (great vs many small hits, weak vs one big hit). Never a flat % off.

**(d) Balance envelopes.** A baseline player hit at the tier-100 power target deals ≈100 effective DPS into an unmitigated target; "more" multipliers stay ≤ +50% each so two stacking is not a one-shot. Crit multi above +250% must be an outlier (documented). Conversion cannot exceed 100%.

**(e) Catalog + UE mapping.** The formula is UE-owned (`ARPGDamageExecution`, an `UGameplayEffectExecutionCalculation`); the app **validates** content against it (canon `proj-sot`). Owners: **`spellbook`** abilities and **`items`** affixes feed added/increased/more and damage type; **`status-effects`** feed ailments (§5). A generated ability's damage number is meaningless unless it declares its **damage type** and which stacking bucket it adds to.

---

## 4. Resistances & Penetration

**(a) Rule / intent.** Elemental and chaos damage is reduced by the defender's **per-type resistance**, capped at **75%** by default. Resistance is the player's primary defence against non-physical damage; getting *to* cap is a build cost. Attackers answer with **penetration** (ignore X% of resist) and **reduction** (lower the target's resist), which differ.

**(b) Data shape.** Defender: `{ fireRes, coldRes, lightningRes, chaosRes, maxFireRes…, } ` each 0–`maxRes`. Attacker/skill: `{ penetration per type %, resReduction per type % }`. Map mod: `{ playerResAll: -X }`.

**(c) Balance envelopes.**
- **Cap 75%**; **overcap** (resist *above* 75%) is real and valuable because it buffers resist-reduction map mods. Floor is negative (resist can go below 0, taking *extra* damage).
- **Max-resist mods** (rare) raise the cap to ≤90%.
- **Penetration** ignores up to the listed % of the target's resist *for that hit* (post-cap value), but cannot push effective resist below "no resist" via the cap interaction — it bypasses, it doesn't invert.
- **Resistance reduction** (curses/exposure) lowers the target's resist value itself (can drive it negative), applied before the hit; stacks with penetration.
- **The "−60% all res" map-mod analog:** an area/encounter modifier `playerResAll: -30..-60` — the canonical reason players overcap. Generators authoring area modifiers (§11) should use this band.
- **Monster vs player asymmetry:** monsters have **no 75% cap** and scale resist with area level (often 0–40% normal, with specific high resists or immunities on themed packs); players are hard-capped at 75%. Never give a monster a player-style cap or a player a monster-style uncapped resist.

**(d) Catalog + UE mapping.** Resist attributes live in `UARPGAttributeSet`; the cap and the resist→damage reduction are applied in `ARPGDamageExecution` (§3). Owners: **`status-effects`** for curse/exposure (resist reduction), **`spellbook`** for penetration, **`combat-map`** for the area resist-mod. A penetration/reduction value is inert unless it names the type and goes through the damage execution.

---

## 5. Ailments / Status Effects

**(a) Rule / intent.** Damage types seed **ailments** — secondary effects that out-live the hit. The identity of a status effect **is its granted `State.*` gameplay tag** (canon-aligned with the `status-effects` pipeline). Ailments split into *damaging* (ignite, bleed, poison) and *non-damaging / control* (chill, freeze, shock). Magnitude scales off the hit that applied it.

**(b) Data shape (matches the `status-effects` pipeline `effect` field).** `{ tag: 'State.<Name>', magnitude (per-tick signed; negative = damage), period (s), duration (s), stacking: 'refresh'|'stack'|'highest', maxStacks?, sourceDamageType, dispellable: bool }`.

**(c) The ailments (formulas + envelopes).**
- **Ignite** (Fire DoT): deals **fire damage over time** = a fraction of the triggering hit per second. Envelope: total ignite ≈ 90% of the base hit spread over **4 s** (so ~22%/tick at 0.5 s period, or ~90%/s style — pick one and be consistent). Stacking: **highest** by default (strongest ignite only); refresh on reapply.
- **Chill** (Cold, non-damaging): **slows** action/move speed; magnitude scales with hit-vs-life ratio, capped at **30% slow** (a big chill = 30%, small chill ~5–10%). Duration ~2 s, refreshed by new cold hits.
- **Freeze** (Cold): hard **stun/disable**; only triggers when a cold hit's "freeze value" crosses a fraction of the target's life — a threshold gate, not always-on. Duration scales with overkill of the threshold, capped ~3 s; bosses/uniques have heavy freeze resistance or immunity.
- **Shock** (Lightning, non-damaging): amplifies **damage taken** by the target; magnitude scales with hit-vs-life, capped at **+50% damage taken**. Duration ~2 s, refresh on reapply.
- **Bleed** (Physical DoT): a DoT scaling off the *physical* hit; **moving** amplifies bleed damage. Envelope: ~70% of hit over 5 s; **stacks** to a small cap (e.g. up to 8 stacks, highest-magnitude pool).
- **Poison** (Chaos/Physical DoT): a chaos DoT that **stacks additively** (each application is its own stack, no cap by default); each stack ~20% of the hit over 2 s — the "many small stacks" archetype, opposite to ignite's "highest".

**(d) Stacking / refresh / dispel laws.** Declare exactly one of *refresh* (reset duration), *stack* (independent instances summed), or *highest* (only strongest active). Dispel/cleanse removes the tag and ends the GE; bosses may be immune to control ailments but not to damaging ones.

**(e) Catalog + UE mapping.** Owner: **`status-effects`** (the pipeline's `effect` step). Each ailment → a `GE_Gen_<Name>` (`UGE_Gen_<Name>`) GameplayEffect that **grants `State.<Name>`** and applies the periodic magnitude; packaged into `DT_GeneratedAbilities`. **Wiring law: the granted `State.*` tag IS the status effect's identity** — VFX, AI, and the buff bar all key off the tag, not the source ability.

---

## 6. Monsters / Bestiary

**(a) Rule / intent.** Monsters scale by **area level** (the master scalar, §11) and gain power from **rarity** + rolled **modifiers** — never from hand-tuned stat inflation (canon `game-creature-design`). A pack reads by archetype (tank/skirmisher/caster/boss) with telegraphed, counterable patterns.

**(b) Data shape (extends `BestiaryEntry` / `ArchetypeConfig`).** `{ archetype: 'tank'|'skirmisher'|'caster'|'boss', rarity: 'Normal'|'Magic'|'Rare'|'Unique'|'Boss', monsterLevel (= areaLevel), baseLife, baseDamage, resists, abilities: CatalogLink[] (→ spellbook), modifiers: MonsterMod[], packSize, onDeath?: Effect[], dangerRank, loot: CatalogLink (→ loot-tables) }`.

**(c) Balance envelopes.**
- **Rarity multipliers** (off the Normal baseline for that area level): Normal ×1; **Magic ~×1.5–2 life, +1 modifier**; **Rare ~×4–6 life, +2–4 modifiers**; **Unique** named, ~×6–10 life, fixed modifier set; **Boss** bespoke, multi-phase.
- **Monster modifiers (rolled on Magic/Rare):** *Extra Fast* (+move/attack speed), *Elemental Weakness* (curses the player), *Proximity Shield* (immune until you're in melee), *Extra Life*, *Elemental damage suffix* (adds a damage type), *Necromancer/Summoner*, *Allies Cannot Die*, *Volatile/on-death nova*. Each modifier is a buff/aura GE on the monster.
- **Area-level → monster level:** `monsterLevel = areaLevel` (1:1). Life and damage scale on a **super-linear curve** with monster level (≈ +5–8%/level compounding for life, ≈ +4–6%/level for damage) so a level-80 zone monster dwarfs a level-10 one without bespoke stats.
- **Pack size:** trash packs 4–12; Magic packs add 2–4; a Rare leads a small pack; Bosses solo or with adds.
- **Danger rank** is a derived legibility metric (telegraph clarity + burst potential), not a stat.

**(d) Catalog + UE mapping.** Owner: **`bestiary`** (BP child of `AARPGNPCActor` + one `DT_AttributeDefaults` stat row per canon `char-stat-source`; never a new C++ class per canon `char-config-not-cpp`). Abilities link to **`spellbook`**; loot links to **`loot-tables`**; stats validate against `UARPGAttributeSet`. **Wiring law: a monster modifier IS a GE/aura** granted at spawn, not a description.

---

## 7. Loot Generation

**(a) Rule / intent.** A kill rolls loot in stages: **drop roll** (does an item class drop?) → **rarity roll** (Normal/Magic/Rare/Unique) → **affix roll** (§2) at the dropped item's **ilvl = the monster/area level**. Quantity and rarity scale with **monster rarity × area level** and the player's **magic-find** (IIQ/IIR). The loot table never decides item *quality* directly — it sets weights and ilvl; §1/§2 fill the item.

**(b) Data shape (extends `LootTableEntry` / `EnemyLootBinding`).** `{ source: CatalogLink (→ bestiary/container/quest), itemClassWeights: {weaponPct, armourPct, currencyPct, gemPct…}, rarityWeights: {normal, magic, rare, unique}, ilvl (= source level), uniquePool?: CatalogLink[] (→ items), setPool?: CatalogLink[], pity?: {threshold, guarantee}, smartLoot?: bool }`.

**(c) Balance envelopes.**
- **Drop roll** weighted by monster rarity: a Normal monster has a low base drop chance; **Magic ~×2, Rare ~×4–8, Unique/Boss guaranteed drops + a chance at the named/unique pool.** Bosses pull from a curated unique/set pool.
- **Rarity weights** (per dropped item, before magic-find): Normal ~75%, Magic ~20%, Rare ~4.5%, Unique ~0.5% as a *baseline* — area level and source rarity shift this toward Rare/Unique.
- **Magic-find:** **IIQ** (Increased Item Quantity) multiplies the *number* of drops; **IIR** (Increased Item Rarity) shifts the rarity roll upward. Envelope: player IIR/IIQ stacks into the hundreds of % at endgame; apply as a `more`-style multiplier on the rarity/quantity roll.
- **Smart-loot / pity:** optional bad-luck protection — after `pity.threshold` drops without a Rare+, guarantee one. Smart-loot biases the base-type/affix pool toward the player's class. Use sparingly; default off for a grounded feel (canon `game-tone`).
- **ilvl law:** a dropped item's ilvl **= the monster/area level** that dropped it. This is what makes §11 (area level) drive gear power.

**(d) Catalog + UE mapping.** Owner: **`loot-tables`**. References item **bases** and unique/set pools in **`items`** (CatalogLink); currency drops link to **`currencies`** (§10). Realizes to a loot DataTable + the drop roll in the loot system. **Wiring law: loot references item bases, it never re-authors them** (canon `proj-links`).

---

## 8. Defenses & EHP

**(a) Rule / intent.** Survivability is **layered**, never a single number: an *avoidance* layer (evasion, block, dodge) + a *mitigation* layer (armour, resists) + a *buffer* layer (life / energy-shield / ward) + a *recovery* layer (regen, leech, flask). The intent is **no one-shots below a defined effective-HP (EHP) floor** at a given area level.

**(b) Data shape.** `{ life, energyShield?, ward?, armour, evasion, block%, resists (§4), regenPerSec, leechPct?, recoveryRate }`. EHP is derived, not stored.

**(c) Balance envelopes.**
- **Life** is the base buffer; **Energy Shield** is a rechargeable second pool (recharges after a delay out of damage, big bursty buffer); **Ward** is a per-hit buffer that resets quickly (good vs many small hits, bad vs DoT). A build picks one primary pool.
- **Resists** capped 75% (§4) is assumed *baseline* — EHP math presumes capped resists. Uncapped resists ≈ a failed build, not a balance lever.
- **Armour** uses the soft-cap formula (§3); **block** caps at 75% chance; **evasion** is entropy-smoothed (the displayed % is the real long-run avoid rate).
- **EHP floor:** the biggest single non-boss hit at area level L should deal **< 33% of a capped-resist character's EHP** (no 3-hit-without-counterplay deaths). Boss telegraphed slams may exceed this *only* with a clear, dodgeable tell (canon `game-pillars`).
- **Recovery:** regen ~2–8% life/s on a regen build; leech caps at a %/s rate (instant-leech-to-full is an outlier); flasks are burst recovery on a charge economy.

**(d) Catalog + UE mapping.** All defensive stats are `UARPGAttributeSet` attributes; layering is applied in `ARPGDamageExecution` mitigation order (§3). Owners: **`characters`** (base class defences), **`items`** (defensive affixes §2), **`status-effects`** (guard/fortify buffs). The EHP floor is a `combat-map`/encounter balance check (§11).

---

## 9. Classes, Attributes & Progression

**(a) Rule / intent.** A character is a **class** (starting position + identity) + three **primary attributes** + a **passive tree** of allocated nodes + an **ascendancy** (a chosen specialization) + **active skills** powered by **support** (the skill+support model). Power is allocated over levels — never auto-granted (canon `game-pillars`).

**(b) Data shape (extends `CharacterData` / `CharacterAttributeRow`).** `{ class, strength, dexterity, intelligence, level, xp, passivePointsSpent: NodeId[], ascendancy?: {id, nodes}, skills: {active: CatalogLink (→ spellbook), supports: CatalogLink[]}[] }`.

**(c) Balance envelopes.**
- **Primary attributes (Str/Dex/Int)** each do a thing: **Str** → +life and melee/physical, **Dex** → +accuracy/evasion and attack/projectile, **Int** → +mana/energy-shield and spell. Envelope: every 10 of an attribute grants a small flat (e.g. +5 life per 10 Str). Attributes also gate skill/gem requirements.
- **Passive tree** nodes come in three weights: **small** (a minor numeric, ~+1 attribute or +8–12% of a stat), **notable** (a themed cluster of bonuses or a small unique behavior), **keystone** (a build-defining trade-off — a big upside with a real downside, e.g. "cannot regen life, but…"). One point per node; ~1 point/level + quest grants.
- **Ascendancy** is a small, dense specialization tree (a handful of strong notables + one ascendancy keystone) chosen mid-game — the "what kind of X am I" lever.
- **Skill + support model:** an active skill's behavior is modified by attached **support gems** (or skill ranks) — each support is a `more`/added/keyword modifier (§3), gated by attribute/level. A skill alone is weak; supports are where build power compounds.
- **XP / leveling curve:** XP-to-next grows roughly geometrically (e.g. `xpToNext(L) ≈ base × 1.08^L`), with a soft level cap ~90–100 where each level is a long grind. There is an XP-loss-on-death or diminishing-return penalty band at high levels (a sink, canon `proj-economy` spirit).

**(d) Catalog + UE mapping.** Owners: **`characters`** (class + attributes + tree, BP child of the character/NPC actor per canon `char-config-not-cpp`; stats in `DT_AttributeDefaults` per `char-stat-source`); **`progression-curves`** (the XP curve, point-grant schedule, caps, catch-up). Active skills link to **`spellbook`**; supports are skill modifiers feeding §3. Attributes validate against `UARPGAttributeSet`.

---

## 10. Economy & Crafting

**(a) Rule / intent.** The core ARPG economy is **currency-as-crafting**: currencies aren't just gold — they're consumable **orbs that mutate items** deterministically-ish, each with a defined transformation. This makes the currency sink *be* the crafting system. Layered on top: **vendor recipes** (deterministic outputs from input combos) and a **crafting bench** (deterministic, chosen mods). Every currency declares a sink (canon `proj-economy`).

**(b) Data shape (extends `CurrencyDef` / `CraftRecipe`).** Currency: `{ id, name, kind: 'craft-orb'|'soft'|'premium', effect: ItemMutation, cap?, sinks: string[], faucetPerHour?, sinkPerHour? }`. Crafting recipe: `{ inputs: CatalogLink[] (→ items/currencies), output: ItemMutation|CatalogLink, station?, requiredLevel?, deterministic: bool }`.

**(c) The currency orbs (the mutations — each a deterministic-ish operation on an item).**
- **Transmute orb:** Normal → Magic (rolls 1 affix). *Cheap, common.*
- **Alteration orb:** reroll a Magic item's affixes. *Cheap.*
- **Augment orb:** add one affix to a Magic item that has an open slot.
- **Regal orb:** Magic → Rare (keeps existing mods, adds one). *Uncommon.*
- **Alchemy orb:** Normal → Rare (rolls a full Rare's worth of affixes). *Uncommon.*
- **Chaos orb:** reroll a Rare item's affixes entirely. *The trade baseline currency.*
- **Exalt orb:** add one new affix to a Rare item with an open slot. *Rare, high value — the top-end crafting step.*
- **Divine orb:** reroll the *numeric values* of an item's existing affixes within their ranges (perfect a roll). *Rare.*
- (Optional: **scour** = strip to Normal; **vaal/corrupt** = high-risk irreversible modification.)

**(d) Balance / sink laws.**
- **Rarity = scarcity:** Exalt/Divine are orders of magnitude rarer than Transmute/Alteration; their drop weight (in §7) and vendor cost reflect that. Price/power stays in the 0.8–1.2× canon band (`proj-balance`).
- **Vendor recipes** are deterministic (fixed input set → fixed output, e.g. a full set of one base → a currency shard); a documented sink.
- **Crafting bench** offers **deterministic** chosen mods (you pay currency to apply a *specific* known mod, vs an orb's random roll) — the counterweight to gambling. A bench mod still occupies an affix slot (§2) and can block via `group`.
- **Sinks:** every currency must have ≥1 sink (canon `proj-economy`); faucet vs sink balanced within ±15%. Soft and premium currencies never inter-convert freely (canon `proj-economy`).

**(e) Catalog + UE mapping.** Owners: **`currencies`** (the orb defs + caps + sinks), **`crafting-recipes`** (the deterministic recipes + bench), **`vendors`** (buy/sell/repair + recipes, canon `vendor-laws`). Currency mutations operate on **`items`** (and re-roll their affix GEs from §2). Realizes to `FARPGCurrencyDef` + the crafting/vendor systems. **Wiring law: an orb's effect is an item mutation referencing the affix pool — not a free-form text outcome.**

---

## 11. Endgame & Scaling

**(a) Rule / intent.** The endgame is a ladder of **area/difficulty tiers** (the mapping/rift analog). The single master scalar is **area level**: it drives **monster level** (§6, 1:1) *and* dropped-item **ilvl** (§7). Areas carry rolled **area modifiers** (map mods) that crank difficulty for more reward. Boss progression gates the next tier.

**(b) Data shape (extends `combat-map` / `ArenaSliceSpec`).** `{ areaLevel, tier (1..N), modifiers: AreaMod[], packDensity, bossLink?: CatalogLink (→ bestiary), rewardScalar }`.

**(c) Balance envelopes.**
- **Area level** 1–~85+ (endgame areas cluster at the top, e.g. 80–84+). It is the *only* knob that should change between two copies of the same encounter at different difficulty.
- **Area modifiers** (rolled, stack for risk/reward): `playerResAll: -30..-60` (§4), `monsterDamage: +X%`, `monsterLife: +X%`, *extra-fast monsters*, *added elemental damage*, *players take chaos/area DoT*, *reduced recovery*, *no leech/regen*. Each adds a `rewardScalar` bump (more IIQ/IIR, §7). Modifiers are the area-level analog of monster mods (§6).
- **Reward scaling:** higher area level + heavier mods → higher item ilvl (better affix tiers, §2) + more/rarer drops (§7). Risk and reward scale together; never reward without added risk.
- **Boss progression:** each tier's boss gates the next; bosses are bespoke multi-phase (§6) with telegraphed mechanics (canon `game-pillars`), not stat-inflated trash.

**(d) Catalog + UE mapping.** Owner: **`combat-map`** (the arena/encounter, `ArenaSliceSpec` + spawn/rules graph). Bosses link to **`bestiary`**; rewards flow through **`loot-tables`** (ilvl = areaLevel). Realizes to the encounter map + spawn logic. **Wiring law: area level is the master scalar** — a generated encounter sets *areaLevel*, and monster level + loot ilvl derive from it. Don't hand-tune monster/loot numbers per area; tune the area level + mods.

---

## 12. Wiring Laws (cross-cutting)

These connect the systems so cross-catalog generation is faithful. They are the contract every generated artifact obeys.

**The composable invariants (restating the per-section wiring laws):**
- **An item affix IS a GameplayEffect** (§2) — granted while equipped, modifying a `UARPGAttributeSet` attribute or a tag. Not a tooltip string.
- **A monster modifier IS a GE/aura** (§6) — granted at spawn. Not a description.
- **A status effect's identity IS its granted `State.*` tag** (§5) — VFX/AI/buff-bar key off the tag.
- **Loot references item bases** (§7) via CatalogLink to **`items`** — it never re-authors them.
- **A currency's effect IS an item mutation** (§10) referencing the affix pool (§2) — not free-form text.
- **Ability damage routes through the damage-type → stacking → resist → mitigation pipeline** (§3, §4) — a damage number is meaningless without its type and bucket.
- **Area level is the master scalar** (§11) — monster level (§6) and loot ilvl (§7) derive from it.
- **Schema-down/content-up** (WIRING-AND-ACCEPTANCE §1) — stats validate against `UARPGAttributeSet`, math against `ARPGDamageExecution`; the app never re-authors schema.

**The declaration contract (every generated artifact must declare these four):**

| Field | Meaning | Example |
|-------|---------|---------|
| **Granted by** | what produces/applies it | "equipping the item (an equip GE)"; "the ability's apply-GE"; "spawn aura" |
| **Activated by** | the trigger | "on-equip"; "on-hit"; "on-kill drop roll"; "BeginPlay spawn" |
| **Dependencies** | upstream CatalogLinks it needs | "→ items (base type)"; "→ spellbook (ability)"; "→ currencies" |
| **Verification** | how acceptance proves it (the ladder, WIRING-AND-ACCEPTANCE §2) | "L2: `UGE_*` compiled + seed row present; L3: GE applies and moves the attribute (`VS*Test`, deferred)" |

**The no-gray-box rule (from WIRING-AND-ACCEPTANCE §2):** an artifact that *compiles* but is never *granted/activated* is **not** config-complete. A step's L2 must check it's registered + triggered; its `Verification` line becomes the acceptance `reason`/`detail`. A faithful artifact is wired end-to-end, not an orphaned struct.
