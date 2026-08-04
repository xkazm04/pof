# ACCEPTANCE CONTRACT FOR THIS STEP (you are graded against it)

## Wiring contract — Effect Logic · effect
- **Granted by**: ASC GiveAbility — UAbilitySystemComponent::GiveAbility(GA_AshenBlade) called at character initialisation (AARPGCharacterBase::InitAbilitySystemComponent). Slot bound at initialisation; not dynamically acquired.
- **Activated by**: Input action IA_Ability1 (player) → UARPGAbilityInputComponent triggers TryActivateAbilityByTag(Ability.Fire.AshenBlade); AI behaviour-tree task BTTask_UseAbility passes the GA class directly.
- **Dependencies**: UARPGAttributeSet (Mana — cost source; Health/FireDamage — target attributes), ARPGDamageExecution (damage routing, fire-resist application, crit roll), status-effects::status-burning (ignite DoT via GE_AshenBlade_ApplyBurning), vfx::vfx-fire-impact (impact Niagara system, keyed via AnimNotify)
- **Verification**: L2: UARPGGameplayAbility compiled in Source/PoF/Abilities/; GA_AshenBlade class present; DT_GeneratedAbilities row "AshenBlade" seeded; L3: VSGenAshenBladeEffectTest — GA activates, Health delta ≈ -35 fire, State.Burnin…

Reproduce these four wiring fields on the artifact you write (`wiringContract`). The L2 checker rejects a placeholder ("TBD"/"TODO"/"n/a"), any claim under 12 characters, and a `verification` line that names no acceptance tier (L0–L4). Name the REAL registration + trigger site.