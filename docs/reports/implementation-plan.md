# POF x Unreal ARPG: Implementation Plan

**Target:** `C:\Users\kazda\kiro\pof` (POF codebase)
**Unreal Project:** `C:\Users\kazda\Documents\Unreal Projects\PoF`
**Date:** 2026-04-05

---

## Recovered Requirements (from conversation history)

### Phase 1: Game Content Population
Populate existing POF modules with Star Wars KOTOR ARPG game data.

**1A. Character & Movement** (`arpg-character`)
- [x] 10 character archetypes (Jedi Guardian/Sentinel/Consular, Sith Warrior/Inquisitor, Bounty Hunter, Smuggler, Trooper, Mandalorian, Force Sensitive)
- [x] Movement mechanics: Sprint, Dodge Roll, Force Dash, Jetpack, Cover Snap, Wall Run, Double Jump
- [x] Full stat blocks: health, stamina, forcePower, armor, speed, critChance
- [x] Input bindings: skills 1-6, Q/R/F, LMB, RMB
- [x] Archetype cross-comparison simulator

**1B. Animation System** (`arpg-animation`)
- [x] State machines for 3+ archetypes (~17 states, ~17 transitions each)
- [x] Blend trees (locomotion, combat stance)
- [x] 6 montages per archetype (Light Combo, Heavy Strike, Dodge Counter, Ability Cast, Death Sequence, Recovery)
- [x] Scalable state graph UI (grouped states + focused transition view, NOT full canvas)

**1C. Ability System** (`arpg-gas`)
- [x] 10 base abilities: Force Push, Pull, Lightning, Lightsaber Throw, Force Heal, Saber Flurry, Deflect, Mind Trick, Force Speed, Wrist Rocket
- [x] 10 KOTOR Force powers: Force Valor, Wave, Storm, Plague, Breach, Death Field, Battle Meditation, Immunity, Body, Crush
- [x] 5 ranks per ability with scaling stats
- [x] Upgrade choices at rank 3 and 5
- [x] Archetype compatibility matrix
- [x] Scalable ability selector (search, filters, pagination for 100+ abilities)

**1D. Combat System** (`arpg-combat`)
- [x] 6 combo chains (Basic, Launcher, Ability Weave, Counter, Riposte, Aerial)
- [x] 10 original weapon types + 10 KOTOR melee weapons:
  - Vibroblade, Vibrosword, Double-Bladed Vibrosword, Stun Baton, Gaderffii Stick, Gamorrean Battleaxe, Echani Foil, Bacca's Ceremonial Blade, Sith Tremor Sword, Ajunta Pall's Blade
- [x] Damage formula with Strength/Dexterity/Constitution influence
- [x] Hit zones: Head 1.5x, Body 1.0x, Limbs 0.75x
- [x] Stat influence panel with DPS comparison across all weapons

**1E. Enemy AI** (`arpg-enemy-ai`)
- [x] 10 base enemies: Stormtrooper, Scout Trooper, Dark Trooper, Probe Droid, Trandoshan Hunter, Tusken Raider, Rancor (boss), Sith Acolyte, BH-7 Droid, Grand Inquisitor (boss)
- [x] 10 KOTOR enemies: Rakghoul, Kinrath, Kath Hound, Mandalorian Warrior, Sith Assassin, Terentatek (boss), War Droid, Wookiee Berserker, Hssiss, Darth Malak (boss)
- [x] Behavior trees with patrol/detect/engage/special/flee phases
- [x] Weakness/resistance matrix across 6 damage types
- [x] Scalable type selector for dozens of enemy types

**1F. Items & Inventory** (`arpg-inventory`)
- [x] 22+ items: 10 weapons, 5 armor, 3 accessories, 4 consumables
- [x] 6 rarity tiers (Common through Artifact)
- [x] Same-type comparison selector (compare weapons vs weapons, armor vs armor)
- [x] Bonus stat system

**1G. Loot & Drops** (`arpg-loot`)
- [x] 10 loot tables: enemy drops, boss drops, world drops, containers
- [x] Monte Carlo simulator
- [x] Dynamic character/item name resolution (not hardcoded IDs)

**1H. UI & HUD** (`arpg-ui`)
- [x] ARPG HUD redesign (Diablo/PoE style): health/force globes, 8-slot skill bar, stamina arc, XP bar, circular minimap
- [x] 15 screen nodes, 27 transitions
- [x] 12+ HUD elements

**1I. Progression** (`arpg-progression`)
- [x] XP curve: 100 * level^1.8 for 50 levels
- [x] 19 level milestones with stat/ability points
- [x] 5 zone difficulty ratings
- [x] Stat allocation simulator with archetype base stats

**1J. World & Levels** (`arpg-world`)
- [x] 5 zones: Tatooine, Nar Shaddaa, Kashyyyk, Korriban, Malachor V
- [x] Open world graph (multi-path connections, not linear)
- [x] Route metadata: required level, travel time, hidden routes
- [x] Level/enemy filters highlighting matching zones

**1K. Save & Load** (`arpg-save`)
- [x] Save schema v1: 7 sections, 50+ nested fields
- [x] 5 save slots
- [x] Size estimates

### Phase 2: Entity Selectors & Scaling
Every module needs proper selectors so it handles growing data:

- [x] Character: Compare mode (2 characters side-by-side)
- [x] Animation: Coverage badge + missing archetypes list
- [x] Ability: Archetype focus filter + damage type filter
- [x] Combat: Clickable weapon detail + combo links
- [x] Bestiary: Search + multi-filter (tier/faction/zone)
- [x] Items: Same-type comparison panel
- [x] Loot: Enemy name resolution + item detail on click
- [x] Progression: Archetype selector for stat simulation
- [x] Zone: Level range + enemy type filters

### Phase 3: Feature Map System
- [ ] Features tab as FIRST tab in every module with toggleable section matrix
- [ ] Unified tab switcher using POF's existing SubTabNavigation from `_shared.tsx`
- [ ] Matrix columns = tab names, rows = sections within tabs
- [ ] Toggle on/off hides sections from UI
- [ ] Persistent to localStorage
- [ ] All modules should have proper tab separation (especially Loot, Progression, ZoneMap, SaveSchema)

### Phase 4: Playwright Tests
- [ ] Navigation: Project launcher → Core Engine sidebar → module → Blueprint tab
- [ ] Per-module: sidebar visibility, content loading, tab availability
- [ ] Section toggle tests via feature matrix

### Phase 5: Process Documentation
- [ ] Dev report per module in docs/reports/dev_report.md
- [ ] Repeatable process documentation

---

## Execution Plan

### Pre-work: Understand POF Architecture
- POF uses `_shared.tsx` SubTabNavigation for tab switching
- Module registry at `src/lib/module-registry.ts`
- Feature definitions at `src/lib/feature-definitions.ts`
- Unique tabs registered in `src/components/modules/core-engine/unique-tabs/index.tsx`
- Existing shared design system in `_design.tsx` and `_shared.tsx`
- Data goes in `data.ts` files per module (with optional UE5 live sync)

### Execution Waves

**Wave 1: Seed Data** (Phase 1 — game content)
Add/extend data.ts files in existing unique-tabs with KOTOR content.
Modules: All 11 core-engine modules.
No new components — just data enrichment into existing structures.

**Wave 2: Selectors & Scaling** (Phase 2)
Add search, filters, comparison panels to existing views.
Work WITH existing `_shared.tsx` components (SubTabNavigation, FeatureGrid, CollapsibleSection).

**Wave 3: Feature Map** (Phase 3)
Build feature matrix as a new shared component.
Integrate with existing ReviewableModuleView tab system.
Add "Features" as a new ExtraTab in unique-tabs/index.tsx.

**Wave 4: Tests + Report** (Phase 4-5)
Playwright tests targeting actual POF navigation.
Dev report documentation.
