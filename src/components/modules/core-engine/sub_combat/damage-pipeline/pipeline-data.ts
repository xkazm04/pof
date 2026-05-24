import type { PipelineNode } from './types';

// ── Three entry pipelines from PostGameplayEffectExecute ─────────────────────

export const DAMAGE_PIPELINE: PipelineNode[] = [
  { id: 'entry-dmg', label: 'IncomingDamage', detail: 'Meta attribute set by damage execution calculation', kind: 'entry', cppRef: 'Data.EvaluatedData.Attribute == GetIncomingDamageAttribute()' },
  { id: 'consume-meta', label: 'Consume Meta', detail: 'SetIncomingDamage(0) + SetIncomingCrit(0)', kind: 'action', cppRef: 'SetIncomingDamage(0.f); SetIncomingCrit(0.f);' },
  { id: 'check-crit', label: 'IncomingCrit > 0.5?', detail: 'Check if this hit was a critical strike', kind: 'branch', cppRef: 'const bool bIsCrit = GetIncomingCrit() > 0.5f;' },
  { id: 'sub-health', label: 'Health -= Damage', detail: 'Clamp(OldHealth - DamageAmount, 0, MaxHealth)', kind: 'action', cppRef: 'SetHealth(FMath::Clamp(OldHealth - DamageAmount, 0.f, GetMaxHealth()));' },
  { id: 'detect-type', label: 'Detect DamageType', detail: 'Read dynamic asset tags from EffectSpec', kind: 'branch', cppRef: 'const FGameplayTagContainer& AssetTags = Data.EffectSpec.GetDynamicAssetTags();' },
  { id: 'broadcast-dmg', label: 'Broadcast Damage Number', detail: 'Per-instance + global static delegate', kind: 'broadcast', cppRef: 'OnDamageNumberRequested.Broadcast(...); OnDamageNumberRequestedGlobal.Broadcast(...);' },
  { id: 'check-dead', label: 'Health <= 0?', detail: 'Branch: death vs hit react', kind: 'branch', cppRef: 'if (GetHealth() <= 0.f)' },
  { id: 'check-already-dead', label: 'Already State_Dead?', detail: 'Prevent duplicate death events', kind: 'branch', cppRef: 'const bool bAlreadyDead = OwnerASC->HasMatchingGameplayTag(ARPGGameplayTags::State_Dead);' },
  { id: 'health-depleted', label: 'OnHealthDepleted', detail: 'Broadcast delegate with Instigator', kind: 'event', cppRef: 'OnHealthDepleted.Broadcast(Instigator);' },
  { id: 'event-death', label: 'Event_Death', detail: 'HandleGameplayEvent with death payload', kind: 'terminal', cppRef: 'OwnerASC->HandleGameplayEvent(ARPGGameplayTags::Event_Death, &DeathPayload);' },
  { id: 'event-hitreact', label: 'Event_HitReact', detail: 'HandleGameplayEvent with hit react payload', kind: 'terminal', cppRef: 'OwnerASC->HandleGameplayEvent(ARPGGameplayTags::Event_HitReact, &HitReactPayload);' },
];

export const HEAL_PIPELINE: PipelineNode[] = [
  { id: 'entry-heal', label: 'IncomingHeal', detail: 'Meta attribute for healing effects', kind: 'entry', element: 'Heal', cppRef: 'Data.EvaluatedData.Attribute == GetIncomingHealAttribute()' },
  { id: 'consume-heal', label: 'Consume Meta', detail: 'SetIncomingHeal(0)', kind: 'action', cppRef: 'SetIncomingHeal(0.f);' },
  { id: 'add-health', label: 'Health += Heal', detail: 'Clamp(OldHealth + HealAmount, 0, MaxHealth)', kind: 'action', element: 'Heal', cppRef: 'SetHealth(FMath::Clamp(OldHealth + HealAmount, 0.f, GetMaxHealth()));' },
  { id: 'broadcast-heal', label: 'Broadcast Heal Number', detail: 'bIsHeal=true, per-instance + global', kind: 'broadcast', element: 'Heal', cppRef: 'OnDamageNumberRequested.Broadcast(TargetActor, ActualHeal, false, true, FGameplayTag(), Location);' },
];

export const DIRECT_PIPELINE: PipelineNode[] = [
  { id: 'entry-direct', label: 'Direct Health Mod', detail: 'Non-execution GE modifies Health directly', kind: 'entry', cppRef: 'Data.EvaluatedData.Attribute == GetHealthAttribute()' },
  { id: 'clamp-direct', label: 'Clamp Health', detail: 'Clamp(Health, 0, MaxHealth)', kind: 'action', cppRef: 'SetHealth(FMath::Clamp(GetHealth(), 0.f, GetMaxHealth()));' },
  { id: 'check-sign', label: 'Magnitude > 0?', detail: 'Positive = heal, Negative = damage', kind: 'branch', cppRef: 'if (Data.EvaluatedData.Magnitude > 0.f)' },
  { id: 'direct-heal-broadcast', label: 'Broadcast Heal', detail: 'bIsHeal=true, Damage.Physical fallback', kind: 'broadcast', element: 'Heal', cppRef: 'OnDamageNumberRequested.Broadcast(TargetActor, Magnitude, false, true, ...);' },
  { id: 'direct-dmg-broadcast', label: 'Broadcast Physical Damage', detail: 'Damage.Physical tag, |Magnitude|', kind: 'broadcast', element: 'Physical', cppRef: 'OnDamageNumberRequested.Broadcast(TargetActor, Abs(Magnitude), false, false, Damage_Physical, ...);' },
  { id: 'direct-check-dead', label: 'Health <= 0?', detail: 'Same death/hitreact logic as damage path', kind: 'branch', cppRef: 'if (GetHealth() <= 0.f)' },
];
