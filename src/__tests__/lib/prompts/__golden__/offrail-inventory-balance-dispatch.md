## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:\proj\PoF\PoF.uproject" -WaitMutex

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.

## Known UE Pitfalls
- **a code-only UUserWidget builds its Slate tree in RebuildWidget(), not NativeConstruct()** — A C++-only UUserWidget with no UMG asset must construct its widget hierarchy by overriding RebuildWidget(); NativeConstruct() runs too late and the tree is empty. BindWidget members still require a WBP. (vertical-slice: HUD)
- **AddOnScreenDebugMessage debug text draws over UMG and pins to the top-left** — GEngine->AddOnScreenDebugMessage prints above all UMG and pins to the top-left corner, colliding with anything placed there and confounding screenshot/vision HUD checks. Either offset HUD elements down (the slice put the player health bar at y=90) or disable it in dev with the DisableAllScreenMessages console command. (vertical-slice: HUD)
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)
- **Pick failure severity by consequence: cosmetic load failures warn-and-continue; gameplay-invariant violations hard-fail — and never fabricate the missing object to keep running** — When generated code handles a failed load or lookup, choose severity by what the failure breaks, not by habit. A COSMETIC asset that fails (a mesh, VFX, audio cue) should log a warning and continue — stopping everyone because pretty_tree_03 didn't load is wrong. A GAMEPLAY-INVARIANT violation must hard-fail fast (check(), UE_LOG Fatal, or ensure + early-return): the classic case is a locked door/gate actor failing to spawn — the dungeon behind it assumes quest state that 'cannot' be missing, so warn-and-continue surfaces days later as an inexplicable bug in unrelated code, downstream of the real cause. And never 'fix' a failure by fabricating the missing state (constructing an empty list/table/object so execution can proceed) — that converts a loud caller bug into silent corruption. (research: T. Cain code standards (WildStar/Outer Worlds notes))

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

## Known Project Assets (use these EXACT paths — do not invent paths)
- **/Script/PoF.ARPGItemDefinition** (C++ Class (UARPGItemDefinition), project) — Base data-asset class for items — author instances under /Game/Items/.

## Domain Context
You are helping implement game logic systems including state machines, scoring, and win/lose conditions in UE5 C++ for an action RPG. Focus on inventory data structures, item data assets, equipment slots, and stack management.

## Task
You are an expert ARPG item economy balance advisor. Analyze the following item catalog data and produce a structured balance report.

## Item Catalog (2 items)
[
  {
    "name": "Iron Longsword",
    "type": "Weapon",
    "subtype": "Sword",
    "rarity": "Common",
    "stats": "Damage: 12-18, Speed: 1.2s",
    "affixes": "none",
    "effect": "none"
  },
  {
    "name": "Ranger's Bow",
    "type": "Weapon",
    "subtype": "Bow",
    "rarity": "Uncommon",
    "stats": "Damage: 15-22, Range: 25m",
    "affixes": "of Precision (+3% Crit Chance, offensive)",
    "effect": "none"
  }
]

## Affix Pool
[
  {
    "name": "of Power",
    "modifier": "+15% Atk Power",
    "tier": "Prefix",
    "rarity": "Uncommon"
  },
  {
    "name": "of Fortitude",
    "modifier": "+200 Max HP",
    "tier": "Prefix",
    "rarity": "Rare"
  },
  {
    "name": "Blazing",
    "modifier": "+Fire Damage",
    "tier": "Suffix",
    "rarity": "Rare"
  },
  {
    "name": "Vampiric",
    "modifier": "+8% Life Steal",
    "tier": "Prefix",
    "rarity": "Epic"
  },
  {
    "name": "of Legends",
    "modifier": "+2 All Skills",
    "tier": "Suffix",
    "rarity": "Legendary"
  }
]

## Item Level Scaling Curves
[
  {
    "curve": "Weapon Damage",
    "range": "Level 5-50",
    "minAtStart": "12.8",
    "maxAtEnd": "120.7"
  },
  {
    "curve": "Armor Defense",
    "range": "Level 5-50",
    "minAtStart": "15.8",
    "maxAtEnd": "93.5"
  },
  {
    "curve": "Affix Magnitude",
    "range": "Level 5-50",
    "minAtStart": "4.8",
    "maxAtEnd": "50.4"
  }
]

## Rarity Distribution (Expected vs Actual at Level 14)
[
  {
    "rarity": "Common",
    "expected": "40%",
    "actual": "55%"
  },
  {
    "rarity": "Uncommon",
    "expected": "30%",
    "actual": "25%"
  },
  {
    "rarity": "Rare",
    "expected": "20%",
    "actual": "15%"
  },
  {
    "rarity": "Epic",
    "expected": "8%",
    "actual": "5%"
  },
  {
    "rarity": "Legendary",
    "expected": "2%",
    "actual": "0%"
  }
]

## Set Bonuses
[
  {
    "name": "Warrior's Resolve",
    "pieces": 3,
    "bonuses": "2pc: +10% Armor, 3pc: +25% Max HP"
  },
  {
    "name": "Arcane Scholar",
    "pieces": 2,
    "bonuses": "2pc: +20% Mana"
  },
  {
    "name": "Mandalorian Arsenal",
    "pieces": 4,
    "bonuses": "2pc: +10% Armor Penetration, 3pc: +15% Physical Damage, 4pc: Beskar Resilience: -25% incoming damage"
  },
  {
    "name": "Shadow Walker",
    "pieces": 4,
    "bonuses": "2pc: +10% Stealth Damage, 3pc: +20% Critical Chance, 4pc: Shadow Step: teleport behind target on crit"
  },
  {
    "name": "Force Master Regalia",
    "pieces": 3,
    "bonuses": "2pc: +25% Force Regen, 3pc: All Force abilities cost 0 for 5s after a kill"
  },
  {
    "name": "Echani Duelist",
    "pieces": 3,
    "bonuses": "2pc: +8% Attack Speed, 3pc: Echani Flow: each consecutive hit +3% damage"
  }
]

## Effective DPS by Item
[
  {
    "name": "Iron Longsword",
    "rarity": "Common",
    "slot": "MainHand",
    "effectiveDPS": "31.5"
  },
  {
    "name": "Void Daggers",
    "rarity": "Legendary",
    "slot": "MainHand",
    "effectiveDPS": "134.5"
  },
  {
    "name": "Crystal Staff",
    "rarity": "Rare",
    "slot": "MainHand",
    "effectiveDPS": "56.2"
  }
]

---

Evaluate the item economy balance by checking:
1. **Power Budget per Rarity Tier**
2. **Affix Magnitude vs Item Level Curves**
3. **DPS Outliers**
4. **Set Bonus Power vs Individual Items**
5. **Rarity Distribution Health**

Return your analysis as a structured report with:
- An overall balance score (0-100)
- A list of specific balance warnings (severity: low/medium/high/critical)
- Suggested tuning values for each warning
- A brief summary paragraph