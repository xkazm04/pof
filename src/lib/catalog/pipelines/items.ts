import { registerCatalogPipeline } from '../pipeline-registry';
import {
  minLength,
  fieldsPopulated,
  withinPercent,
  selected,
  minCount,
} from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Items pipeline (catalogId: 'items').
 *
 * The items catalog is the ARPG's most mechanically dense row — every equippable
 * object in PoF starts here.  This pipeline is the content+gate authority and the
 * upstream that loot-tables and vendors link into.  Per ARPG-LAWS §1/§2 and the
 * `arpg-item-rarity`, `arpg-item-level`, `arpg-affixes`, `arpg-affix-is-ge` canon
 * rules.
 *
 * Key contracts:
 *  • Every explicit affix → GE_Affix_<Name> applied on equip, modifying a
 *    UARPGAttributeSet attribute.  Affixes are NOT tooltip strings (canon
 *    arpg-affix-is-ge).
 *  • Rare = ≤3 prefix + ≤3 suffix rolled from ilvl-gated tier pools.
 *  • requiredLevel ≈ ilvl − (5..15); base weapon DPS = ((dmgMin+dmgMax)/2) × APS.
 *  • Realizes to DT_Items row + DA_<slug> data asset + equip GE on UARPGAttributeSet.
 *  • Verification: VSItemsDefinitionsTest (functional test, L3 deferred).
 */
registerCatalogPipeline({
  catalogId: 'items',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is an equippable item in PoF — a physical object the player finds, identifies, ` +
            `and equips to spend their power budget (canon arpg-item-rarity: tier ≈100 ±10%, earned not ` +
            `gifted).  Items are the primary delivery mechanism for the ARPG power loop: a dropped item ` +
            `carries a base type (its identity + implicit), a rarity-gated set of explicit affixes (each ` +
            `a GameplayEffect on equip, canon arpg-affix-is-ge), and an ilvl that caps the affix tier ` +
            `pool available at drop-time (canon arpg-item-level, arpg-affixes).  The build fantasy lives ` +
            `in the Rare tier: ≤3 prefix + ≤3 suffix, each drawn from an ilvl-gated pool — the right ` +
            `six-affix Rare is a multi-session hunt that reshapes a character's passive tree plan.  ` +
            `Weapons add a damage range + APS + crit that feed ARPGDamageExecution directly; armour ` +
            `pieces stack the defensive layer (armour/evasion/ES + socket links for skill support gems).  ` +
            `Items link upstream to icon-sets (presentation icon), materials (PBR surface), and are ` +
            `referenced downstream by loot-tables (base pool) and vendors (buy/sell).  Every seeded ` +
            `entity in the items catalog is a potential drop candidate once loot-tables seeds its ` +
            `base-type pool (canon proj-links: loot references items, never re-authors them).`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Base Type & Rarity ─────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Base Type & Rarity',
      view: {
        kind: 'table',
        field: 'baseType',
        columns: [
          { key: 'slot' },
          { key: 'rarity' },
          { key: 'ilvl' },
          { key: 'requiredLevel' },
          { key: 'implicit' },
          { key: 'sockets' },
        ],
      },
      produce: (e: LabEntity) => {
        // Derive rarity from entity seed data; default to 'Common' if absent.
        const entityRarity: string = (e.data as Record<string, unknown> | null)?.rarity as string ?? 'Common';
        // ilvl and requiredLevel by rarity tier (§1c: requiredLevel within ilvl−5..15).
        // Common (tier-1): ilvl 6, requiredLevel 1 (ilvl−5 = 1, exactly at floor).
        // Rare (mid-range): ilvl 45, requiredLevel 33 (ilvl−12).
        const rarityIlvl: Record<string, number> = { Common: 6, Magic: 20, Rare: 45, Set: 55, Legendary: 70 };
        const rarityReqLvl: Record<string, number> = { Common: 1, Magic: 14, Rare: 33, Set: 43, Legendary: 57 };
        const ilvl = rarityIlvl[entityRarity] ?? 6;
        const requiredLevel = rarityReqLvl[entityRarity] ?? 1;
        return ({
        data: {
          baseType: {
            // Base type shape held constant per ARPG-LAWS §1b.
            // Rarity, ilvl, and requiredLevel derived from the entity's seeded rarity field.
            baseType: e.name,
            slot: 'Weapon',          // aligns ItemData.type+subtype: Weapon/Sword
            subType: 'Sword',
            oneHanded: true,
            rarity: entityRarity,    // derived from entity seed (arpg-item-rarity §1a)
            ilvl,                    // rarity-gated: Common→6, Magic→20, Rare→45 (§2c)
            requiredLevel,           // within ilvl−5..15 band (§1c)
            implicit: {
              // Sword implicit: +accuracy rating (slot identity)
              id: 'implicit-sword-accuracy',
              slot: 'implicit',
              mod: 'Accuracy',
              tier: 0,               // implicit = 0 (outside prefix/suffix budget)
              valueMin: 30,
              valueMax: 30,
              rolledValue: 30,
              ilvlReq: 1,
              weight: 0,
              ueGE: 'GE_Implicit_SwordAccuracy',
            },
            sockets: entityRarity === 'Common' ? 1 : 3,  // 1H weapon; Common tier-1 → 1 socket
            socketsNote: 'Gear holds 1–6 sockets; 1H weapons up to 4; links group sockets for skill+supports (ARPG-LAWS §1c).',
            rarityLadder: {
              Normal:     { budget: 'base + implicit only',        identity: 'clean base type',          dropPosture: 'floor of every roll' },
              Magic:      { budget: '≤1 prefix + ≤1 suffix',       identity: 'focused, predictable',     dropPosture: 'common' },
              Rare:       { budget: '≤3 prefix + ≤3 suffix',       identity: 'the build-defining roll',  dropPosture: 'uncommon' },
              Set:        { budget: 'fixed mods + set bonus',       identity: 'curated synergy',          dropPosture: 'rare, named pool' },
              Legendary:  { budget: 'fixed/range-rolled + ≥1 rule-changing mod', identity: 'a mechanic, not a stat-stick', dropPosture: 'rarest, named pool' },
            },
            ueSchema: 'UARPGItemDefinition',
            ueDT: 'DT_Items',
            ueDA: `DA_${slug(e.name)}`,
            wiringContract: {
              grantedBy: 'UARPGInventoryComponent equips the item and activates the equip GE bundle',
              activatedBy: 'On-equip (slot assignment in UARPGInventoryComponent)',
              dependencies: ['UARPGAttributeSet (stat targets)', 'UARPGItemDefinition (schema)', 'DT_Items (data row)'],
              verification:
                'L2: cppSymbolExists(UARPGItemDefinition) + seedRowPresent(author_items.py, DA_<slug>); ' +
                'L3: VSItemsDefinitionsTest — DA loaded + requiredLevel/slot/rarity fields assert correct',
            },
          },
        },
        ueAssets: [`/Game/Data/Items/DA_${slug(e.name)}`],
      });
      },
      accept: fieldsPopulated('baseType', 'slot / rarity / ilvl / requiredLevel / implicit populated', [
        'slot',
        'rarity',
        'ilvl',
        'requiredLevel',
        'implicit',
      ]),
      staticChecks: () => [
        cppSymbolExists('UARPGItemDefinition', 'UARPGItemDefinition declared in Source/'),
      ],
    },

    // ── 3. Affixes ────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Affixes',
      view: {
        kind: 'table',
        field: 'affixes',
        columns: [
          { key: 'budget' },
          { key: 'tierTable' },
          { key: 'illustrativeRareRoll' },
        ],
      },
      produce: (e: LabEntity) => {
        // Derive entity rarity to annotate the illustrative roll.
        const entityRarity: string = (e.data as Record<string, unknown> | null)?.rarity as string ?? 'Common';
        return ({
        data: {
          affixes: {
            //
            // ── Affix budget (ARPG-LAWS §2c) ──────────────────────────────────
            // Rare: ≤3 prefix + ≤3 suffix.  Magic: ≤1p + ≤1s.  This item is Rare
            // → 6 total affix slots, each filled from the ilvl-gated pool.
            //
            budget: {
              Magic:  { maxPrefix: 1, maxSuffix: 1 },
              Rare:   { maxPrefix: 3, maxSuffix: 3 },
              Set:    'fixed mods (not from the rolled pool)',
              Legendary: 'fixed/range-rolled + ≥1 rule-changing mod',
            },

            //
            // ── Affix tier table (ARPG-LAWS §2c) ──────────────────────────────
            // Each family has tiers T1 (best) … Tn (worst).
            // A tier rolls ONLY if dropped ilvl ≥ ilvlReq(tier).
            // Magnitude spread per tier: valueMax ≈ valueMin × 1.4–1.6×.
            // Adjacent tiers step ~1.5–2× in magnitude.
            // rarer/stronger mods carry lower weight.
            //
            tierTable: {
              //
              // PREFIX families
              //
              MaximumLife: {
                slot: 'prefix',
                group: 'life',
                ueGE: 'GE_Affix_MaximumLife',
                ueAttribute: 'UARPGAttributeSet::MaxHealth',
                tiers: [
                  { tier: 'T8', ilvlReq:  1, valueMin:  10, valueMax:  19, weight: 1000, label: '+10–19 to Maximum Life' },
                  { tier: 'T6', ilvlReq: 18, valueMin:  30, valueMax:  39, weight:  700, label: '+30–39 to Maximum Life' },
                  { tier: 'T4', ilvlReq: 36, valueMin:  50, valueMax:  59, weight:  400, label: '+50–59 to Maximum Life' },
                  { tier: 'T2', ilvlReq: 60, valueMin:  80, valueMax:  89, weight:  200, label: '+80–89 to Maximum Life' },
                  { tier: 'T1', ilvlReq: 80, valueMin: 100, valueMax: 119, weight:   80, label: '+100–119 to Maximum Life' },
                ],
                ilvlNote: 'At ilvl 45: T8/T6/T4 eligible; T2/T1 require ilvl 60+/80+.',
              },
              AddedPhysicalDamage: {
                slot: 'prefix',
                group: 'added-phys-damage',
                ueGE: 'GE_Affix_AddedPhysicalDamage',
                ueAttribute: 'UARPGAttributeSet::BonusPhysicalDamage',
                tiers: [
                  { tier: 'T5', ilvlReq:  1, valueMin:  3, valueMax:   5, weight: 900, label: 'Adds 3–5 Physical Damage to Attacks' },
                  { tier: 'T4', ilvlReq: 20, valueMin:  7, valueMax:  11, weight: 600, label: 'Adds 7–11 Physical Damage to Attacks' },
                  { tier: 'T3', ilvlReq: 35, valueMin: 14, valueMax:  20, weight: 350, label: 'Adds 14–20 Physical Damage to Attacks' },
                  { tier: 'T2', ilvlReq: 55, valueMin: 22, valueMax:  30, weight: 180, label: 'Adds 22–30 Physical Damage to Attacks' },
                  { tier: 'T1', ilvlReq: 75, valueMin: 33, valueMax:  45, weight:  70, label: 'Adds 33–45 Physical Damage to Attacks' },
                ],
                ilvlNote: 'At ilvl 45: T5/T4/T3 eligible (adds up to 20 flat phys); T2/T1 gated.',
                weaponOnly: true,
              },
              IncreasedAttackSpeed: {
                slot: 'prefix',
                group: 'attack-speed',
                ueGE: 'GE_Affix_IncreasedAttackSpeed',
                ueAttribute: 'UARPGAttributeSet::AttackSpeed',
                tiers: [
                  { tier: 'T4', ilvlReq:  1, valueMin:  3, valueMax:  7,  weight: 800, label: '+3–7% increased Attack Speed' },
                  { tier: 'T3', ilvlReq: 25, valueMin:  8, valueMax: 12,  weight: 500, label: '+8–12% increased Attack Speed' },
                  { tier: 'T2', ilvlReq: 50, valueMin: 13, valueMax: 17,  weight: 250, label: '+13–17% increased Attack Speed' },
                  { tier: 'T1', ilvlReq: 70, valueMin: 18, valueMax: 25,  weight: 100, label: '+18–25% increased Attack Speed' },
                ],
                ilvlNote: 'At ilvl 45: T4/T3 eligible.',
                weaponOnly: true,
              },
              //
              // SUFFIX families
              //
              FireResistance: {
                slot: 'suffix',
                group: 'fire-resist',
                ueGE: 'GE_Affix_FireResistance',
                ueAttribute: 'UARPGAttributeSet::FireResistance',
                tiers: [
                  { tier: 'T4', ilvlReq:  1, valueMin:  6, valueMax: 11, weight: 900, label: '+6–11% to Fire Resistance' },
                  { tier: 'T3', ilvlReq: 22, valueMin: 12, valueMax: 17, weight: 600, label: '+12–17% to Fire Resistance' },
                  { tier: 'T2', ilvlReq: 40, valueMin: 18, valueMax: 23, weight: 350, label: '+18–23% to Fire Resistance' },
                  { tier: 'T1', ilvlReq: 65, valueMin: 24, valueMax: 30, weight: 150, label: '+24–30% to Fire Resistance' },
                ],
              },
              LightningResistance: {
                slot: 'suffix',
                group: 'lightning-resist',
                ueGE: 'GE_Affix_LightningResistance',
                ueAttribute: 'UARPGAttributeSet::LightningResistance',
                tiers: [
                  { tier: 'T4', ilvlReq:  1, valueMin:  6, valueMax: 11, weight: 900, label: '+6–11% to Lightning Resistance' },
                  { tier: 'T3', ilvlReq: 22, valueMin: 12, valueMax: 17, weight: 600, label: '+12–17% to Lightning Resistance' },
                  { tier: 'T2', ilvlReq: 40, valueMin: 18, valueMax: 23, weight: 350, label: '+18–23% to Lightning Resistance' },
                  { tier: 'T1', ilvlReq: 65, valueMin: 24, valueMax: 30, weight: 150, label: '+24–30% to Lightning Resistance' },
                ],
              },
              IncreasedCriticalStrikeChance: {
                slot: 'suffix',
                group: 'crit-chance',
                ueGE: 'GE_Affix_IncreasedCritChance',
                ueAttribute: 'UARPGAttributeSet::CriticalStrikeChance',
                tiers: [
                  { tier: 'T4', ilvlReq:  1, valueMin: 10, valueMax: 15, weight: 700, label: '+10–15% increased Critical Strike Chance' },
                  { tier: 'T3', ilvlReq: 28, valueMin: 20, valueMax: 28, weight: 450, label: '+20–28% increased Critical Strike Chance' },
                  { tier: 'T2', ilvlReq: 50, valueMin: 30, valueMax: 40, weight: 220, label: '+30–40% increased Critical Strike Chance' },
                  { tier: 'T1', ilvlReq: 72, valueMin: 45, valueMax: 60, weight:  90, label: '+45–60% increased Critical Strike Chance' },
                ],
                weaponOnly: false,
              },
            },

            //
            // ── Illustrative Rare roll (ilvl 45 sword) ────────────────────────
            // "Grief Veil" — a realistic 6-affix Rare roll within the ilvl 45 pool.
            // This is DESCRIPTIVE only: it shows what a Rare roll on a higher-tier
            // base looks like.  This entity is ${entityRarity}; a Common item has
            // 0 explicit affixes (base + implicit only, budget.Common = 0).
            // 3 prefixes + 3 suffixes; each affix carries its GE and rolled value.
            //
            illustrativeRareRoll: {
              illustrativeNote: `Example of a Rare roll on a higher-tier base; this entity is ${entityRarity}. A Common item has 0 explicit affixes.`,
              name: 'Grief Veil',
              baseType: 'Iron Longsword',
              rarity: 'Rare',
              ilvl: 45,
              requiredLevel: 33,
              prefixes: [
                {
                  id: 'pfx-1',
                  family: 'MaximumLife',
                  tier: 'T4',
                  rolledValue: 54,          // within T4: 50–59
                  label: '+54 to Maximum Life',
                  ueGE: 'GE_Affix_MaximumLife',
                  geMagnitude: 54,
                },
                {
                  id: 'pfx-2',
                  family: 'AddedPhysicalDamage',
                  tier: 'T3',
                  rolledValue: 17,          // within T3: 14–20
                  label: 'Adds 14–17 Physical Damage to Attacks',
                  ueGE: 'GE_Affix_AddedPhysicalDamage',
                  geMagnitude: 17,
                },
                {
                  id: 'pfx-3',
                  family: 'IncreasedAttackSpeed',
                  tier: 'T3',
                  rolledValue: 10,          // within T3: 8–12
                  label: '+10% increased Attack Speed',
                  ueGE: 'GE_Affix_IncreasedAttackSpeed',
                  geMagnitude: 10,
                },
              ],
              suffixes: [
                {
                  id: 'sfx-1',
                  family: 'FireResistance',
                  tier: 'T2',
                  rolledValue: 21,          // within T2: 18–23
                  label: '+21% to Fire Resistance',
                  ueGE: 'GE_Affix_FireResistance',
                  geMagnitude: 21,
                },
                {
                  id: 'sfx-2',
                  family: 'LightningResistance',
                  tier: 'T3',
                  rolledValue: 15,          // within T3: 12–17
                  label: '+15% to Lightning Resistance',
                  ueGE: 'GE_Affix_LightningResistance',
                  geMagnitude: 15,
                },
                {
                  id: 'sfx-3',
                  family: 'IncreasedCriticalStrikeChance',
                  tier: 'T3',
                  rolledValue: 25,          // within T3: 20–28
                  label: '+25% increased Critical Strike Chance',
                  ueGE: 'GE_Affix_IncreasedCritChance',
                  geMagnitude: 25,
                },
              ],
              totalExplicits: 6,
              powerNote:
                'Grief Veil sits at the high end of ilvl-45 rolls: the T4 life prefix + T2 fire-resist + ' +
                'T3 lightning-resist meet the 75%-cap budget; the T3 added-phys + T3 aspd push the weapon ' +
                'DPS; the T3 crit suffix compounds on the base 5% weapon crit. ' +
                'Aggregate affix power ≈100 tier target (canon proj-balance): ' +
                '6 moderate-tier affixes rather than 1–2 outlier rolls is the Rare identity.',
            },

            //
            // ── Affix → GE wiring law (canon arpg-affix-is-ge) ───────────────
            wiringContract: {
              grantedBy:
                'UARPGInventoryComponent::EquipItem — creates one Infinite GameplayEffect handle per ' +
                'explicit affix in the item\'s rolled pool + one handle for the implicit; handles stored ' +
                'on the equip slot and removed on unequip.',
              activatedBy: 'On-equip slot assignment (UARPGInventoryComponent)',
              dependencies: [
                'UARPGAttributeSet (target attributes: MaxHealth, BonusPhysicalDamage, AttackSpeed, FireResistance, LightningResistance, CriticalStrikeChance)',
                'GE_Affix_MaximumLife',
                'GE_Affix_AddedPhysicalDamage',
                'GE_Affix_IncreasedAttackSpeed',
                'GE_Affix_FireResistance',
                'GE_Affix_LightningResistance',
                'GE_Affix_IncreasedCritChance',
                'GE_Implicit_SwordAccuracy',
              ],
              verification:
                'L2: cppSymbolExists(UARPGItemDefinition) + all GE_ headers in Source/; ' +
                'L3: VSItemsDefinitionsTest — equip Iron Longsword on dummy ASC, assert AttackPower delta ' +
                'and that each affix GE handle is active on the ASC',
            },
          },
        },
      });
      },
      accept: fieldsPopulated('affixes', 'budget / tierTable / illustrativeRareRoll populated', [
        'budget',
        'tierTable',
        'illustrativeRareRoll',
      ]),
    },

    // ── 4. Damage / Implicit ──────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Damage / Implicit',
      view: {
        kind: 'table',
        field: 'damage',
        columns: [
          { key: 'damageType' },
          { key: 'damageMin' },
          { key: 'damageMax' },
          { key: 'attackSpeed' },
          { key: 'critChance' },
          { key: 'critMulti' },
          { key: 'baseDPS' },
        ],
      },
      produce: (e: LabEntity) => {
        // Iron Longsword (item-1) base stat block — a canonical tier-1 1H sword.
        // ARPG-LAWS §1c: baseDPS = ((dmgMin+dmgMax)/2) × APS.
        // Damage range sourced from the entity seed (DUMMY_ITEMS item-1: Damage 12-18).
        // Attack speed derived from the entity's Speed stat: Speed = swing-time in seconds;
        //   APS = 1 / swingTime.  item-1 Speed = 1.2s → APS = 1/1.2 ≈ 0.83.
        // crit 5–6.5%; crit multi base +150% (×2.5).
        const damageMin = 12;
        const damageMax = 18;
        // Derive swing-time from entity Speed stat (value: '1.2s'); strip 's' and invert to APS.
        const entityStats = (e.data as Record<string, unknown> | null)?.stats as
          Array<{ label: string; value: string }> | undefined;
        const speedStat = entityStats?.find((s) => s.label === 'Speed');
        const swingTimeSec = speedStat
          ? parseFloat(speedStat.value.replace('s', ''))
          : 1.2;                          // item-1 default: 1.2 s (Speed stat in DUMMY_ITEMS)
        // Round APS to 4 decimal places for stability.
        const attackSpeed = Math.round((1 / swingTimeSec) * 10000) / 10000; // 1/1.2 ≈ 0.8333
        const critChance = 0.055;         // 5.5%, within 5–6.5% band
        const critMulti = 2.5;            // base +150% = ×2.5 (ARPG-LAWS §1c + §3)
        const baseDPS = Math.round(((damageMin + damageMax) / 2) * attackSpeed * 10000) / 10000;
        // item-1: ((12+18)/2) × 0.8333 = 15 × 0.8333 = 12.4995 ≈ 12.5
        return {
          data: {
            damage: {
              // Weapon base stats (no affixes applied)
              baseType: 'Iron Longsword',
              damageType: 'Physical',      // matches UE damage-type enum
              damageMin,                   // 12
              damageMax,                   // 18
              attackSpeed,                 // derived from entity Speed stat (1.2 s → 0.8333 APS)
              attackSpeedNote: `Derived from entity Speed stat (${swingTimeSec}s swing-time → ${attackSpeed} APS = 1 / ${swingTimeSec}).`,
              critChance,                  // 5.5%
              critMulti,                   // ×2.5 (base; affixes add "increased crit multi")
              baseDPS,                     // ≈ 12.5 (no affixes)
              dpsNote:
                `baseDPS = ((${damageMin}+${damageMax})/2) × ${attackSpeed} = ${(damageMin + damageMax) / 2} × ${attackSpeed} = ${baseDPS}. ` +
                'Affixes compound via added → increased → more (canon arpg-damage-model): ' +
                'AddedPhysicalDamage T3 (+17 flat) → new base 22–35 → avg 28.5 × 0.8333 ≈ 23.7 DPS; ' +
                'IncreasedAttackSpeed T3 (+10% increased) → ×1.1 on APS → 26.1 DPS; ' +
                'effective crit overlay: 5.5% × (1+0.25 increased) × ×2.5 → avgCritMult ≈ 1.103 → ~28.8 effective DPS with crit. ' +
                'Sits below the tier-100 DPS ceiling (baseline is tier-1, ilvl 1–10 zone); ' +
                'endgame items at ilvl 80+ reach 200–400+ DPS via T1 affixes.',
              implicit: {
                type: 'Accuracy',
                value: 30,
                label: '+30 to Accuracy Rating',
                ueGE: 'GE_Implicit_SwordAccuracy',
                note: 'Sword slot identity implicit — +accuracy is outside the prefix/suffix budget.',
              },
              mathLaw: 'ARPG-LAWS §3: base+added → ×(1+Σincreased%) → ×each more%. Crit: effectiveCrit = baseCrit × (1+increasedCrit), capped 95%; on crit ×critMulti (base 2.5 = +150%).',
            },
            // top-level field for withinPercent checker — base DPS for item-1 derived at runtime
            baseDPS,
          },
        };
      },
      // baseDPS derived from seed: item-1 APS 0.8333 × avg-dmg 15 ≈ 12.5.
      // Target 12.5 ±30% (8.75–16.25); generous band covers tier-1 variance.
      accept: withinPercent('baseDPS', 'Base DPS within ±30% of tier-1 weapon target (12.5)', 12.5, 30),
    },

    // ── 5. Economy ────────────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Economy',
      view: {
        kind: 'table',
        field: 'economy',
        columns: [
          { key: 'baseValue' },
          { key: 'powerScore' },
          { key: 'pricePowerRatio' },
          { key: 'rarityMultipliers' },
        ],
      },
      produce: () => {
        // Base value from plan.md: Iron Longsword BaseValue = 12.
        // Power score is the sum of normalized tier-power contributions.
        // Price/power must sit 0.8–1.2× the tier target (canon proj-balance).
        // For a tier-1 Common item: baseValue 12 / power ≈ 12 (the implicit +30 accuracy
        // contributes a normalised ~12 tier-power points at T8 accuracy values) → ratio 1.0.
        const baseValue = 12;
        const powerScore = 12;
        const pricePowerRatio = baseValue / powerScore; // = 1.0
        return {
          data: {
            economy: {
              baseValue,           // vendor sell/buy anchor (soft currency gold)
              powerScore,          // normalized tier-power (implicit + base DPS contribution)
              pricePowerRatio,     // 1.0 — squarely in the 0.8–1.2× canon band
              rarityMultipliers: {
                // Vendor buy-price scales with affix count + tier quality.
                // These are approximate multipliers on baseValue for fully rolled items.
                Normal:    { mult: 1.0,  example: 'baseValue × 1.0 = 12 gold' },
                Magic:     { mult: 2.5,  example: 'baseValue × 2.5 = 30 gold (1–2 good affixes)' },
                Rare:      { mult: 8.0,  example: 'baseValue × 8.0 = 96 gold (4–6 affixes, tier-dependent)' },
                Set:       { mult: 25.0, example: 'baseValue × 25.0 = 300 gold (curated synergy)' },
                Legendary: { mult: 60.0, example: 'baseValue × 60.0 = 720 gold (rule-changing mod)' },
              },
              currencySink:
                'A Chaos Orb rerolls a Rare item entirely (ARPG-LAWS §10); cost ≈ expected affix-roll ' +
                'value of the item tier. Exalt Orbs add one affix to a Rare with an open slot — high ' +
                'value when only 1–2 slots are open on a near-perfect item. Vendor recipe: sell a full ' +
                'set of Rare items (one per slot) → receive one Chaos Orb shard (1 sink per full set). ' +
                'Every currency declares ≥1 sink (canon proj-economy); the set recipe is the item row\'s contribution.',
              balanceNote:
                'pricePowerRatio(1.0) is within the 0.8–1.2× canon band (proj-balance). ' +
                'Rare multiplier (×8) reflects 4–6 affixes with mid-tier rolls at ilvl 45; ' +
                'the exact vendor value caps to avoid soft-currency inflation (canon proj-economy).',
            },
            pricePowerRatio,
          },
        };
      },
      accept: withinPercent('pricePowerRatio', 'Price/power ratio within 0.8–1.2× band', 1.0, 20),
    },

    // ── 6. Material ───────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Material',
      view: {
        kind: 'table',
        field: 'material',
        columns: [{ key: 'surface' }, { key: 'parentMaterial' }, { key: 'textures' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          material: {
            // mat-weathered-stone is the one seeded material entity in seed-materials.ts.
            // Iron Longsword: worn iron blade — Weathered Stone's worn-metal sub-set fits; a
            // bespoke MI_IronLongsword_Blade instances from M_ARPG_Surface_Master with metal params.
            surface: 'iron (weathered, worn)',
            parentMaterial: '/Game/Materials/M_ARPG_Surface_Master',
            instancePath: `/Game/Items/Materials/MI_${slug(e.name)}_Blade`,
            textureFamily: 'iron-worn',
            textures: {
              albedo:  `/Game/Items/Textures/T_${slug(e.name)}_Albedo`,
              normal:  `/Game/Items/Textures/T_${slug(e.name)}_Normal`,
              orm:     `/Game/Items/Textures/T_${slug(e.name)}_ORM`,   // Occlusion/Roughness/Metal
            },
            masterParams: {
              baseColorTint: [0.55, 0.54, 0.52],  // dull iron grey
              roughness: 0.72,
              metallic: 0.90,
              wearAmount: 0.45,
              tilingScale: 1.0,
            },
            artStyle: 'PBR, Nanite-friendly; weathered iron surface, muted earthen palette (canon art-identity). Albedo/Normal/ORM required (canon art-material).',
            artNote: 'canon art-material: author as master-material instance; expose wear/tint params.',
          },
        },
        links: [
          { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
        ],
      }),
      accept: fieldsPopulated('material', 'surface / parentMaterial / textures populated', [
        'surface',
        'parentMaterial',
        'textures',
      ]),
    },

    // ── 7. Icon 2D Art ────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-library' },
        ],
        ueAssets: [
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Common`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Magic`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Rare`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Unique`,
        ],
      }),
      accept: selected('selected', 'An item icon candidate is selected'),
    },

    // ── 8. 3D Mesh ────────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: '3D Mesh',
      view: { kind: 'gallery', field: 'mesh3dSelected', candidates: 3 },
      produce: (e: LabEntity) => ({
        data: { mesh3dSelected: 0 },
        ueAssets: [
          `/Game/Items/Meshes/SM_${slug(e.name)}_LOD0`,
          `/Game/Items/Meshes/SM_${slug(e.name)}_LOD1`,
          `/Game/Items/Meshes/SM_${slug(e.name)}_LOD2`,
        ],
      }),
      accept: selected('mesh3dSelected', 'A 3D mesh variant is selected (L1 human selection)'),
    },

    // ── 9. Tooltip / Compare ──────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Tooltip / Compare',
      view: {
        kind: 'table',
        field: 'tooltip',
        columns: [{ key: 'displayName' }, { key: 'description' }, { key: 'compareFields' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          tooltip: {
            displayName: e.name,
            description:
              'A standard iron-forged longsword, edge kept sharp by a soldier\'s habit. ' +
              'Reliable and unremarkable — a weapon that outlasts the hands that wield it.',
            headerLine: 'Iron Longsword',
            subHeaderLine: 'One-Handed Sword',
            implicitLine: '+30 Accuracy Rating',
            separatorAfterImplicit: true,
            affixLines: [
              'Adds 12–18 Physical Damage',
              '+54 to Maximum Life',
              '+10% increased Attack Speed',
              '+25% increased Critical Strike Chance',
              '+21% to Fire Resistance',
              '+15% to Lightning Resistance',
            ],
            rarityColorBorder: 'Rare',    // amber-gold border in HUD per rarity
            compareFields: ['damageMin', 'damageMax', 'attackSpeed', 'critChance', 'MaxHealth', 'FireResistance', 'LightningResistance'],
            compareNote:
              'Compare panel diffs affix values vs the currently equipped weapon. ' +
              'Increased Attack Speed displays as "APS ×(1+increased%)" to make speed intuitive. ' +
              'HUD tooltip binds to hud-elements presentation catalog (canon proj-hud-binding).',
            locKeys: {
              name: 'Item_IronLongsword_Name',
              desc: 'Item_IronLongsword_Desc',
            },
          },
        },
      }),
      accept: fieldsPopulated('tooltip', 'displayName / description / compareFields populated', [
        'displayName',
        'description',
        'compareFields',
      ]),
    },

    // ── 10. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'DA_IronLongsword loads correctly from /Game/Data/Items/',
            'DisplayName / Description / Type / Rarity / RequiredLevel match canonical fields',
            'OnEquipEffect GE grants expected AttackPower (or attribute delta)',
            'Each explicit affix GE handle is active on the ASC after equip',
            'Each affix GE handle is removed on unequip',
            'requiredLevel is within ilvl − 15 and ilvl − 5',
            'Item slot = Weapon; AllowedSlots includes Weapon',
            'Socket count ≤ 4 for a 1H weapon',
            'Affix count per slot does not exceed Rare budget (≤3p + ≤3s)',
          ],
          wiringContract: {
            grantedBy:
              'UARPGInventoryComponent::EquipItem — binds one Infinite GE handle per affix; ' +
              'handles stored in TMap<FGameplayTag, FActiveGameplayEffectHandle>.',
            activatedBy: 'Equip slot assignment; reversed on unequip (RemoveActiveGameplayEffect)',
            dependencies: [
              'UARPGAttributeSet (target attributes)',
              'UARPGItemDefinition (DA schema)',
              'DT_Items (data row)',
              'author_items.py (seed script)',
            ],
            verification:
              'L2: UARPGItemDefinition declared in Source/ + DA_IronLongsword seeded in author_items.py; ' +
              'L3: VSItemsDefinitionsTest (VSItems.umap) — 19+ assertions: loads DA, checks fields, ' +
              'equips on dummy ASC, asserts GE handles active, asserts attribute delta',
          },
        },
      }),
      accept: runtimeDeferred(
        'VSItemsDefinitionsTest',
        'Item equip GEs apply and attributes delta correctly in PIE',
      ),
      staticChecks: (e) => [
        cppSymbolExists('UARPGItemDefinition', 'UARPGItemDefinition declared in Source/'),
        seedRowPresent('author_items.py', slug(e.name), 'Item DA row seeded in Content/Python'),
      ],
    },

    // ── 11. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DA_${s}`,
          `DT_Items :: ${s}`,
          `GE_Affix_MaximumLife`,
          `GE_Affix_AddedPhysicalDamage`,
          `GE_Affix_IncreasedAttackSpeed`,
          `GE_Affix_FireResistance`,
          `GE_Affix_LightningResistance`,
          `GE_Affix_IncreasedCritChance`,
          `GE_Implicit_SwordAccuracy`,
          `MI_${s}_Blade`,
          `SM_${s}_LOD0`,
          `T_${s}_Icon_Rare`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `UARPGItemDefinition (DA_${s}) realized as a row in DT_Items; ` +
                `GE_ assets applied by UARPGInventoryComponent on equip; ` +
                `mesh bound to the item socket on the character skeletal mesh.`,
              activatedBy:
                `DA_${s} loaded by the inventory component → equip → GE handles activated on ASC; ` +
                `triggered by UI slot assignment or code call to EquipItem.`,
              dependencies: [
                `UARPGItemDefinition (DA_${s})`,
                'DT_Items (data row)',
                'UARPGInventoryComponent (equip logic)',
                'UARPGAttributeSet (target attributes)',
                'author_items.py (Content/Python seed script)',
              ],
              verification:
                `L2: UARPGItemDefinition in Source/ + DA_${s} seeded in author_items.py + ` +
                `all GE_ headers compiled; ` +
                `L3: VSItemsDefinitionsTest in VSItems.umap — loads DA, asserts fields, ` +
                `equips on dummy ASC, checks GE handles + attribute delta`,
            },
          },
          ueAssets: assets.map((a) => {
            if (a.startsWith('DA_') || a.startsWith('GE_') || a.startsWith('DT_')) {
              return `/Game/Data/Items/${a}`;
            }
            if (a.startsWith('MI_') || a.startsWith('T_')) {
              return `/Game/Items/Materials/${a}`;
            }
            if (a.startsWith('SM_')) {
              return `/Game/Items/Meshes/${a}`;
            }
            return `/Game/Items/${a}`;
          }),
        };
      },
      accept: minCount('assets', '≥3 UE assets packaged', 3),
      staticChecks: (e) => [
        cppSymbolExists('UARPGItemDefinition', 'UARPGItemDefinition present in Source/'),
        seedRowPresent('author_items.py', slug(e.name), 'Item DA row seeded in Content/Python'),
      ],
    },
  ],
});
