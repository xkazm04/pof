/**
 * Ability Forge — prompt template for AI-powered ability generation.
 *
 * Takes a natural-language ability description and generates a complete
 * GA_* class skeleton with GAS boilerplate, tag grants/blocks, cooldown GE,
 * and animation montage references.
 *
 * Uses COMBO_ABILITIES and buildLiveAbilityRadar() data as few-shot context
 * so the LLM can match existing code style and tag conventions.
 */

import type { ComboAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook.data';

/* ── Tag registry from ARPGGameplayTags.h ─────────────────────────────── */

const KNOWN_TAGS = {
  ability: [
    'Ability_Melee_LightAttack', 'Ability_Melee_HeavyAttack',
    'Ability_Ranged_Fireball', 'Ability_Dodge', 'Ability_Charge',
    'Ability_Fireball', 'Ability_GroundSlam', 'Ability_DashStrike', 'Ability_WarCry',
  ],
  state: [
    'State_Dead', 'State_Stunned', 'State_Invulnerable',
    'State_Attacking', 'State_Charging', 'State_Vulnerable',
    'State_Buffed_WarCry', 'State_Dashing',
  ],
  damage: ['Damage_Physical', 'Damage_Fire', 'Damage_Ice', 'Damage_Lightning'],
  data: [
    'Data_Damage_Base', 'Data_Damage_Scaling', 'Data_ManaCost',
    'Data_DifficultyMultiplier', 'Data_Affix_Magnitude',
  ],
  event: [
    'Event_EnemyKilled', 'Event_Combo_Open', 'Event_Combo_Close',
    'Event_Combo_Input', 'Event_MeleeHit', 'Event_HitReact', 'Event_Death',
  ],
  cooldown: [
    'Cooldown_Potion', 'Cooldown_Fireball', 'Cooldown_GroundSlam',
    'Cooldown_DashStrike', 'Cooldown_WarCry',
  ],
} as const;

/* ── Few-shot: GA_DashStrike as reference (abbreviated for prompt) ───── */

const FEW_SHOT_HEADER = `// --- REFERENCE: GA_DashStrike.h ---
#pragma once
#include "CoreMinimal.h"
#include "AbilitySystem/ARPGGameplayAbility.h"
#include "GA_DashStrike.generated.h"

class UAnimMontage;
class UGameplayEffect;
class UNiagaraSystem;

UCLASS()
class POF_API UGA_DashStrike : public UARPGGameplayAbility
{
  GENERATED_BODY()
public:
  UGA_DashStrike();
  virtual void ActivateAbility(...) override;
  virtual void EndAbility(...) override;
protected:
  UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="DashStrike")
  TObjectPtr<UAnimMontage> DashMontage;
  UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="DashStrike|Damage")
  TSubclassOf<UGameplayEffect> DamageEffect;
  UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="DashStrike|Damage")
  float BaseDamage = 40.f;
  UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="DashStrike|Dash", meta=(ClampMin="100"))
  float DashDistance = 800.f;
  UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="DashStrike|Dash", meta=(ClampMin="50"))
  float SweepRadius = 150.f;
  UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="DashStrike|MotionWarping")
  FName WarpTargetName = TEXT("DashTarget");
  UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="DashStrike|VFX")
  TObjectPtr<UNiagaraSystem> DashVFX;
private:
  FVector DashStartLocation = FVector::ZeroVector;
  UFUNCTION() void OnMontageCompleted();
  UFUNCTION() void OnMontageInterrupted();
  UFUNCTION() void OnImpactEvent(FGameplayEventData Payload);
  void PerformSweepDamage();
};`;

const FEW_SHOT_CPP = `// --- REFERENCE: GA_DashStrike.cpp (constructor + ActivateAbility) ---
UGA_DashStrike::UGA_DashStrike()
{
  bAutoEndAbility = false;
  SetAssetTags(FGameplayTagContainer(ARPGGameplayTags::Ability_DashStrike));
  ActivationOwnedTags.AddTag(ARPGGameplayTags::State_Dashing);
  ActivationBlockedTags.AddTag(ARPGGameplayTags::State_Attacking);
  ActivationBlockedTags.AddTag(ARPGGameplayTags::State_Dashing);
  AbilityManaCost = 25.f;
  CooldownGameplayEffectClass = UGE_Cooldown_DashStrike::StaticClass();
  AbilityCooldownTag = ARPGGameplayTags::Cooldown_DashStrike;
}

void UGA_DashStrike::ActivateAbility(...)
{
  if (!CommitAbility(Handle, ActorInfo, ActivationInfo)) { EndAbility(...); return; }
  AARPGCharacterBase* Character = GetARPGCharacter();
  if (!Character) { EndAbility(...); return; }
  Character->SetAttacking(true);
  // Determine direction, set motion warp target, spawn VFX, play montage
  // Wait for Event_MeleeHit then PerformSweepDamage()
}`;

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatComboAbilities(abilities: ComboAbility[]): string {
  return abilities.map(a =>
    `  ${a.name}: damage=${a.damage}, mana=${a.manaCost}, cd=${a.cooldown}s, ` +
    `anim=${a.animDuration}s, dmgWindow=[${a.damageWindow.join(',')}], ` +
    `recovery=${a.recovery}s, tag=${a.tag}, type=${a.damageType}`
  ).join('\n');
}

function formatRadarData(radar: { name: string; values: number[] }[]): string {
  const axes = ['Damage', 'Range', 'AOE', 'Speed', 'Efficiency'];
  return radar.map(r =>
    `  ${r.name}: ${axes.map((ax, i) => `${ax}=${r.values[i]}`).join(', ')}`
  ).join('\n');
}

/* ── Exported types ──────────────────────────────────────────────────── */

export interface ForgeInput {
  description: string;
  comboAbilities: ComboAbility[];
  radarData: { name: string; values: number[] }[];
}

export interface ForgedAbility {
  className: string;
  displayName: string;
  description: string;
  headerCode: string;
  cppCode: string;
  tags: {
    abilityTag: string;
    cooldownTag: string;
    ownedTags: string[];
    blockedTags: string[];
  };
  stats: {
    baseDamage: number;
    manaCost: number;
    cooldownSec: number;
    damageType: string;
  };
  comboEntry: {
    animDuration: number;
    damageWindow: [number, number];
    recovery: number;
    comboMultiplier: number;
  };
  radarValues: number[]; // [Damage, Range, AOE, Speed, Efficiency] 0-1
}

/* ── Prompt builder ──────────────────────────────────────────────────── */

export function buildAbilityForgePrompt(input: ForgeInput): string {
  const tagRegistry = Object.entries(KNOWN_TAGS)
    .map(([cat, tags]) => `  ${cat}: ${tags.join(', ')}`)
    .join('\n');

  return `You are an expert UE5 C++ Gameplay Ability System (GAS) developer for the PoF ARPG project.

## Task: Generate a GameplayAbility Class

Given the following natural-language description, generate a complete GA_* class (header + cpp) that follows the existing project conventions.

### User's Ability Description
"${input.description}"

## Existing Project Context

### Tag Registry (ARPGGameplayTags.h)
${tagRegistry}

### Existing Abilities (for reference on timing, damage, and costs)
${formatComboAbilities(input.comboAbilities)}

### Ability Radar Profiles (normalized 0-1)
${formatRadarData(input.radarData)}

## Few-Shot Examples

${FEW_SHOT_HEADER}

${FEW_SHOT_CPP}

## Output Format

Return ONLY a JSON object (no markdown fences) with this exact shape:

{
  "className": "GA_<PascalCaseName>",
  "displayName": "<Human readable name>",
  "description": "<One sentence describing what the ability does>",
  "headerCode": "<Complete .h file content>",
  "cppCode": "<Complete .cpp file content>",
  "tags": {
    "abilityTag": "Ability_<Name>",
    "cooldownTag": "Cooldown_<Name>",
    "ownedTags": ["State_<...>"],
    "blockedTags": ["State_<...>"]
  },
  "stats": {
    "baseDamage": <number>,
    "manaCost": <number>,
    "cooldownSec": <number>,
    "damageType": "Physical|Fire|Ice|Lightning|None"
  },
  "comboEntry": {
    "animDuration": <seconds>,
    "damageWindow": [<startSec>, <endSec>],
    "recovery": <seconds>,
    "comboMultiplier": <1.0-2.0>
  },
  "radarValues": [<Damage 0-1>, <Range 0-1>, <AOE 0-1>, <Speed 0-1>, <Efficiency 0-1>]
}

## Rules
1. The class MUST extend UARPGGameplayAbility (include "AbilitySystem/ARPGGameplayAbility.h")
2. Constructor MUST set: SetAssetTags, ActivationOwnedTags, ActivationBlockedTags, AbilityManaCost, CooldownGameplayEffectClass, AbilityCooldownTag
3. State_Dead and State_Stunned MUST always be in ActivationBlockedTags
4. Use SetByCaller with Data_Damage_Base for damage, not hardcoded GE magnitudes
5. Follow the exact UPROPERTY pattern: EditDefaultsOnly + BlueprintReadOnly + Category
6. If new tags are needed, use the existing naming convention (Ability_*, State_*, Cooldown_*, etc.)
7. Include motion warping setup if the ability involves movement
8. Include VFX (UNiagaraSystem) and montage (UAnimMontage) as UPROPERTY slots
9. Radar values should be consistent with existing abilities (e.g. pure buff = 0 damage, high speed)
10. ComboEntry timing should be realistic (animDuration 0.4-1.5s, recovery 0.1-0.5s)`;
}
