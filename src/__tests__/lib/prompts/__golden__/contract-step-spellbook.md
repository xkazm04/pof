# ACCEPTANCE CONTRACT FOR THIS STEP (you are graded against it)

## Required fields (graded — use these exact keys)
Graded: 3 top-level field(s) = 2 described + 1 named.
- `effect`: an object with keys `abilityId`, `activation`; "effect.cooldown" is the ability's cooldown in seconds (> 0) — or, for an ability that a resource and not a timer limits (no cooldown), omit it and write "effect.gatedBy: \"resource\"" beside a manaCost > 0 — or, for a free ability only its cast animation limits, "effect.gatedBy: \"cast-time\"" beside a castTime > 0 (s)
- `effects`: a JSON array with at least 1 item(s); every entry is an object with kind, target, value; entries whose kind is damage also include damageType; entries whose kind is status also include statusId
- `effect.wiringContract` (only if you declare it): an object { grantedBy: string, activatedBy: string, dependencies: string[] (a JSON ARRAY of strings, may be empty), verification: string naming its L0–L4 tier }
- `links` (only if you declare it): JSON array of `{ catalogId, entityId }`, each an existing entity

## Wiring contract — Effect Logic · effect
- **Granted by**: UAbilitySystemComponent::GiveAbility grants GA_AshenBlade during AARPGCharacterBase::InitAbilitySystemComponent, with its slot assigned from DT_GeneratedAbilities
- **Activated by**: THIS ability’s declared Enhanced Input action calls UARPGAbilityInputComponent::TryActivateAbilityByTag; AI users pass GA_AshenBlade through BTTask_UseAbility
- **Dependencies**: UARPGAttributeSet attributes consumed or modified by THIS ability, ARPGDamageExecution when THIS ability deals damage, status-effects::<id> for each status THIS ability applies, vfx::<id> for each effect THIS ability triggers
- **Verification**: L2: GA_AshenBlade compiles in Source/PoF/Abilities/ and its DT_GeneratedAbilities row is seeded; L3: THIS ability’s functional test verifies activation, costs, effects, cooldown, and every declared dependency

Write these four wiring fields on the artifact you write (`wiringContract`) for THIS entity: the contract above says what each must name — where it says "each" or "<id>", list this entity's own, never another's. The L2 checker rejects a placeholder ("TBD"/"TODO"/"n/a"), any claim under 12 characters, and a `verification` line that names no acceptance tier (L0–L4). Name the REAL registration + trigger site.