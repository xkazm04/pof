/**
 * Semantic expectations for checklist items.
 *
 * Maps checklist item IDs to the C++ class members they should produce.
 * Used by the file watcher's semantic verification to distinguish
 * full implementations from hollow stubs.
 *
 * Only items that create concrete classes need entries here.
 * Items that are purely conceptual (e.g., "tune movement feel") are skipped.
 */

import type { SemanticExpectation } from './cpp-semantic-parser';

export interface ChecklistExpectation {
  /** Primary class to verify */
  primary: SemanticExpectation;
  /** Additional classes that should also exist for full completion */
  secondary?: SemanticExpectation[];
}

/**
 * Map of checklist item ID → semantic expectations.
 * Only items with verifiable C++ class outputs are included.
 */
export const CHECKLIST_EXPECTATIONS: Record<string, ChecklistExpectation> = {
  // ── arpg-character ────────────────────────────────────────────────────────
  'ac-1': {
    primary: {
      className: 'AARPGCharacterBase',
      baseClass: 'ACharacter',
      expectedComponents: ['UCharacterMovementComponent', 'USpringArmComponent', 'UCameraComponent'],
      expectedProperties: ['MaxWalkSpeed'],
      minBodyLines: 10,
    },
    secondary: [
      {
        className: 'AARPGPlayerController',
        baseClass: 'APlayerController',
        expectedProperties: ['InputMappingContext'],
        minBodyLines: 5,
      },
      {
        className: 'AARPGPlayerCharacter',
        baseClass: 'AARPGCharacterBase',
        minBodyLines: 3,
      },
    ],
  },
  'ac-2': {
    primary: {
      className: 'AARPGCharacterBase',
      expectedProperties: ['Stamina', 'MaxWalkSpeed', 'bIsSprinting'],
      minBodyLines: 10,
    },
  },
  'ac-3': {
    primary: {
      className: 'AARPGCharacterBase',
      expectedProperties: ['bIsInvulnerable', 'DodgeCooldown'],
      minBodyLines: 10,
    },
  },
  'ac-4': {
    primary: {
      className: 'AARPGGameMode',
      baseClass: 'AGameModeBase',
      expectedProperties: ['DefaultPawnClass'],
      minBodyLines: 3,
    },
    secondary: [
      {
        className: 'UARPGGameInstance',
        baseClass: 'UGameInstance',
        expectedProperties: ['PlayerLevel', 'TotalPlayTime'],
        minBodyLines: 3,
      },
    ],
  },

  // ── arpg-animation ────────────────────────────────────────────────────────
  'aa-1': {
    primary: {
      className: 'UARPGAnimInstance',
      baseClass: 'UAnimInstance',
      expectedProperties: ['Speed', 'Direction', 'bIsInAir'],
      expectedFunctions: ['NativeUpdateAnimation'],
      minBodyLines: 5,
    },
  },
  'aa-5': {
    primary: {
      className: 'UAnimNotify_ComboWindow',
      baseClass: 'UAnimNotify',
      minBodyLines: 3,
    },
    secondary: [
      {
        className: 'UAnimNotifyState_HitDetection',
        baseClass: 'UAnimNotifyState',
        minBodyLines: 5,
      },
      {
        className: 'UAnimNotify_SpawnVFX',
        baseClass: 'UAnimNotify',
        minBodyLines: 5,
      },
      {
        className: 'UAnimNotify_ARPGPlaySound',
        baseClass: 'UAnimNotify',
        minBodyLines: 3,
      },
    ],
  },

  // ── arpg-animation automation (PoFEditor module) ───────────────────────
  'aa-commandlet': {
    primary: {
      className: 'UAnimAssetCommandlet',
      baseClass: 'UCommandlet',
      expectedFunctions: ['Main'],
      minBodyLines: 20,
    },
  },

  // ── arpg-gas ──────────────────────────────────────────────────────────────
  'ag-1': {
    primary: {
      className: 'AARPGCharacterBase',
      expectedComponents: ['UAbilitySystemComponent'],
      minBodyLines: 10,
    },
  },
  'ag-2': {
    primary: {
      className: 'UARPGAttributeSet',
      baseClass: 'UAttributeSet',
      expectedProperties: ['Health', 'Mana', 'Strength'],
      minBodyLines: 8,
    },
  },
  'ag-4': {
    primary: {
      className: 'UARPGGameplayAbility',
      baseClass: 'UGameplayAbility',
      minBodyLines: 5,
    },
  },

  // ── arpg-combat ───────────────────────────────────────────────────────────
  'acm-1': {
    primary: {
      className: 'UGA_MeleeAttack',
      baseClass: 'UARPGGameplayAbility',
      minBodyLines: 5,
    },
  },

  // ── arpg-enemy-ai ─────────────────────────────────────────────────────────
  'ae-1': {
    primary: {
      className: 'AARPGAIController',
      baseClass: 'AAIController',
      expectedComponents: ['UAIPerceptionComponent'],
      minBodyLines: 5,
    },
  },
  'ae-2': {
    primary: {
      className: 'AARPGEnemyCharacter',
      baseClass: 'AARPGCharacterBase',
      expectedComponents: ['UAbilitySystemComponent'],
      minBodyLines: 5,
    },
  },

  // ── arpg-inventory ────────────────────────────────────────────────────────
  'ai-1': {
    primary: {
      className: 'UARPGItemDefinition',
      baseClass: 'UPrimaryDataAsset',
      expectedProperties: ['ItemName', 'ItemType', 'Rarity'],
      minBodyLines: 5,
    },
  },
  'ai-3': {
    primary: {
      className: 'UARPGInventoryComponent',
      baseClass: 'UActorComponent',
      expectedProperties: ['Items', 'MaxSlots'],
      minBodyLines: 8,
    },
  },

  // ── arpg-loot ─────────────────────────────────────────────────────────────
  'al-1': {
    primary: {
      className: 'UARPGLootTable',
      baseClass: 'UDataAsset',
      minBodyLines: 5,
    },
  },

  // ── arpg-ui ───────────────────────────────────────────────────────────────
  'au-1': {
    primary: {
      className: 'UARPGMainHUD',
      expectedProperties: ['HealthBar', 'ManaBar'],
      minBodyLines: 5,
    },
  },

  // ── arpg-save ─────────────────────────────────────────────────────────────
  'as-1': {
    primary: {
      className: 'UARPGSaveGame',
      baseClass: 'USaveGame',
      expectedProperties: ['PlayerLevel', 'InventoryData'],
      minBodyLines: 5,
    },
  },
};

/**
 * Get expectations for a checklist item, if any.
 * Returns null for items that don't have verifiable C++ class expectations.
 */
export function getExpectationsForItem(itemId: string): ChecklistExpectation | null {
  return CHECKLIST_EXPECTATIONS[itemId] ?? null;
}

/**
 * Get the set of class names we expect from all expectations.
 * Used to build the reverse map: className → itemId.
 */
export function buildClassToItemMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [itemId, exp] of Object.entries(CHECKLIST_EXPECTATIONS)) {
    map.set(exp.primary.className, itemId);
    for (const sec of exp.secondary ?? []) {
      // Only map secondary if not already mapped
      if (!map.has(sec.className)) {
        map.set(sec.className, itemId);
      }
    }
  }
  return map;
}
