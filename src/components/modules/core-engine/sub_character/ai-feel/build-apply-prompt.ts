import type { FeelPreset, FeelProfile } from '@/lib/character-feel-optimizer';
import { describeLayer, type AdjustmentLayer } from '@/lib/feel-adjustment-layers';

/* ── UPROPERTY value list (shared by single-preset & resolved-stack prompts) ─ */

function buildProfileParamList(profile: FeelProfile): string {
  return `**Movement (UCharacterMovementComponent)**
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
- StaminaRegenPerSec: ${profile.staminaRegenPerSec}`;
}

const APPLY_INSTRUCTIONS = `### Instructions
1. Read ARPGCharacterBase.h and ARPGCharacterBase.cpp
2. Find or create each UPROPERTY listed above
3. Set the default values in the constructor
4. Ensure properties are in the correct UPROPERTY category for Blueprint exposure
5. Verify the code compiles`;

/* ── Build CLI prompt for applying a resolved adjustment-layer stack ───────── */

/**
 * Apply a base preset modified by an adjustment-layer stack. Only enabled layers
 * are listed (and their effect is already baked into `resolved`). The prompt
 * applies the resolved values while keeping the layer provenance visible so the
 * change is inspectable.
 */
export function buildStackApplyPrompt(
  base: FeelPreset,
  layers: AdjustmentLayer[],
  resolved: FeelProfile,
): string {
  const activeLayers = layers.filter((l) => l.enabled);
  const layerSection = activeLayers.length === 0
    ? `_No adjustment layers active — applying the base preset as-is._`
    : activeLayers.map((l) => `- **${l.name}** — ${describeLayer(l)}`).join('\n');

  return `## Task: Apply Resolved Character Feel — "${base.name}" + ${activeLayers.length} layer${activeLayers.length === 1 ? '' : 's'}

Apply the following resolved UPROPERTY values to ARPGCharacterBase. These values are the base preset "${base.name}" (${base.genre}) with the active adjustment layers below stacked on top (non-destructive — the base preset is unchanged).

### Base Preset
${base.name} — ${base.description}

### Adjustment Layers (applied in order)
${layerSection}

### Resolved Parameter Values to Set

${buildProfileParamList(resolved)}

${APPLY_INSTRUCTIONS}`;
}
