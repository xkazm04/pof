/**
 * Semantic expectations for checklist items.
 *
 * Maps checklist item IDs to the C++ class members they should produce.
 * Used by the file watcher's semantic verification to distinguish
 * full implementations from hollow stubs.
 *
 * Only items that create concrete classes need entries here.
 * Items that are purely conceptual (e.g., "tune movement feel") are skipped.
 *
 * Checklist ids are NOT unique across modules (arpg-inventory and ai-behavior both
 * define ai-1 / ai-3), so every entry names its owner `moduleId`; look up with
 * `getExpectationsFor(moduleId, itemId)`. The auto-verify trigger index
 * (`checklist-verify-index.ts`) is derived from this table.
 */

import type { SemanticExpectation } from './cpp-semantic-parser';
import { SAVE_GAME_CLASS, saveGamePropertyNames } from '@/lib/save-schema/fields';
import type { SubModuleId } from '@/types/modules';

export interface ChecklistExpectation {
  /** The module whose checklist owns this item id (ids repeat across modules). */
  moduleId: SubModuleId;
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
    moduleId: 'arpg-character',
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
    moduleId: 'arpg-character',
    primary: {
      className: 'AARPGCharacterBase',
      expectedProperties: ['Stamina', 'MaxWalkSpeed', 'bIsSprinting'],
      minBodyLines: 10,
    },
  },
  'ac-3': {
    moduleId: 'arpg-character',
    primary: {
      className: 'AARPGCharacterBase',
      expectedProperties: ['bIsInvulnerable', 'DodgeCooldown'],
      minBodyLines: 10,
    },
  },
  'ac-4': {
    moduleId: 'arpg-character',
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
    moduleId: 'arpg-animation',
    primary: {
      className: 'UARPGAnimInstance',
      baseClass: 'UAnimInstance',
      expectedProperties: ['Speed', 'Direction', 'bIsInAir'],
      expectedFunctions: ['NativeUpdateAnimation'],
      minBodyLines: 5,
    },
  },
  'aa-5': {
    moduleId: 'arpg-animation',
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
    moduleId: 'arpg-animation',
    primary: {
      className: 'UAnimAssetCommandlet',
      baseClass: 'UCommandlet',
      expectedFunctions: ['Main'],
      minBodyLines: 20,
    },
  },

  // ── arpg-gas ──────────────────────────────────────────────────────────────
  'ag-1': {
    moduleId: 'arpg-gas',
    primary: {
      className: 'AARPGCharacterBase',
      expectedComponents: ['UAbilitySystemComponent'],
      minBodyLines: 10,
    },
  },
  'ag-2': {
    moduleId: 'arpg-gas',
    primary: {
      className: 'UARPGAttributeSet',
      baseClass: 'UAttributeSet',
      expectedProperties: ['Health', 'Mana', 'Strength'],
      minBodyLines: 8,
    },
  },
  'ag-4': {
    moduleId: 'arpg-gas',
    primary: {
      className: 'UARPGGameplayAbility',
      baseClass: 'UGameplayAbility',
      minBodyLines: 5,
    },
  },

  // ── arpg-combat ───────────────────────────────────────────────────────────
  'acb-1': {
    moduleId: 'arpg-combat',
    primary: {
      className: 'UGA_MeleeAttack',
      baseClass: 'UARPGGameplayAbility',
      minBodyLines: 5,
    },
  },

  // ── arpg-enemy-ai ─────────────────────────────────────────────────────────
  'ae-1': {
    moduleId: 'arpg-enemy-ai',
    primary: {
      className: 'AARPGAIController',
      baseClass: 'AAIController',
      expectedComponents: ['UAIPerceptionComponent'],
      minBodyLines: 5,
    },
  },
  'ae-2': {
    moduleId: 'arpg-enemy-ai',
    primary: {
      className: 'AARPGEnemyCharacter',
      baseClass: 'AARPGCharacterBase',
      expectedComponents: ['UAbilitySystemComponent'],
      minBodyLines: 5,
    },
  },

  // ── arpg-inventory ────────────────────────────────────────────────────────
  'ai-1': {
    moduleId: 'arpg-inventory',
    primary: {
      className: 'UARPGItemDefinition',
      baseClass: 'UPrimaryDataAsset',
      expectedProperties: ['ItemName', 'ItemType', 'Rarity'],
      minBodyLines: 5,
    },
  },
  'ai-3': {
    moduleId: 'arpg-inventory',
    primary: {
      className: 'UARPGInventoryComponent',
      baseClass: 'UActorComponent',
      expectedProperties: ['Items', 'MaxSlots'],
      minBodyLines: 8,
    },
  },

  // ── arpg-loot ─────────────────────────────────────────────────────────────
  'al-1': {
    moduleId: 'arpg-loot',
    primary: {
      className: 'UARPGLootTable',
      baseClass: 'UDataAsset',
      minBodyLines: 5,
    },
  },

  // ── arpg-ui ───────────────────────────────────────────────────────────────
  'au-1': {
    moduleId: 'arpg-ui',
    primary: {
      className: 'UARPGMainHUD',
      expectedProperties: ['HealthBar', 'ManaBar'],
      minBodyLines: 5,
    },
  },

  // ── arpg-save ─────────────────────────────────────────────────────────────
  // Derived from the one save-field authority — the same set the as-1 prompt asks
  // for and the save-points State Schema declares.
  'as-1': {
    moduleId: 'arpg-save',
    primary: {
      className: SAVE_GAME_CLASS,
      baseClass: 'USaveGame',
      expectedProperties: saveGamePropertyNames(),
      minBodyLines: 5,
    },
  },
};

/**
 * Get expectations for a checklist item by bare id, if any — ignores the owner.
 * Prefer `getExpectationsFor(moduleId, itemId)`: a bare id cannot tell
 * ai-behavior::ai-1 from arpg-inventory::ai-1.
 */
export function getExpectationsForItem(itemId: string): ChecklistExpectation | null {
  return CHECKLIST_EXPECTATIONS[itemId] ?? null;
}

/**
 * Get expectations for one module's checklist item. Null when the id has no entry
 * or the entry belongs to another module.
 */
export function getExpectationsFor(moduleId: string, itemId: string): ChecklistExpectation | null {
  const entry = Object.prototype.hasOwnProperty.call(CHECKLIST_EXPECTATIONS, itemId)
    ? CHECKLIST_EXPECTATIONS[itemId]
    : undefined;
  return entry && entry.moduleId === moduleId ? entry : null;
}
