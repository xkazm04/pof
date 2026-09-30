import type { VerificationRule, VerificationVerdict, AssetManifest } from '@/types/pof-bridge';
import type { FeatureStatus } from '@/types/feature-matrix';

/**
 * Verification rules that check the UE5 asset manifest for evidence
 * of implemented features. Used by the verification engine to PROPOSE
 * Feature Matrix flips (see `planVerification`); nothing here writes.
 *
 * Each rule maps a DECLARED featureName + moduleId pair (a feature in
 * `MODULE_FEATURE_DEFINITIONS[moduleId]` — pinned by a drift test) to a check
 * that returns a verdict AND the manifest assets that justify it.
 *
 * The manifest lists assets, not C++ classes: a `missing` verdict means "no
 * matching asset", which is why a proposed downgrade of a review/fix verdict is
 * never picked by default.
 */

interface HasPath {
  path: string;
}

/** Found-or-missing: `status` when anything matched, with the matched assets as evidence. */
function matched(assets: HasPath[], status: FeatureStatus = 'implemented'): VerificationVerdict {
  return assets.length > 0
    ? { status, evidence: assets.map((a) => a.path) }
    : { status: 'missing', evidence: [] };
}

/** Count-tiered: implemented at `implementedAt` matches, partial at `partialAt`. */
function tiered(assets: HasPath[], implementedAt: number, partialAt = 1): VerificationVerdict {
  const evidence = assets.map((a) => a.path);
  if (assets.length >= implementedAt) return { status: 'implemented', evidence };
  if (assets.length >= partialAt) return { status: 'partial', evidence };
  return { status: 'missing', evidence };
}

const lower = (s: string) => s.toLowerCase();

export const VERIFICATION_RULES: VerificationRule[] = [
  // ── arpg-character ──────────────────────────────────────────────────────────

  {
    featureName: 'AARPGCharacterBase',
    moduleId: 'arpg-character',
    check: (m: AssetManifest) =>
      matched(
        m.blueprints.filter(
          (bp) =>
            bp.parentCppClass.includes('ARPGCharacterBase') ||
            (lower(bp.path).includes('character') && lower(bp.path).includes('base')),
        ),
      ),
  },
  {
    featureName: 'AARPGPlayerCharacter',
    moduleId: 'arpg-character',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) => lower(bp.path).includes('player') && lower(bp.path).includes('character'),
        ),
      ),
  },
  {
    // IA_* actions WITH an IMC_* mapping context (the former 'Input Mapping Context'
    // rule named no declared feature; the declared feature asks for both).
    featureName: 'Enhanced Input actions',
    moduleId: 'arpg-character',
    check: (m) => {
      const actions = m.otherAssets.filter(
        (a) => a.assetClass.includes('InputAction') || a.path.includes('IA_'),
      );
      const contexts = m.otherAssets.filter(
        (a) => a.assetClass.includes('InputMappingContext') || a.path.includes('IMC_'),
      );
      const evidence = [...actions, ...contexts].map((a) => a.path);
      if (actions.length >= 5 && contexts.length > 0) return { status: 'implemented', evidence };
      if (actions.length >= 2 || contexts.length > 0) return { status: 'partial', evidence };
      return { status: 'missing', evidence };
    },
  },

  // ── arpg-gas ────────────────────────────────────────────────────────────────

  {
    featureName: 'AbilitySystemComponent',
    moduleId: 'arpg-gas',
    check: (m) =>
      matched(
        m.blueprints.filter((bp) =>
          bp.addedComponents.some((c) => c.componentClass.includes('AbilitySystem')),
        ),
      ),
  },
  {
    featureName: 'Core AttributeSet',
    moduleId: 'arpg-gas',
    check: (m) => matched(m.blueprints.filter((bp) => bp.parentCppClass.includes('AttributeSet'))),
  },
  {
    // Formerly 'Gameplay Abilities': Blueprint abilities subclassing the ability base.
    featureName: 'Base GameplayAbility',
    moduleId: 'arpg-gas',
    check: (m) =>
      tiered(m.blueprints.filter((bp) => bp.parentCppClass.includes('GameplayAbility')), 3),
  },
  {
    // Formerly 'Gameplay Effects'.
    featureName: 'Core Gameplay Effects',
    moduleId: 'arpg-gas',
    check: (m) =>
      tiered(
        m.blueprints.filter(
          (bp) => bp.parentCppClass.includes('GameplayEffect') || bp.path.includes('GE_'),
        ),
        3,
      ),
  },

  // ── arpg-animation ──────────────────────────────────────────────────────────

  {
    featureName: 'Animation state machine',
    moduleId: 'arpg-animation',
    check: (m) => {
      const withSM = m.animAssets.filter(
        (a) => a.assetType === 'AnimBlueprint' && a.stateMachines && a.stateMachines.length > 0,
      );
      if (withSM.length === 0) return { status: 'missing', evidence: [] };
      const totalStates = withSM.reduce(
        (sum, a) => sum + (a.stateMachines?.reduce((s, sm) => s + sm.states.length, 0) ?? 0),
        0,
      );
      return { status: totalStates >= 3 ? 'implemented' : 'partial', evidence: withSM.map((a) => a.path) };
    },
  },
  {
    featureName: 'Attack montages',
    moduleId: 'arpg-animation',
    check: (m) =>
      tiered(
        m.animAssets.filter(
          (a) =>
            a.assetType === 'AnimMontage' &&
            (lower(a.path).includes('attack') || lower(a.path).includes('combo')),
        ),
        3,
      ),
  },
  {
    featureName: 'Anim Notify classes',
    moduleId: 'arpg-animation',
    check: (m) => {
      const withNotifies = m.animAssets.filter((a) => a.notifies && a.notifies.length > 0);
      const uniqueClasses = new Set(
        withNotifies.flatMap((a) => a.notifies?.map((n) => n.notifyClass) ?? []),
      );
      const evidence = withNotifies.map((a) => a.path);
      if (uniqueClasses.size >= 3) return { status: 'implemented', evidence };
      if (uniqueClasses.size >= 1) return { status: 'partial', evidence };
      return { status: 'missing', evidence };
    },
  },
  {
    // Formerly 'Blend Spaces'.
    featureName: 'Locomotion Blend Space',
    moduleId: 'arpg-animation',
    check: (m) => tiered(m.animAssets.filter((a) => a.assetType === 'BlendSpace'), 2),
  },

  // ── arpg-combat ─────────────────────────────────────────────────────────────

  {
    featureName: 'Melee attack ability',
    moduleId: 'arpg-combat',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) =>
            bp.parentCppClass.includes('GameplayAbility') &&
            (lower(bp.path).includes('melee') || lower(bp.path).includes('attack')),
        ),
      ),
  },
  {
    featureName: 'Hit detection',
    moduleId: 'arpg-combat',
    check: (m) =>
      matched(
        m.animAssets.filter((a) =>
          a.notifies?.some(
            (n) =>
              lower(n.notifyClass).includes('hit') ||
              lower(n.notifyClass).includes('trace') ||
              lower(n.notifyClass).includes('damage'),
          ),
        ),
      ),
  },
  {
    // Formerly 'Damage Gameplay Effect'. A damage GE asset is the effect the hit
    // applies, not proof that anything applies it on hit: capped at partial.
    featureName: 'GAS damage application',
    moduleId: 'arpg-combat',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) => bp.parentCppClass.includes('GameplayEffect') && lower(bp.path).includes('damage'),
        ),
        'partial',
      ),
  },

  // ── arpg-enemy-ai ───────────────────────────────────────────────────────────

  {
    featureName: 'AARPGEnemyCharacter',
    moduleId: 'arpg-enemy-ai',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) => lower(bp.path).includes('enemy') && lower(bp.path).includes('character'),
        ),
      ),
  },
  {
    // The former 'Blackboard' rule named no declared feature; its assets now count
    // as supporting evidence for the tree they serve.
    featureName: 'Behavior Tree',
    moduleId: 'arpg-enemy-ai',
    check: (m) => {
      const trees = m.otherAssets.filter(
        (a) => a.assetClass.includes('BehaviorTree') || a.path.includes('BT_'),
      );
      if (trees.length === 0) return { status: 'missing', evidence: [] };
      const boards = m.otherAssets.filter(
        (a) => a.assetClass.includes('BlackboardData') || a.path.includes('BB_'),
      );
      return { status: 'implemented', evidence: [...trees, ...boards].map((a) => a.path) };
    },
  },

  // ── arpg-inventory ──────────────────────────────────────────────────────────

  {
    featureName: 'UARPGInventoryComponent',
    moduleId: 'arpg-inventory',
    check: (m) =>
      matched(
        m.blueprints.filter((bp) =>
          bp.addedComponents.some((c) => lower(c.componentClass).includes('inventory')),
        ),
      ),
  },
  {
    featureName: 'UARPGItemDefinition',
    moduleId: 'arpg-inventory',
    check: (m) =>
      matched(
        m.dataTables.filter(
          (dt) => lower(dt.rowStruct).includes('item') || lower(dt.path).includes('item'),
        ),
      ),
  },
  {
    // Formerly 'Equipment slots'.
    featureName: 'Equipment slot system',
    moduleId: 'arpg-inventory',
    check: (m) =>
      matched([
        ...m.dataTables.filter(
          (dt) => lower(dt.rowStruct).includes('equipment') || lower(dt.path).includes('equipment'),
        ),
        ...m.blueprints.filter(
          (bp) => lower(bp.path).includes('equipment') && lower(bp.path).includes('slot'),
        ),
      ]),
  },

  // ── arpg-loot ───────────────────────────────────────────────────────────────

  {
    // Formerly 'Loot table data'.
    featureName: 'UARPGLootTable',
    moduleId: 'arpg-loot',
    check: (m) =>
      matched(
        m.dataTables.filter(
          (dt) => lower(dt.rowStruct).includes('loot') || lower(dt.path).includes('loot'),
        ),
      ),
  },
  {
    // Formerly 'Drop component'. A loot/drop component is the mechanism, not proof
    // it rolls on death: capped at partial.
    featureName: 'Loot drop on death',
    moduleId: 'arpg-loot',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) =>
            bp.addedComponents.some(
              (c) =>
                lower(c.componentClass).includes('loot') || lower(c.componentClass).includes('drop'),
            ) ||
            (lower(bp.path).includes('loot') && lower(bp.path).includes('drop')),
        ),
        'partial',
      ),
  },

  // ── materials ───────────────────────────────────────────────────────────────

  {
    // Replaces 'Base material library' / 'Material instances' / 'Parameterized
    // materials' (none declared): a master material is a parameterized parent that
    // instances derive from.
    featureName: 'Master material',
    moduleId: 'materials',
    check: (m) => {
      const masters = m.materials.filter(
        (mat) => mat.parameters.length > 0 && mat.materialInstances.length > 0,
      );
      if (masters.length > 0) return { status: 'implemented', evidence: masters.map((mat) => mat.path) };
      return matched(
        m.materials.filter((mat) => mat.parameters.length > 0 || mat.materialInstances.length > 0),
        'partial',
      );
    },
  },

  // ── arpg-ui ─────────────────────────────────────────────────────────────────

  {
    featureName: 'Main HUD widget',
    moduleId: 'arpg-ui',
    check: (m) =>
      matched(m.blueprints.filter((bp) => lower(bp.path).includes('hud') || bp.path.includes('WBP_'))),
  },
  {
    // Formerly 'Health bar widget'. Only an ENEMY health bar widget is the declared
    // feature; any other health bar widget is partial evidence.
    featureName: 'Enemy health bars',
    moduleId: 'arpg-ui',
    check: (m) => {
      const bars = m.blueprints.filter(
        (bp) =>
          lower(bp.path).includes('health') &&
          (bp.path.includes('WBP_') || lower(bp.path).includes('widget') || lower(bp.path).includes('bar')),
      );
      const enemy = bars.filter((bp) => lower(bp.path).includes('enemy'));
      return enemy.length > 0 ? matched(enemy) : matched(bars, 'partial');
    },
  },
  {
    // Formerly 'Inventory UI'.
    featureName: 'Inventory screen',
    moduleId: 'arpg-ui',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) =>
            lower(bp.path).includes('inventory') &&
            (bp.path.includes('WBP_') ||
              lower(bp.path).includes('widget') ||
              lower(bp.path).includes('screen')),
        ),
      ),
  },

  // ── arpg-progression ────────────────────────────────────────────────────────

  {
    // Formerly 'Experience / leveling data'.
    featureName: 'XP curve table',
    moduleId: 'arpg-progression',
    check: (m) =>
      matched(
        m.dataTables.filter(
          (dt) =>
            lower(dt.rowStruct).includes('experience') ||
            lower(dt.rowStruct).includes('level') ||
            lower(dt.path).includes('xp') ||
            lower(dt.path).includes('level'),
        ),
      ),
  },
  {
    // Formerly 'Skill tree / talent data'. Skill data is what the unlock system
    // spends points on, not the system itself: capped at partial.
    featureName: 'Ability unlock system',
    moduleId: 'arpg-progression',
    check: (m) =>
      matched(
        [
          ...m.dataTables.filter(
            (dt) =>
              ['skill', 'talent'].some(
                (k) => lower(dt.rowStruct).includes(k) || lower(dt.path).includes(k),
              ),
          ),
          ...m.blueprints.filter(
            (bp) => lower(bp.path).includes('skill') && lower(bp.path).includes('tree'),
          ),
        ],
        'partial',
      ),
  },

  // ── level-design ────────────────────────────────────────────────────────────

  {
    // Formerly 'Level streaming volumes'.
    featureName: 'Level streaming setup',
    moduleId: 'level-design',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) =>
            lower(bp.path).includes('streaming') ||
            bp.addedComponents.some((c) => lower(c.componentClass).includes('levelstreaming')),
        ),
      ),
  },

  // ── arpg-world ──────────────────────────────────────────────────────────────

  {
    // Moved from level-design: the zone plan (Town, Forest, Ruins, …) is declared
    // under arpg-world.
    featureName: 'Zone layout design',
    moduleId: 'arpg-world',
    check: (m) =>
      tiered(
        m.otherAssets.filter(
          (a) => a.assetClass === 'World' || a.path.endsWith('.umap') || a.assetClass.includes('Map'),
        ),
        3,
      ),
  },
  {
    // Formerly 'Interactable base class'. An interactable base is the foundation
    // the chests/doors/NPC points build on: capped at partial.
    featureName: 'Interactive world objects',
    moduleId: 'arpg-world',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) =>
            lower(bp.path).includes('interact') &&
            (lower(bp.path).includes('base') ||
              bp.interfaces.some((i) => lower(i).includes('interact'))),
        ),
        'partial',
      ),
  },
  {
    // Formerly 'Spawn points / volumes'. A spawn point class is not a placement
    // per zone: capped at partial.
    featureName: 'Enemy spawn placement',
    moduleId: 'arpg-world',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) =>
            lower(bp.path).includes('spawn') &&
            (lower(bp.path).includes('point') || lower(bp.path).includes('volume')),
        ),
        'partial',
      ),
  },

  // ── arpg-save ───────────────────────────────────────────────────────────────

  {
    // Formerly 'Save game object'.
    featureName: 'UARPGSaveGame',
    moduleId: 'arpg-save',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) => bp.parentCppClass.includes('SaveGame') || lower(bp.path).includes('savegame'),
        ),
      ),
  },
  {
    // Formerly 'Save/load subsystem'. A save subsystem is where the save function
    // lives, not proof it gathers every system's state: capped at partial.
    featureName: 'Save function',
    moduleId: 'arpg-save',
    check: (m) =>
      matched(
        m.blueprints.filter(
          (bp) => bp.parentCppClass.includes('GameInstanceSubsystem') && lower(bp.path).includes('save'),
        ),
        'partial',
      ),
  },

  // ── audio ───────────────────────────────────────────────────────────────────

  {
    // Formerly 'Sound cue library' (cues + waves + MetaSounds). Only MetaSound
    // assets speak to the declared feature.
    featureName: 'MetaSounds integration',
    moduleId: 'audio',
    check: (m) => matched(m.otherAssets.filter((a) => a.assetClass.includes('MetaSound'))),
  },

  // ── models ──────────────────────────────────────────────────────────────────

  {
    // Formerly 'Skeletal mesh assets'.
    featureName: 'Skeletal mesh import',
    moduleId: 'models',
    check: (m) =>
      tiered(
        m.otherAssets.filter(
          (a) => a.assetClass.includes('SkeletalMesh') || a.assetClass.includes('Skeleton'),
        ),
        3,
      ),
  },
  {
    // Formerly 'Static mesh library'.
    featureName: 'Static mesh import pipeline',
    moduleId: 'models',
    check: (m) => tiered(m.otherAssets.filter((a) => a.assetClass.includes('StaticMesh')), 10, 3),
  },
];
