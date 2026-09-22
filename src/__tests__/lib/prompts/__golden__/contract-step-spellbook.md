# ACCEPTANCE CONTRACT FOR THIS STEP (you are graded against it)

## Required fields (graded — use these exact keys)
- `effect`: an object with keys `damageType`, `baseDamage`, `manaCost`, `cooldown`, `critChancePct`, `critMulti`, `onHitIgnite`
- `effect.wiringContract` (only if you declare it): an object { grantedBy: string, activatedBy: string, dependencies: string[] (a JSON ARRAY of strings, may be empty), verification: string naming its L0–L4 tier }

## Wiring contract — Effect Logic · effect
- **Granted by**: UAbilitySystemComponent::GiveAbility grants GA_AshenBlade during AARPGCharacterBase::InitAbilitySystemComponent, with its slot assigned from DT_GeneratedAbilities
- **Activated by**: THIS ability’s declared Enhanced Input action calls UARPGAbilityInputComponent::TryActivateAbilityByTag; AI users pass GA_AshenBlade through BTTask_UseAbility
- **Dependencies**: UARPGAttributeSet attributes consumed or modified by THIS ability, ARPGDamageExecution when THIS ability deals damage, status-effects::<id> for each status THIS ability applies, vfx::<id> for each effect THIS ability triggers
- **Verification**: L2: GA_AshenBlade compiles in Source/PoF/Abilities/ and its DT_GeneratedAbilities row is seeded; L3: THIS ability’s functional test verifies activation, costs, effects, cooldown, and every declared dependency

Write these four wiring fields on the artifact you write (`wiringContract`) for THIS entity: the contract above says what each must name — where it says "each" or "<id>", list this entity's own, never another's. The L2 checker rejects a placeholder ("TBD"/"TODO"/"n/a"), any claim under 12 characters, and a `verification` line that names no acceptance tier (L0–L4). Name the REAL registration + trigger site.