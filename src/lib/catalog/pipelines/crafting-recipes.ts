import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Crafting Recipes pipeline (catalogId: 'crafting-recipes').
 *
 * Represents deterministic bench/vendor recipes that combine one or more
 * input items (+ an optional currency cost) into a specific output item at a
 * designated crafting station, gated by player skill level.  Per ARPG-LAWS §10
 * (Economy & Crafting) and canon rules `arpg-crafting-bench` + `proj-economy`:
 *   - Every recipe is deterministic (fixed inputs → fixed output).
 *   - Gold cost is a documented sink (canon proj-economy).
 *   - A bench mod still occupies an affix slot and respects group-blocking (§2).
 *   - Currency sinks are balanced within ±15% (faucet/sink law).
 *   - Every artifact declares Granted by · Activated by · Dependencies · Verification
 *     (canon arpg-wiring-contract).
 *
 * Wiring: UARPGCraftingComponent on the bench actor reads FARPGRecipeRow from
 * DT_Recipes, validates inputs from UARPGInventoryComponent, subtracts the gold
 * cost via UARPGCurrencySubsystem, and yields the output item to inventory.
 * Input items are consumed (not returned) — the consumption IS the sink.
 */
registerCatalogPipeline({
  catalogId: 'crafting-recipes',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a deterministic bench recipe at the heart of PoF's post-Sundering crafting ` +
            `economy — the player's primary agency over the loot loop beyond raw drops. Combining two ` +
            `gathered reagents (Thornleaf Extract and Ashroot Dust, sourced from the mid-game wilds) ` +
            `with a small gold fee at the Alchemist's Bench, the recipe yields one consumable output ` +
            `that restores 120 Life instantly — the baseline life-recovery option outside flasks. The ` +
            `determinism is intentional: a player who knows this recipe can reliably produce survival ` +
            `consumables rather than hoping for a drop, fitting the "earned, not gifted" pillar ` +
            `(canon game-pillars). The gold cost (20g) is a documented economy sink (canon proj-economy) ` +
            `calibrated so that the crafted output's value — a consumable at ≈24g street price — lands ` +
            `within the 0.8–1.2× price/power ratio band (canon proj-balance). Requires Crafting Skill ` +
            `Level 1 (the entry-level gate), keeping it accessible early. Discovery happens via the ` +
            `starting-area Alchemist NPC interaction (no recipe scroll required at Tier 1). This recipe ` +
            `anchors the consumable-crafting loop and demonstrates the full wiring path: ` +
            `inventory → bench validation → currency deduction → item spawn → HUD notification.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Inputs & Output ────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Inputs & Output',
      view: {
        kind: 'table',
        field: 'io',
        columns: [
          { key: 'inputs' },
          { key: 'output' },
          { key: 'deterministic' },
        ],
      },
      produce: () => ({
        data: {
          io: {
            // Reagent inputs are modeled as descriptive data only — no seeded Weapon ids are
            // wired as reagents.  Thornleaf Extract and Ashroot Dust are Material/reagent
            // items not yet seeded in the items catalog; they are honest deferrals here.
            // When a reagent/material items seed lands, add resolvable links for them.
            inputs: [
              {
                flavorName: 'Thornleaf Extract',
                quantity: 1,
                itemType: 'Material',
                itemSubtype: 'Herb',
                rarity: 'Common',
                note: 'pending a reagent/material items seed',
              },
              {
                flavorName: 'Ashroot Dust',
                quantity: 1,
                itemType: 'Material',
                itemSubtype: 'Powder',
                rarity: 'Common',
                note: 'pending a reagent/material items seed',
              },
            ],
            output: {
              // item-7 = "Minor Health Potion" (Consumable/Potion/Common, seeded heal: 50 HP).
              // The crafted version upgrades the base drop value to 120 HP — a Tier-1 bench
              // quality improvement over the raw loot drop (same item, higher effective output
              // from a quality-infused brew; documented as a crafting-tier upgrade, not a
              // separate item id).
              itemRef: 'items::item-7',
              flavorName: 'Minor Health Potion',
              quantity: 1,
              healAmount: 120,
              baseSeedHealAmount: 50,
              craftingTierNote:
                'item-7 base drop heals 50 HP; bench-crafted batch upgrades to 120 HP ' +
                '(2.4× — Alchemist Bench Tier-1 quality multiplier; the extra potency is ' +
                'the value-add of the crafting loop over raw drops).',
              duration: 'instant',
              note:
                'Output item — item-7 "Minor Health Potion" (Consumable/Potion/Common). ' +
                'Crafted version restores 120 Life instantly (upgraded from 50 HP base drop).',
            },
            deterministic: true,
            deterministicNote:
              'Fixed inputs → fixed output per canon arpg-crafting-bench. ' +
              'No RNG; no affix rolling. The output item type and heal amount are constant. ' +
              'This is the "known crafting" counterweight to the gambling loot loop (§10d).',
            wiringContract: {
              grantedBy:
                'UARPGCraftingComponent on BP_AlchemistBench reads FARPGRecipeRow from ' +
                'DT_Recipes (row key: recipe-health-potion); validates that both input reagents ' +
                'are present in UARPGInventoryComponent with quantity ≥ 1 each',
              activatedBy:
                'Player selects recipe in WBP_CraftingStation and confirms Craft → ' +
                'UARPGCraftingComponent.ExecuteRecipe → inputs consumed from inventory → ' +
                'gold deducted via UARPGCurrencySubsystem → output spawned into inventory',
              dependencies: [
                'items (item-7 Minor Health Potion — resolvable output; reagent inputs pending material items seed)',
                'currencies (currency-gold — 20g cost sink)',
              ],
              verification:
                'L2: FARPGRecipeRow declared in Source/PoF/; seed_recipes.py seeds ' +
                'recipe-health-potion row in DT_Recipes; UARPGCraftingComponent.cpp compiled; ' +
                'L3: VSCraftingTest — inputs consumed and output produced in PIE (deferred)',
            },
            // Resolvable links: only real seeded catalog ids.
            // Weapon ids (item-1 Iron Longsword, item-2 Ranger's Bow) are NOT wired here —
            // they are not reagents.  Reagent items are pending a material items seed.
            links: [
              { catalogId: 'items', entityId: 'item-7', role: 'recipe-output' },
              { catalogId: 'currencies', entityId: 'currency-gold', role: 'craft-cost-sink' },
            ],
          },
          links: [
            { catalogId: 'items', entityId: 'item-7', role: 'recipe-output' },
            { catalogId: 'currencies', entityId: 'currency-gold', role: 'craft-cost-sink' },
          ],
        },
        links: [
          { catalogId: 'items', entityId: 'item-7', role: 'recipe-output' },
          { catalogId: 'currencies', entityId: 'currency-gold', role: 'craft-cost-sink' },
        ],
        ueAssets: ['/Game/Crafting/DT_Recipes'],
      }),
      accept: fieldsPopulated('io', 'inputs / output / deterministic populated', [
        'inputs',
        'output',
        'deterministic',
      ]),
      staticChecks: (e) => [
        cppSymbolExists('FARPGRecipeRow', 'Recipe row struct in UE Source'),
        seedRowPresent('seed_recipes.py', slug(e.name), 'Recipe row seeded for this entity'),
      ],
    },

    // ── 3. Station & Skill ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Station & Skill',
      view: {
        kind: 'table',
        field: 'stationSkill',
        columns: [{ key: 'station' }, { key: 'skillLevel' }, { key: 'gating' }],
      },
      produce: () => ({
        data: {
          stationSkill: {
            station: 'BP_AlchemistBench',
            stationDisplayName: "Alchemist's Bench",
            stationUEClass: 'AARPGInteractable',
            stationNote:
              "A stationary interactive actor placed in the Ashen Order's starting-area hub. " +
              'Only Alchemist Benches can execute alchemy-class recipes (type: `alchemist`). ' +
              'A portable version (Camping Kit blueprint) is scoped for a later recipe tier.',
            // canon arpg-crafting-bench: bench recipes are deterministic + station-gated
            skillLevel: 1,
            skillAttribute: 'CraftingSkill',
            skillAttributeSource: 'UARPGAttributeSet',
            skillNote:
              'CraftingSkill ≥ 1 required (the entry gate — every new character starts at 0; ' +
              'awarded on first interaction with any Alchemist NPC in the starting area). ' +
              'Each skill tier unlocks a recipe group: Tier 1 (1–10) = basic consumables; ' +
              'Tier 2 (11–20) = elemental variants; Tier 3 (21–30) = Greater potions. ' +
              'Skill advance is a passive-tree allocation, not a level-up gift (canon game-pillars).',
            gating: {
              stationType: 'alchemist',
              minCraftingSkill: 1,
              missingStationResponse: 'WBP_CraftingStation shows disabled Craft button + tooltip "Alchemist\'s Bench required"',
              missingSkillResponse: 'Craft button disabled + tooltip "Crafting Skill 1 required"',
            },
            wiringContract: {
              grantedBy:
                'UARPGCraftingComponent reads stationType from FARPGRecipeRow.stationType and ' +
                'CraftingSkill from UARPGAttributeSet; validates both before enabling ExecuteRecipe',
              activatedBy:
                'Player opens WBP_CraftingStation at the bench → ' +
                'UARPGCraftingComponent.CanCraft(recipeId, playerAttributeSet) → ' +
                'returns true only when stationType matches AND CraftingSkill ≥ minCraftingSkill',
              dependencies: [
                'characters (CraftingSkill attribute in UARPGAttributeSet)',
                'UE: BP_AlchemistBench placed in the hub level (deferred — level design)',
              ],
              verification:
                'L2: UARPGAttributeSet declares CraftingSkill; UARPGCraftingComponent.CanCraft compiled; ' +
                'L3: VSCraftingTest — craft fails without bench or with skill 0; succeeds at bench + skill ≥ 1',
            },
          },
        },
      }),
      accept: fieldsPopulated('stationSkill', 'station + skillLevel + gating defined', [
        'station',
        'skillLevel',
        'gating',
      ]),
      staticChecks: () => [
        cppSymbolExists('UARPGCraftingComponent', 'Crafting component in UE Source'),
      ],
    },

    // ── 4. Cost & Yield ───────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Cost & Yield',
      view: {
        kind: 'table',
        field: 'costYield',
        columns: [{ key: 'goldCost' }, { key: 'outputValue' }, { key: 'ratio' }],
      },
      produce: () => {
        // Self-consistent derivation (ARPG-LAWS §10d + canon proj-balance + proj-economy):
        //   Gold cost: 20g (documented sink — consumed on craft, never returned).
        //   Output value: a consumable that heals 120 Life.
        //   Reference price for Minor Health Potion (50 HP heal): ~12g street vendor.
        //   120 HP heal = ~2.4× a Minor Potion's heal amount → output value ≈ 12g × 2.4 = 28.8g.
        //   Round to 24g (conservative estimate, sold by vendor at buyback 50% = 12g).
        //   Total crafting cost: 20g (gold) + ingredient opportunity cost (≈4g for 2 Common/Uncommon items).
        //   Effective total cost: ~24g.
        //   Price/power ratio = costTotal / outputValue = 24 / 24 = 1.0 — squarely in the 0.8–1.2× band.
        //   Gold-cost-to-output-value ratio = 20 / 24 = 0.833 — within ±20% of the 0.8–1.2 target midpoint.
        //   costRatio is the withinPercent field: goldCost / outputValue ≈ 0.83 → check ±20% of 0.8 = 0.64–0.96.
        const goldCost = 20;
        const outputValue = 24;
        const costRatio = +(goldCost / outputValue).toFixed(3); // 0.833
        return {
          data: {
            costYield: {
              goldCost,
              outputValue,
              costRatio,
              ingredientOpportunityCost: 4,
              totalCraftCost: goldCost + 4, // 24g
              healAmount: 120,
              simNotes:
                'Derivation: goldCost(20g) + ingredient-opportunity-cost(4g) = totalCraftCost(24g). ' +
                'Output value = 24g (reference: Minor Potion 12g at 50 HP heal → 120 HP = 2.4× → 28.8g; ' +
                'discounted to 24g = vendor sell price at 50% buyback floor per vendor-laws). ' +
                'Price/power ratio = 24/24 = 1.0× — within the canon 0.8–1.2× band (proj-balance). ' +
                'goldCost/outputValue = 20/24 = 0.833 — within ±20% of target 0.8 (band: 0.64–0.96). ' +
                'Gold cost is the sole documented sink per proj-economy; ingredient consumption is a ' +
                'separate item sink. Faucet (potion drops at ~3g drop value per kill session) vs ' +
                'sink (20g craft fee) net-negative on gold per potion — a healthy drain on the soft currency.',
              wiringContract: {
                grantedBy:
                  'UARPGCraftingComponent.ExecuteRecipe deducts goldCost via ' +
                  'UARPGCurrencySubsystem.Transact(playerID, 20, currency-gold) before ' +
                  'spawning the output item; transaction is atomic (fails if gold < 20g)',
                activatedBy:
                  'Player confirms Craft in WBP_CraftingStation → ' +
                  'UARPGCraftingComponent checks UARPGCurrencySubsystem.GetBalance ≥ goldCost → ' +
                  'deducts gold → consumes inputs → spawns output',
                dependencies: ['currencies (currency-gold in DT_Currencies — 20g deduction)'],
                verification:
                  'L2: UARPGCurrencySubsystem.Transact compiled; DT_Currencies has currency-gold row; ' +
                  'L3: VSCraftingTest — wallet decremented by 20g on successful craft in PIE',
              },
              links: [
                { catalogId: 'currencies', entityId: 'currency-gold', role: 'craft-cost-sink' },
              ],
            },
            // top-level field for withinPercent checker
            costRatio,
            links: [
              { catalogId: 'currencies', entityId: 'currency-gold', role: 'craft-cost-sink' },
            ],
          },
          links: [
            { catalogId: 'currencies', entityId: 'currency-gold', role: 'craft-cost-sink' },
          ],
          ueAssets: ['/Game/Economy/DT_Currencies'],
        };
      },
      accept: withinPercent(
        'costRatio',
        'Gold-cost / output-value ratio within ±20% of target 0.8',
        0.8,
        20,
      ),
      staticChecks: () => [
        cppSymbolExists('UARPGCurrencySubsystem', 'Currency subsystem in UE Source'),
      ],
    },

    // ── 5. Discovery / Unlock ─────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Discovery / Unlock',
      view: {
        kind: 'table',
        field: 'discovery',
        columns: [{ key: 'method' }, { key: 'trigger' }, { key: 'persistenceTag' }],
      },
      produce: () => ({
        data: {
          discovery: {
            method: 'npc_interaction',
            trigger: 'First TalkTo interaction with any Alchemist NPC in the starting-area hub',
            displayName: 'Taught by Alchemist NPC',
            // No recipe scroll required at Tier 1 — knowledge is granted via a gameplay event
            grantedVia: 'FGameplayEventData (EventTag: Crafting.RecipeUnlocked.HealthPotion)',
            persistenceTag: 'Crafting.KnownRecipe.HealthPotion',
            persistenceNote:
              'The tag is applied to the player GAS AbilitySystemComponent (ASC) on first grant; ' +
              're-interaction does not re-grant (idempotent guard via HasMatchingGameplayTag). ' +
              'The WBP_CraftingStation recipe list is filtered by KnownRecipe.* tags so ' +
              'undiscovered recipes are hidden (not just locked) per the grounded-tone canon.',
            tier2Unlock: {
              method: 'recipe_scroll',
              item: 'T1_RecipeScroll_HealthPotion (Uncommon consumable — pending items seed)',
              note: 'Tier-2 variant (Greater Health Potion, 240 HP, Crafting Skill 11) uses a scroll drop',
            },
            wiringContract: {
              grantedBy:
                'AARPGNPCActor (Alchemist archetype) TalkTo flow broadcasts ' +
                'FGameplayEventData(EventTag: Crafting.RecipeUnlocked.HealthPotion) to ' +
                'the player ASC; a GameplayAbility listens and grants the KnownRecipe tag',
              activatedBy:
                'Player TalkTo NPC → dialog branch "Teach me to brew" → ' +
                'BP_AlchemistNPC broadcasts recipe-unlock event → GA_GrantRecipe applies tag',
              dependencies: [
                'characters (player ASC for the KnownRecipe tag)',
                'UE: BP_AlchemistNPC placed in starting hub (level design — deferred)',
              ],
              verification:
                'L2: GA_GrantRecipe + Crafting.KnownRecipe.HealthPotion tag declared in GameplayTags.ini; ' +
                'L3: VSCraftingTest — recipe appears in WBP_CraftingStation after TalkTo in PIE',
            },
          },
        },
      }),
      accept: fieldsPopulated('discovery', 'method + trigger + persistenceTag defined', [
        'method',
        'trigger',
        'persistenceTag',
      ]),
    },

    // ── 6. Craft FX / Audio ───────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Craft FX / Audio',
      view: {
        kind: 'table',
        field: 'craftFx',
        columns: [{ key: 'vfx' }, { key: 'sfxLoop' }, { key: 'sfxSuccess' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          craftFx: {
            // canon art-vfx: Niagara, restrained, keyed to anim notifies, within budget
            vfx: {
              asset: `NS_Craft_${slug(e.name)}`,
              description:
                'A contained Niagara bubbling-cauldron effect on the bench surface: ' +
                'warm amber particles (matching the health-restoration color language), ' +
                'capped at 80 GPU particles at peak — well within the per-class ~0.48 ms budget. ' +
                'Fires from the AnimNotify on the bench crafting animation at the "pour" frame; ' +
                'NOT on BeginPlay or a timer (per canon vfx-budget). LODs: full / 50% / culled at 15m.',
              lodTiers: 3,
              peakParticles: 80,
              trigger: 'AnimNotify (AN_CraftBrew_Pour)',
              colorFamily: 'amber-warm',
            },
            sfxLoop: {
              asset: `SC_Craft_${slug(e.name)}_Loop`,
              description:
                'A low bubbling/simmering loop (1.2 s looping SoundCue, SC_Craft_HealthPotion_Loop) ' +
                'that plays for the duration of the crafting animation (~2.8 s). Attenuated at 6 m. ' +
                'Restrained — not melodic; a working-kitchen sound, not a UI fanfare.',
            },
            sfxSuccess: {
              asset: `SC_Craft_${slug(e.name)}_Success`,
              description:
                'A short positive chime/pour-complete stinger (SC_Craft_HealthPotion_Success, ~0.6 s). ' +
                'Keyed to the AnimNotify AN_CraftBrew_Complete at end of the anim. ' +
                'Consistent with the grounded tone (canon game-tone): a satisfying but subtle clink, ' +
                'not a triumphant fanfare.',
            },
            wiringContract: {
              grantedBy:
                'BP_AlchemistBench Animation Blueprint fires AnimNotifies: ' +
                'AN_CraftBrew_Pour (spawns NS_ + starts SC_ loop) → ' +
                'AN_CraftBrew_Complete (stops loop + plays SC_ success); ' +
                'Niagara fired via UNiagaraComponent attached to the bench mesh',
              activatedBy:
                'UARPGCraftingComponent.ExecuteRecipe → ' +
                'plays crafting montage → AnimNotifies fire in sequence',
              dependencies: [
                'UE: BP_AlchemistBench AnimBlueprint + montage (deferred — animation pipeline)',
              ],
              verification:
                'L2: NS_ asset path referenced in FARPGRecipeRow.craftVFX; SC_ paths in craftSFX; ' +
                'L4: visual smoke-test — amber particles visible + loop+success sounds audible on craft (deferred)',
            },
          },
        },
        ueAssets: [
          `/Game/VFX/Crafting/NS_Craft_${slug(e.name)}`,
          `/Game/Audio/Crafting/SC_Craft_${slug(e.name)}_Loop`,
          `/Game/Audio/Crafting/SC_Craft_${slug(e.name)}_Success`,
        ],
      }),
      accept: fieldsPopulated('craftFx', 'vfx + sfxLoop + sfxSuccess defined', [
        'vfx',
        'sfxLoop',
        'sfxSuccess',
      ]),
    },

    // ── 7. Recipe UI ──────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Recipe UI',
      view: {
        kind: 'table',
        field: 'recipeUi',
        columns: [{ key: 'widget' }, { key: 'displayFormat' }, { key: 'hudAnchor' }],
      },
      produce: () => ({
        data: {
          recipeUi: {
            // canon proj-hud-binding: widget + display-format + HUD anchor declared
            widget: 'WBP_CraftingStation',
            displayFormat:
              '{recipeName} — {inputs[0].flavorName} × {inputs[0].quantity} + ' +
              '{inputs[1].flavorName} × {inputs[1].quantity} + {goldCost}g → {output.flavorName}',
            hudAnchor: 'center_screen',
            layout: 'grid_2col_inputs_arrow_output',
            currencyDisplay: 'currency-gold shown as gold-coin icon + numeric cost',
            skillGateDisplay:
              'Craft button text changes to "Skill Required (1)" when CraftingSkill < 1; ' +
              'tooltip explains the skill requirement (no silent disable)',
            filterBy: 'Crafting.KnownRecipe.* tags on player ASC (unknown recipes hidden, not greyed)',
            outputPreview:
              'Hovering the output slot shows the heal amount (120 HP) + item name + rarity frame ' +
              '— standard item tooltip from WBP_ItemTooltip.',
            wiringContract: {
              grantedBy:
                'WBP_CraftingStation is opened by UARPGCraftingComponent when the player ' +
                'interacts with BP_AlchemistBench; it reads known recipes from the player ASC ' +
                '(KnownRecipe.* tags) and populates the grid from DT_Recipes matching stationType=alchemist',
              activatedBy:
                'Player interacts (E / Square) with BP_AlchemistBench → ' +
                'UARPGCraftingComponent.OpenCraftingUI → pushes WBP_CraftingStation to the HUD',
              dependencies: [
                'proj-hud-binding (WBP_CraftingStation widget registered to the HUD)',
                'characters (player ASC KnownRecipe.* tags)',
              ],
              verification:
                'L2: WBP_CraftingStation widget exists in Content/UI/Crafting/; ' +
                'L3: VSCraftingTest — WBP_CraftingStation opens at bench interaction and shows ' +
                'recipe-health-potion in the list after discovery in PIE',
            },
          },
        },
      }),
      accept: fieldsPopulated('recipeUi', 'widget + displayFormat + hudAnchor defined', [
        'widget',
        'displayFormat',
        'hudAnchor',
      ]),
    },

    // ── 8. Icon 2D Art ────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
        ],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A recipe icon is selected'),
    },

    // ── 9. Localization ───────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: () => ({
        data: {
          keys: [
            'RECIPE_HEALTH_POTION_NAME',
            'RECIPE_HEALTH_POTION_DESCRIPTION',
            'RECIPE_HEALTH_POTION_INPUT_1',
            'RECIPE_HEALTH_POTION_INPUT_2',
            'RECIPE_HEALTH_POTION_OUTPUT',
            'RECIPE_HEALTH_POTION_STATION_REQUIRED',
            'RECIPE_HEALTH_POTION_SKILL_REQUIRED',
            'RECIPE_HEALTH_POTION_UNLOCK_HINT',
          ],
        },
      }),
      accept: minCount('keys', '≥1 localization key defined', 1),
    },

    // ── 10. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'inputs consumed on successful craft (Thornleaf Extract and Ashroot Dust removed from inventory)',
            'output produced in inventory (item-7 / Minor Health Potion added, 120 HP heal)',
            'gold deducted by 20g on successful craft',
            'craft fails when gold balance < 20g (atomic rollback)',
            'craft fails when inputs missing (no partial consumption)',
            'craft fails when CraftingSkill < 1',
            'craft fails at wrong station type (non-alchemist bench)',
            'recipe not visible in WBP_CraftingStation before discovery (KnownRecipe tag absent)',
            'recipe visible after Alchemist NPC TalkTo grants KnownRecipe.HealthPotion tag',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSCraftingTest',
        'Inputs consumed → output produced in PIE',
      ),
    },

    // ── 11. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_Recipes :: ${s}`,
          `T_${s}_Icon`,
          'WBP_CraftingStation',
          `NS_Craft_${s}`,
          `SC_Craft_${s}_Loop`,
          `SC_Craft_${s}_Success`,
          `DT_Currencies :: currency-gold`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'UARPGCraftingComponent (attached to BP_AlchemistBench, AARPGInteractable) ' +
                'reads FARPGRecipeRow from DT_Recipes keyed by entity slug; ' +
                'currency sink via UARPGCurrencySubsystem reading DT_Currencies (currency-gold); ' +
                'output item spawned via UARPGInventoryComponent.AddItem',
              activatedBy:
                'Player interacts with BP_AlchemistBench → WBP_CraftingStation opens → ' +
                'recipe selected + Craft confirmed → UARPGCraftingComponent.ExecuteRecipe: ' +
                '(1) CanCraft check (skill + station + gold + inputs) → ' +
                '(2) RemoveItems(input-1, input-2) → ' +
                '(3) CurrencySubsystem.Transact(-20g) → ' +
                '(4) AddItem(output) → ' +
                '(5) fire AnimNotify chain (VFX + SFX)',
              dependencies: [
                'items (item-7 Minor Health Potion output — in DT_Items; reagent inputs pending material items seed)',
                'currencies (currency-gold in DT_Currencies — 20g sink)',
                'characters (CraftingSkill attribute in UARPGAttributeSet)',
                'proj-hud-binding (WBP_CraftingStation registered to HUD)',
              ],
              verification:
                'L2: FARPGRecipeRow in Source/PoF/; seed_recipes.py seeds entity slug row in DT_Recipes; ' +
                'UARPGCraftingComponent.cpp + UARPGCurrencySubsystem.cpp compiled; ' +
                'WBP_CraftingStation exists in Content/UI/Crafting/; ' +
                'L3: VSCraftingTest — full craft cycle (inputs consumed → output produced → gold deducted) in PIE',
            },
          },
          links: [
            { catalogId: 'currencies', entityId: 'currency-gold', role: 'craft-cost-sink' },
          ],
          ueAssets: assets.map((a) => `/Game/Crafting/${a}`),
        };
      },
      accept: minCount('assets', '≥2 UE assets packaged', 2),
      staticChecks: (e) => [
        cppSymbolExists('UARPGCraftingComponent', 'Crafting component in Source/'),
        cppSymbolExists('FARPGRecipeRow', 'Recipe row struct in Source/'),
        seedRowPresent('seed_recipes.py', slug(e.name), 'Recipe row seeded in Content/Python'),
      ],
    },
  ],
});
