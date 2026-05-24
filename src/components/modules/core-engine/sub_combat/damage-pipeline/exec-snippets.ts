/**
 * UE5 C++ snippets shown in the ExecutionBreakdownPanel.
 * Extracted from ExecutionBreakdownPanel.tsx to keep the .tsx under 200 LOC.
 */

export const EXEC_SNIPPETS = {
  invuln: `const UAbilitySystemComponent* TargetASC = ExecutionParams.GetTargetAbilitySystemComponent();
if (TargetASC && TargetASC->HasMatchingGameplayTag(ARPGGameplayTags::State_Invulnerable))
{
    return; // Skip all damage
}`,
  ap: `float AttackPower = 0.f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().AttackPowerDef, FAggregatorEvaluateParameters(), AttackPower);`,
  cc: `float CriticalChance = 0.f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().CriticalChanceDef, FAggregatorEvaluateParameters(), CriticalChance);`,
  cd: `float CriticalDamage = 1.5f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().CriticalDamageDef, FAggregatorEvaluateParameters(), CriticalDamage);`,
  armor: `float Armor = 0.f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().ArmorDef, FAggregatorEvaluateParameters(), Armor);`,
  base: `const float BaseDamage = Spec.GetSetByCallerMagnitude(
    ARPGGameplayTags::Data_Damage_Base, /*WarnIfNotFound=*/ true, /*DefaultIfNotFound=*/ 0.f);`,
  scaling: `const float Scaling = Spec.GetSetByCallerMagnitude(
    ARPGGameplayTags::Data_Damage_Scaling, /*WarnIfNotFound=*/ false, /*DefaultIfNotFound=*/ 1.f);`,
  raw: 'const float RawDamage = BaseDamage + AttackPower * Scaling;',
  crit: `const bool bIsCrit = FMath::FRand() < CriticalChance;
const float CritMultiplier = bIsCrit ? (1.f + CriticalDamage) : 1.f;`,
  ar: 'const float ArmorReduction = Armor / (Armor + 100.f);',
  final: `float FinalDamage = RawDamage * CritMultiplier * (1.f - ArmorReduction);
FinalDamage = FMath::Max(FinalDamage, 0.f);`,
  outcrit: `OutExecutionOutput.AddOutputModifier(FGameplayModifierEvaluatedData(
    UARPGAttributeSet::GetIncomingCritAttribute(),
    EGameplayModOp::Override,
    bIsCrit ? 1.f : 0.f));`,
  outdmg: `OutExecutionOutput.AddOutputModifier(FGameplayModifierEvaluatedData(
    UARPGAttributeSet::GetIncomingDamageAttribute(),
    EGameplayModOp::Additive,
    FinalDamage));`,
} as const;
