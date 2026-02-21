import type { VerificationRule, AssetManifest } from '@/types/pof-bridge';

/**
 * Verification rules that check the UE5 asset manifest for evidence
 * of implemented features. Used by the verification engine to
 * auto-update the Feature Matrix.
 *
 * Each rule maps a featureName + moduleId pair to a check function that
 * inspects the manifest and returns a FeatureStatus.
 */
export const VERIFICATION_RULES: VerificationRule[] = [
  // ── arpg-character ──────────────────────────────────────────────────────────

  {
    featureName: 'AARPGCharacterBase',
    moduleId: 'arpg-character',
    check: (m: AssetManifest) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.parentCppClass.includes('ARPGCharacterBase') ||
          (bp.path.toLowerCase().includes('character') &&
            bp.path.toLowerCase().includes('base')),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'AARPGPlayerCharacter',
    moduleId: 'arpg-character',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('player') &&
          bp.path.toLowerCase().includes('character'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Enhanced Input actions',
    moduleId: 'arpg-character',
    check: (m) => {
      const inputAssets = m.otherAssets.filter(
        (a) => a.assetClass.includes('InputAction') || a.path.includes('IA_'),
      );
      if (inputAssets.length >= 5) return 'implemented';
      if (inputAssets.length >= 2) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Input Mapping Context',
    moduleId: 'arpg-character',
    check: (m) => {
      const found = m.otherAssets.some(
        (a) =>
          a.assetClass.includes('InputMappingContext') || a.path.includes('IMC_'),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── arpg-gas ────────────────────────────────────────────────────────────────

  {
    featureName: 'AbilitySystemComponent',
    moduleId: 'arpg-gas',
    check: (m) => {
      const found = m.blueprints.some((bp) =>
        bp.addedComponents.some((c) =>
          c.componentClass.includes('AbilitySystem'),
        ),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Core AttributeSet',
    moduleId: 'arpg-gas',
    check: (m) => {
      const found = m.blueprints.some((bp) =>
        bp.parentCppClass.includes('AttributeSet'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Gameplay Abilities',
    moduleId: 'arpg-gas',
    check: (m) => {
      const abilities = m.blueprints.filter((bp) =>
        bp.parentCppClass.includes('GameplayAbility'),
      );
      if (abilities.length >= 3) return 'implemented';
      if (abilities.length >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Gameplay Effects',
    moduleId: 'arpg-gas',
    check: (m) => {
      const effects = m.blueprints.filter(
        (bp) =>
          bp.parentCppClass.includes('GameplayEffect') ||
          bp.path.includes('GE_'),
      );
      if (effects.length >= 3) return 'implemented';
      if (effects.length >= 1) return 'partial';
      return 'missing';
    },
  },

  // ── arpg-animation ──────────────────────────────────────────────────────────

  {
    featureName: 'Animation state machine',
    moduleId: 'arpg-animation',
    check: (m) => {
      const abps = m.animAssets.filter((a) => a.assetType === 'AnimBlueprint');
      const withSM = abps.filter(
        (a) => a.stateMachines && a.stateMachines.length > 0,
      );
      if (withSM.length > 0) {
        const totalStates = withSM.reduce(
          (sum, a) =>
            sum +
            (a.stateMachines?.reduce((s, sm) => s + sm.states.length, 0) ?? 0),
          0,
        );
        return totalStates >= 3 ? 'implemented' : 'partial';
      }
      return 'missing';
    },
  },
  {
    featureName: 'Attack montages',
    moduleId: 'arpg-animation',
    check: (m) => {
      const montages = m.animAssets.filter(
        (a) =>
          a.assetType === 'AnimMontage' &&
          (a.path.toLowerCase().includes('attack') ||
            a.path.toLowerCase().includes('combo')),
      );
      if (montages.length >= 3) return 'implemented';
      if (montages.length >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Anim Notify classes',
    moduleId: 'arpg-animation',
    check: (m) => {
      const withNotifies = m.animAssets.filter(
        (a) => a.notifies && a.notifies.length > 0,
      );
      const uniqueClasses = new Set(
        withNotifies.flatMap((a) => a.notifies?.map((n) => n.notifyClass) ?? []),
      );
      if (uniqueClasses.size >= 3) return 'implemented';
      if (uniqueClasses.size >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Blend Spaces',
    moduleId: 'arpg-animation',
    check: (m) => {
      const blendSpaces = m.animAssets.filter(
        (a) => a.assetType === 'BlendSpace',
      );
      if (blendSpaces.length >= 2) return 'implemented';
      if (blendSpaces.length >= 1) return 'partial';
      return 'missing';
    },
  },

  // ── arpg-combat ─────────────────────────────────────────────────────────────

  {
    featureName: 'Melee attack ability',
    moduleId: 'arpg-combat',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.parentCppClass.includes('GameplayAbility') &&
          (bp.path.toLowerCase().includes('melee') ||
            bp.path.toLowerCase().includes('attack')),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Hit detection',
    moduleId: 'arpg-combat',
    check: (m) => {
      const hitNotifies = m.animAssets.some((a) =>
        a.notifies?.some(
          (n) =>
            n.notifyClass.toLowerCase().includes('hit') ||
            n.notifyClass.toLowerCase().includes('trace') ||
            n.notifyClass.toLowerCase().includes('damage'),
        ),
      );
      return hitNotifies ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Damage Gameplay Effect',
    moduleId: 'arpg-combat',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.parentCppClass.includes('GameplayEffect') &&
          bp.path.toLowerCase().includes('damage'),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── arpg-enemy-ai ───────────────────────────────────────────────────────────

  {
    featureName: 'AARPGEnemyCharacter',
    moduleId: 'arpg-enemy-ai',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('enemy') &&
          bp.path.toLowerCase().includes('character'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Behavior Tree',
    moduleId: 'arpg-enemy-ai',
    check: (m) => {
      const found = m.otherAssets.some(
        (a) =>
          a.assetClass.includes('BehaviorTree') || a.path.includes('BT_'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Blackboard',
    moduleId: 'arpg-enemy-ai',
    check: (m) => {
      const found = m.otherAssets.some(
        (a) =>
          a.assetClass.includes('BlackboardData') || a.path.includes('BB_'),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── arpg-inventory ──────────────────────────────────────────────────────────

  {
    featureName: 'UARPGInventoryComponent',
    moduleId: 'arpg-inventory',
    check: (m) => {
      const found = m.blueprints.some((bp) =>
        bp.addedComponents.some((c) =>
          c.componentClass.toLowerCase().includes('inventory'),
        ),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'UARPGItemDefinition',
    moduleId: 'arpg-inventory',
    check: (m) => {
      const found = m.dataTables.some(
        (dt) =>
          dt.rowStruct.toLowerCase().includes('item') ||
          dt.path.toLowerCase().includes('item'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Equipment slots',
    moduleId: 'arpg-inventory',
    check: (m) => {
      const found =
        m.dataTables.some(
          (dt) =>
            dt.rowStruct.toLowerCase().includes('equipment') ||
            dt.path.toLowerCase().includes('equipment'),
        ) ||
        m.blueprints.some(
          (bp) =>
            bp.path.toLowerCase().includes('equipment') &&
            bp.path.toLowerCase().includes('slot'),
        );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── arpg-loot ───────────────────────────────────────────────────────────────

  {
    featureName: 'Loot table data',
    moduleId: 'arpg-loot',
    check: (m) => {
      const found = m.dataTables.some(
        (dt) =>
          dt.rowStruct.toLowerCase().includes('loot') ||
          dt.path.toLowerCase().includes('loot'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Drop component',
    moduleId: 'arpg-loot',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.addedComponents.some(
            (c) =>
              c.componentClass.toLowerCase().includes('loot') ||
              c.componentClass.toLowerCase().includes('drop'),
          ) ||
          (bp.path.toLowerCase().includes('loot') &&
            bp.path.toLowerCase().includes('drop')),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── materials ───────────────────────────────────────────────────────────────

  {
    featureName: 'Base material library',
    moduleId: 'materials',
    check: (m) => {
      if (m.materials.length >= 5) return 'implemented';
      if (m.materials.length >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Material instances',
    moduleId: 'materials',
    check: (m) => {
      const totalInstances = m.materials.reduce(
        (sum, mat) => sum + mat.materialInstances.length,
        0,
      );
      if (totalInstances >= 5) return 'implemented';
      if (totalInstances >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Parameterized materials',
    moduleId: 'materials',
    check: (m) => {
      const withParams = m.materials.filter((mat) => mat.parameters.length > 0);
      if (withParams.length >= 3) return 'implemented';
      if (withParams.length >= 1) return 'partial';
      return 'missing';
    },
  },

  // ── arpg-ui ─────────────────────────────────────────────────────────────────

  {
    featureName: 'Main HUD widget',
    moduleId: 'arpg-ui',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('hud') || bp.path.includes('WBP_'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Health bar widget',
    moduleId: 'arpg-ui',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('health') &&
          (bp.path.includes('WBP_') ||
            bp.path.toLowerCase().includes('widget') ||
            bp.path.toLowerCase().includes('bar')),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Inventory UI',
    moduleId: 'arpg-ui',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('inventory') &&
          (bp.path.includes('WBP_') ||
            bp.path.toLowerCase().includes('widget') ||
            bp.path.toLowerCase().includes('screen')),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── arpg-progression ────────────────────────────────────────────────────────

  {
    featureName: 'Experience / leveling data',
    moduleId: 'arpg-progression',
    check: (m) => {
      const found = m.dataTables.some(
        (dt) =>
          dt.rowStruct.toLowerCase().includes('experience') ||
          dt.rowStruct.toLowerCase().includes('level') ||
          dt.path.toLowerCase().includes('xp') ||
          dt.path.toLowerCase().includes('level'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Skill tree / talent data',
    moduleId: 'arpg-progression',
    check: (m) => {
      const found =
        m.dataTables.some(
          (dt) =>
            dt.rowStruct.toLowerCase().includes('skill') ||
            dt.rowStruct.toLowerCase().includes('talent') ||
            dt.path.toLowerCase().includes('skill') ||
            dt.path.toLowerCase().includes('talent'),
        ) ||
        m.blueprints.some(
          (bp) =>
            bp.path.toLowerCase().includes('skill') &&
            bp.path.toLowerCase().includes('tree'),
        );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── level-design ────────────────────────────────────────────────────────────

  {
    featureName: 'Zone layout design',
    moduleId: 'level-design',
    check: (m) => {
      const maps = m.otherAssets.filter(
        (a) =>
          a.assetClass === 'World' ||
          a.path.endsWith('.umap') ||
          a.assetClass.includes('Map'),
      );
      if (maps.length >= 3) return 'implemented';
      if (maps.length >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Level streaming volumes',
    moduleId: 'level-design',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('streaming') ||
          bp.addedComponents.some((c) =>
            c.componentClass.toLowerCase().includes('levelstreaming'),
          ),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── arpg-world ──────────────────────────────────────────────────────────────

  {
    featureName: 'Interactable base class',
    moduleId: 'arpg-world',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('interact') &&
          (bp.path.toLowerCase().includes('base') ||
            bp.interfaces.some((i) => i.toLowerCase().includes('interact'))),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Spawn points / volumes',
    moduleId: 'arpg-world',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.path.toLowerCase().includes('spawn') &&
          (bp.path.toLowerCase().includes('point') ||
            bp.path.toLowerCase().includes('volume')),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── arpg-save ───────────────────────────────────────────────────────────────

  {
    featureName: 'Save game object',
    moduleId: 'arpg-save',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.parentCppClass.includes('SaveGame') ||
          bp.path.toLowerCase().includes('savegame'),
      );
      return found ? 'implemented' : 'missing';
    },
  },
  {
    featureName: 'Save/load subsystem',
    moduleId: 'arpg-save',
    check: (m) => {
      const found = m.blueprints.some(
        (bp) =>
          bp.parentCppClass.includes('GameInstanceSubsystem') &&
          bp.path.toLowerCase().includes('save'),
      );
      return found ? 'implemented' : 'missing';
    },
  },

  // ── audio ───────────────────────────────────────────────────────────────────

  {
    featureName: 'Sound cue library',
    moduleId: 'audio',
    check: (m) => {
      const soundAssets = m.otherAssets.filter(
        (a) =>
          a.assetClass.includes('SoundCue') ||
          a.assetClass.includes('SoundWave') ||
          a.assetClass.includes('MetaSound'),
      );
      if (soundAssets.length >= 5) return 'implemented';
      if (soundAssets.length >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Sound class hierarchy',
    moduleId: 'audio',
    check: (m) => {
      const soundClasses = m.otherAssets.filter(
        (a) =>
          a.assetClass.includes('SoundClass') ||
          a.assetClass.includes('SoundMix'),
      );
      if (soundClasses.length >= 2) return 'implemented';
      if (soundClasses.length >= 1) return 'partial';
      return 'missing';
    },
  },

  // ── models ──────────────────────────────────────────────────────────────────

  {
    featureName: 'Skeletal mesh assets',
    moduleId: 'models',
    check: (m) => {
      const skeletalMeshes = m.otherAssets.filter(
        (a) =>
          a.assetClass.includes('SkeletalMesh') ||
          a.assetClass.includes('Skeleton'),
      );
      if (skeletalMeshes.length >= 3) return 'implemented';
      if (skeletalMeshes.length >= 1) return 'partial';
      return 'missing';
    },
  },
  {
    featureName: 'Static mesh library',
    moduleId: 'models',
    check: (m) => {
      const staticMeshes = m.otherAssets.filter((a) =>
        a.assetClass.includes('StaticMesh'),
      );
      if (staticMeshes.length >= 10) return 'implemented';
      if (staticMeshes.length >= 3) return 'partial';
      return 'missing';
    },
  },
];
