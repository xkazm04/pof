import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { allOf } from '@/lib/catalog/acceptance/combinators';
import { entriesHaveFields, fieldsPopulated, minCount, minLength } from '@/lib/catalog/acceptance/dataCheckers';
import { entityRuntimeDeferred } from '@/lib/catalog/acceptance/deferred';
import { tiersAscend } from '@/lib/catalog/acceptance/tiersAscend';
import { cppSymbolExists } from '@/lib/catalog/acceptance/ueStaticCheckers';
import { wiringContractSound } from '@/lib/catalog/acceptance/wiringCheckers';
import { registerCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import {
  ADDED_PHYSICAL_DAMAGE_AFFIX,
  type AffixSeedData,
} from '@/lib/catalog/seed-affixes';

function sourceFor(entity: LabEntity): AffixSeedData {
  const data = (entity.data ?? {}) as Partial<AffixSeedData>;
  return {
    ...ADDED_PHYSICAL_DAMAGE_AFFIX,
    ...data,
    displayName: entity.name,
    tiers: Array.isArray(data.tiers) && data.tiers.length > 0
      ? data.tiers
      : ADDED_PHYSICAL_DAMAGE_AFFIX.tiers,
  };
}

registerCatalogPipeline({
  catalogId: 'affixes',
  steps: [
    {
      archetype: 'brief',
      label: 'Concept Brief',
      engine: 'Claude',
      view: { kind: 'prose', field: 'brief', emptyText: 'No affix brief yet' },
      produce: (entity: LabEntity, direction?: string) => {
        const source = sourceFor(entity);
        const kind = source.isPrefix ? 'PREFIX' : 'SUFFIX';
        return {
          data: {
            brief:
              `${entity.name} is a ${kind} affix family that modifies ${source.statTarget} when an item `
              + `carrying it is equipped. PREFIXES are numeric power: added damage, increased armour, `
              + `and maximum life belong on the power side of an item's roll budget. SUFFIXES are utility: `
              + `resistances, attributes, and speed belong on the utility side. This family is a ${kind}, `
              + `so its identity and presentation must remain on that side of the split. The registry rule `
              + `"rarity is an affix budget" means rarity controls how many prefix and suffix slots an item `
              + `may spend; rarity never silently enlarges this family's numeric range. Only one affix from `
              + `the ${source.group} family may roll on an item, preventing duplicate members of the same `
              + `family from stacking. Item level unlocks authored tiers, while each tier retains its own `
              + `range and roll weight. The equipped item's ${source.effect} applies the rolled magnitude to `
              + `${source.statTarget}, and unequipping removes that effect. `
              + (direction?.trim() ? `Operator direction: ${direction.trim()}` : ''),
          },
        };
      },
      accept: minLength('brief', 'Affix brief ≥ 300 characters', 300),
    },
    {
      archetype: 'schema',
      label: 'Affix Definition',
      engine: 'Hand-authored',
      view: {
        kind: 'table',
        field: 'affix',
        columns: [
          { key: 'affixTag' },
          { key: 'displayName' },
          { key: 'isPrefix' },
          { key: 'group' },
          { key: 'statTarget' },
          { key: 'minRarity' },
          { key: 'weight' },
        ],
      },
      produce: (entity: LabEntity, direction?: string) => {
        const source = sourceFor(entity);
        return {
          data: {
            affix: {
              affixTag: source.affixTag,
              displayName: source.displayName,
              isPrefix: source.isPrefix,
              group: source.group,
              statTarget: source.statTarget,
              minRarity: source.minRarity,
              weight: source.weight,
              authorDirection: direction?.trim() || 'Use the seeded PoF affix definition.',
              wiringContract: {
                grantedBy:
                  `FAffixTableRow ${source.affixTag} in DT_Affixes grants ${source.effect} as this `
                  + 'family\'s equipped GameplayEffect',
                activatedBy:
                  'UARPGInventoryComponent equips an item carrying the rolled affix and applies its Effect GameplayEffect',
                dependencies: [source.effect, source.statTarget, 'DT_Affixes'],
                verification:
                  'L2: FAffixTableRow compiles and the DT_Affixes row names a valid Effect and target attribute; '
                  + 'L3: the affix equipment test proves equip applies the modifier and unequip removes it',
              },
            },
          },
        };
      },
      contract: {
        field: 'affix',
        grantedBy: 'the FAffixTableRow for THIS affix in DT_Affixes grants its declared Effect GameplayEffect',
        activatedBy: 'an item carrying THIS affix is equipped through UARPGInventoryComponent and applies the row Effect',
        dependencies: [
          'UARPGAttributeSet attribute targeted by THIS affix',
          'one GameplayEffect implementing THIS affix',
          'DT_Affixes',
        ],
        verification: 'L2: THIS FAffixTableRow compiles and resolves its Effect and target attribute; L3: equip and unequip prove the modifier is applied and removed',
      },
      accept: allOf(
        fieldsPopulated('affix', 'Affix definition populated', [
          'affixTag',
          'displayName',
          'isPrefix',
          'group',
          'statTarget',
          'weight',
        ]),
        wiringContractSound('affix'),
      ),
      ue: {
        type: 'FAffixTableRow',
        fields: {
          'affix.affixTag': 'AffixTag',
          'affix.displayName': 'DisplayName',
          'affix.isPrefix': 'bIsPrefix',
          'affix.group': 'AffixGroup',
          'affix.minRarity': 'MinRarity',
          'affix.weight': 'Weight',
        },
      },
    },
    {
      archetype: 'rules',
      label: 'Tiers & Item Level',
      engine: 'Claude',
      view: {
        kind: 'table',
        field: 'tiers',
        columns: [
          { key: 'tier' },
          { key: 'minItemLevel' },
          { key: 'valueMin' },
          { key: 'valueMax' },
          { key: 'weight' },
        ],
      },
      produce: (entity: LabEntity, direction?: string) => ({
        data: {
          // Registry rule: the item level unlocks the tier.
          tiers: sourceFor(entity).tiers.map((tier) => ({ ...tier })),
          authorDirection: direction?.trim() || 'Preserve the seeded PoF tier ladder.',
        },
      }),
      accept: allOf(
        minCount('tiers', 'At least one affix tier', 1),
        entriesHaveFields('tiers', 'Every tier has its unlock and value range', [
          'tier',
          'minItemLevel',
          'valueMin',
          'valueMax',
        ]),
        tiersAscend('tiers'),
      ),
      ue: {
        type: 'FAffixTableRow',
        fields: {
          'tiers[].minItemLevel': 'MinItemLevel',
          'tiers[].valueMin': 'MinValue',
          'tiers[].valueMax': 'MaxValue',
        },
      },
    },
    {
      archetype: 'schema',
      label: 'Spawn Rules',
      engine: 'Hand-authored',
      view: {
        kind: 'table',
        field: 'spawn',
        columns: [{ key: 'itemTypes' }, { key: 'notes' }],
      },
      produce: (entity: LabEntity, direction?: string) => {
        const source = sourceFor(entity);
        return {
          data: {
            spawn: {
              itemTypes: [...source.itemTypes],
              notes:
                `${source.displayName} may roll only on ${source.itemTypes.join(', ')} item types; `
                + `the ${source.group} family remains mutually exclusive on one item. `
                + (direction?.trim() ? `Operator direction: ${direction.trim()}` : ''),
            },
          },
        };
      },
      accept: fieldsPopulated('spawn', 'Affix spawn item types populated', ['itemTypes']),
      // No StepSpec.ue mapping: UE expresses spawn eligibility per item through
      // UARPGItemDefinition.AffixPool, not on FAffixTableRow.
    },
    {
      archetype: 'checklist',
      label: 'Test Gate',
      engine: 'Hand-authored',
      view: { kind: 'checklist', field: 'checks' },
      produce: (entity: LabEntity, direction?: string) => {
        const source = sourceFor(entity);
        return {
          data: {
            checks: [
              `DT_Affixes resolves ${source.affixTag} to ${source.effect}`,
              'an eligible item can roll only an item-level-unlocked tier',
              `equip applies the rolled ${source.statTarget} magnitude`,
              'unequip removes the GameplayEffect handle and restores the prior value',
              `a second member of group ${source.group} cannot roll on the same item`,
              ...(direction?.trim() ? [`Operator direction: ${direction.trim()}`] : []),
            ],
          },
        };
      },
      accept: entityRuntimeDeferred('PoF.Items.Affixes', 'Affix functional test passes in UE'),
    },
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      engine: 'Packaging engine',
      view: { kind: 'manifest', field: 'assets' },
      produce: (entity: LabEntity, direction?: string) => {
        const source = sourceFor(entity);
        const assets = [
          `DT_Affixes :: ${source.affixTag}`,
          source.effect,
        ];
        return {
          data: {
            assets,
            packagingDirection: direction?.trim() || 'Package the declared row and Effect.',
            wiringContract: {
              grantedBy:
                `DT_Affixes packages FAffixTableRow ${source.affixTag} with ${source.effect} as its Effect`,
              activatedBy:
                'UARPGInventoryComponent equips an item whose AffixPool rolled this row and applies the packaged Effect',
              dependencies: [source.effect, source.statTarget, 'UARPGItemDefinition.AffixPool'],
              verification:
                'L2: packaging resolves the DT_Affixes row and GameplayEffect asset on disk; '
                + 'L3: the affix equipment test proves the packaged row activates at runtime',
            },
          },
          ueAssets: [
            '/Game/Data/DT_Affixes',
            `/Game/Effects/Affixes/${source.effect}`,
          ],
        };
      },
      contract: {
        grantedBy: 'DT_Affixes packages the FAffixTableRow for THIS affix together with its declared Effect GameplayEffect',
        activatedBy: 'UARPGInventoryComponent equips an item whose AffixPool rolled THIS row and applies the packaged Effect',
        dependencies: [
          'UARPGItemDefinition.AffixPool',
          'UARPGAttributeSet attribute targeted by THIS affix',
          'one GameplayEffect implementing THIS affix',
        ],
        verification: 'L2: the packaging drain resolves THIS DT_Affixes row and Effect asset on disk; L3: the affix equipment test proves the packaged row activates at runtime',
      },
      accept: allOf(
        minCount('assets', 'DT_Affixes row and Effect packaged', 2),
        wiringContractSound(),
      ),
      staticChecks: () => [cppSymbolExists('FAffixTableRow', 'Affix row struct present')],
    },
  ],
});
