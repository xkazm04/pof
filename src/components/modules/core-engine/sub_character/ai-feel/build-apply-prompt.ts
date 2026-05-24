import type { FeelPreset } from '@/lib/character-feel-optimizer';

/* ── Build CLI prompt for applying a preset ──────────────────────────────── */

export function buildApplyPrompt(preset: FeelPreset): string {
  const { profile } = preset;
  return `## Task: Apply Character Feel Preset \u2014 "${preset.name}"

Apply the following UPROPERTY values to ARPGCharacterBase to achieve a "${preset.name}" feel (${preset.genre}).

### Description
${preset.description}

### Parameter Values to Set

**Movement (UCharacterMovementComponent)**
- MaxWalkSpeed: ${profile.movement.maxWalkSpeed}
- MaxSprintSpeed: ${profile.movement.maxSprintSpeed} (custom UPROPERTY)
- MaxAcceleration: ${profile.movement.acceleration}
- BrakingDecelerationWalking: ${profile.movement.deceleration}
- RotationRate.Yaw: ${profile.movement.turnRate}
- AirControl: ${profile.movement.airControl}
- JumpZVelocity: ${profile.movement.jumpZVelocity}
- GravityScale: ${profile.movement.gravityScale}

**Combat (ARPGCharacterBase / AbilitySystem)**
- BaseDamage: ${profile.combat.baseDamage}
- AttackSpeed: ${profile.combat.attackSpeed}
- ComboWindowMs: ${profile.combat.comboWindowMs}
- HitReactionDuration: ${profile.combat.hitReactionDuration}
- CritChance: ${profile.combat.critChance}
- CritMultiplier: ${profile.combat.critMultiplier}
- AttackRange: ${profile.combat.attackRange}
- CleaveAngle: ${profile.combat.cleaveAngle}

**Dodge (GA_Dodge / ARPGCharacterBase)**
- DodgeDistance: ${profile.dodge.distance}
- DodgeDuration: ${profile.dodge.duration}
- IFrameStart: ${profile.dodge.iFrameStart}
- IFrameDuration: ${profile.dodge.iFrameDuration}
- DodgeCooldown: ${profile.dodge.cooldown}
- DodgeStaminaCost: ${profile.dodge.staminaCost}
- DodgeCancelWindowStart: ${profile.dodge.cancelWindowStart}
- DodgeCancelWindowEnd: ${profile.dodge.cancelWindowEnd}

**Camera (USpringArmComponent / CameraComponent)**
- TargetArmLength: ${profile.camera.armLength}
- CameraLagSpeed: ${profile.camera.lagSpeed}
- FieldOfView: ${profile.camera.fovBase}
- SprintFOVOffset: ${profile.camera.fovSprintOffset}
- SwayMaxRoll: ${profile.camera.swayMaxRoll}
- SwayMaxPitch: ${profile.camera.swayMaxPitch}
- SwayInterpSpeed: ${profile.camera.swayInterpSpeed}
- SocketOffset.Z: ${profile.camera.socketOffsetZ}

**Stamina**
- StaminaDrainPerSec: ${profile.staminaDrainPerSec}
- StaminaRegenPerSec: ${profile.staminaRegenPerSec}

### Instructions
1. Read ARPGCharacterBase.h and ARPGCharacterBase.cpp
2. Find or create each UPROPERTY listed above
3. Set the default values in the constructor
4. Ensure properties are in the correct UPROPERTY category for Blueprint exposure
5. Verify the code compiles`;
}
