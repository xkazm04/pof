#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AbilitySystemInterface.h"
#include "ARPGCharacterBase.generated.h"

class UAbilitySystemComponent;
class UARPGAttributeSet;
class UAnimMontage;
class UCurveFloat;
class UCurveTable;
class UDataTable;
class UMotionWarpingComponent;

/** Dodge direction relative to character facing. */
UENUM(BlueprintType)
enum class EARPGDodgeDirection : uint8
{
	Forward,
	Backward,
	Left,
	Right
};

/** Custom movement mode IDs used by this character. */
namespace EARPGCustomMovement
{
	constexpr uint8 Dodge = 0;
}

// --- Dodge delegates for VFX / SFX hooks ---

/** Broadcast when a dodge begins: (DodgeDirection, DodgeWorldDirection) */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnDodgeStarted, EARPGDodgeDirection, Direction, FVector, WorldDirection);

/** Broadcast when a dodge ends */
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDodgeEnded);

/** Broadcast when invulnerability starts during a dodge */
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDodgeInvulnStart);

/** Broadcast when invulnerability ends during a dodge */
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDodgeInvulnEnd);

/** Broadcast when the death montage finishes and post-death logic completes */
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDeathFinished);

UCLASS(Abstract)
class POF_API AARPGCharacterBase : public ACharacter, public IAbilitySystemInterface
{
	GENERATED_BODY()

public:
	AARPGCharacterBase();

	// --- IAbilitySystemInterface ---
	virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;

	/** Typed accessor for this character's attribute set (owned by the ASC). */
	UFUNCTION(BlueprintPure, Category = "Abilities")
	UARPGAttributeSet* GetAttributeSet() const { return AttributeSet; }

	virtual void PossessedBy(AController* NewController) override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;

	/** Zoom the spring arm in/out. Sets a target that smoothly interpolates. */
	void ZoomCamera(float DeltaLength);

	/** Rotate the camera yaw by a delta (Q/E rotation). */
	void RotateCamera(float DeltaYaw);

	/** Get the current interpolated camera yaw for movement-relative calculations. */
	float GetCurrentCameraYaw() const { return CurrentCameraYaw; }

	// =====================================================================
	// Movement Gating
	// =====================================================================

	/**
	 * Central movement gate. Returns false during dodges, stagger, stun,
	 * or any other state that should prevent voluntary movement.
	 * Override in subclasses to add additional conditions (e.g., attack montages).
	 */
	UFUNCTION(BlueprintPure, Category = "Movement")
	virtual bool CanMove() const;

	// =====================================================================
	// Animation Blendspace (read by AnimBP)
	// =====================================================================

	/** Current speed as a 0–1 ratio of MaxWalkSpeed. Used by locomotion blendspace. */
	UFUNCTION(BlueprintPure, Category = "Animation")
	float GetSpeedRatio() const;

	/** Movement direction relative to character facing in degrees (-180 to 180). */
	UFUNCTION(BlueprintPure, Category = "Animation")
	float GetMovementDirection() const;

	/** Returns the current locomotion state: 0 = Idle, 1 = Walk, 2 = Run/Sprint. */
	UFUNCTION(BlueprintPure, Category = "Animation")
	int32 GetLocomotionState() const;

	/** Speed ratio threshold above which the character transitions from walk to run. */
	UFUNCTION(BlueprintPure, Category = "Animation")
	float GetRunSpeedThreshold() const { return RunSpeedThreshold; }

	/** Whether root motion is currently active on the character. */
	UFUNCTION(BlueprintPure, Category = "Animation")
	bool IsUsingRootMotion() const { return bRootMotionActive; }

	// =====================================================================
	// Sprint
	// =====================================================================

	/** Request sprint start — only succeeds if stamina > 0. */
	void StartSprinting();

	/** Request sprint stop. */
	void StopSprinting();

	/** Whether the character is currently sprinting. */
	UFUNCTION(BlueprintPure, Category = "Movement|Sprint")
	bool IsSprinting() const { return bIsSprinting; }

	/**
	 * Attempt a dodge roll in the given world direction.
	 * @param MoveInput  Camera-relative movement input (from controller). If zero, dodges backward.
	 * @return true if the dodge was executed, false if blocked by cooldown/stamina/ground/etc.
	 */
	bool TryDodge(const FVector2D& MoveInput);

	UFUNCTION(BlueprintPure, Category = "Movement|Dodge")
	bool IsDodging() const { return bIsDodging; }

	UFUNCTION(BlueprintPure, Category = "Movement|Dodge")
	bool IsInvulnerable() const { return bIsInvulnerable; }

	UFUNCTION(BlueprintPure, Category = "Movement|Dodge")
	EARPGDodgeDirection GetDodgeDirection() const { return CurrentDodgeDirection; }

	/** Whether the character is currently attacking. */
	UFUNCTION(BlueprintPure, Category = "Movement|State")
	bool IsAttacking() const { return bIsAttacking; }

	/** Set the attacking state (called by GA_MeleeAttack). */
	UFUNCTION(BlueprintCallable, Category = "Movement|State")
	void SetAttacking(bool bNewAttacking) { bIsAttacking = bNewAttacking; }

	/** Whether the combo input window is currently open. */
	UFUNCTION(BlueprintPure, Category = "Combat|Combo")
	bool IsComboWindowOpen() const { return bComboWindowOpen; }

	/** Called by anim notify to open the combo input window. */
	UFUNCTION(BlueprintCallable, Category = "Combat|Combo")
	void OpenComboWindow() { bComboWindowOpen = true; }

	/** Called by anim notify to close the combo input window. */
	UFUNCTION(BlueprintCallable, Category = "Combat|Combo")
	void CloseComboWindow() { bComboWindowOpen = false; }

	/** Whether weapon hit detection is active. */
	UFUNCTION(BlueprintPure, Category = "Combat|HitDetection")
	bool IsHitDetectionActive() const { return bHitDetectionActive; }

	/** Called by anim notify state to enable weapon hit detection. */
	UFUNCTION(BlueprintCallable, Category = "Combat|HitDetection")
	void EnableHitDetection() { bHitDetectionActive = true; }

	/** Called by anim notify state to disable weapon hit detection. */
	UFUNCTION(BlueprintCallable, Category = "Combat|HitDetection")
	void DisableHitDetection() { bHitDetectionActive = false; }

	// =====================================================================
	// Motion Warping
	// =====================================================================

	UFUNCTION(BlueprintPure, Category = "Combat|MotionWarping")
	UMotionWarpingComponent* GetMotionWarpingComponent() const { return MotionWarpingComp; }

	/**
	 * Set the warp target for melee attack magnetism.
	 * Call this before playing an attack montage that contains a MotionWarping window.
	 * @param TargetLocation  World-space location to warp toward (typically the enemy's location).
	 * @param WarpTargetName  Must match the name used in the montage's Motion Warping notify. Default: "AttackTarget".
	 */
	UFUNCTION(BlueprintCallable, Category = "Combat|MotionWarping")
	void SetAttackWarpTarget(const FVector& TargetLocation, FName WarpTargetName = TEXT("AttackTarget"));

	/**
	 * Set the warp target using an actor's location and rotation.
	 * @param TargetActor  The actor to warp toward.
	 * @param WarpTargetName  Must match the name used in the montage's Motion Warping notify. Default: "AttackTarget".
	 */
	UFUNCTION(BlueprintCallable, Category = "Combat|MotionWarping")
	void SetAttackWarpTargetFromActor(AActor* TargetActor, FName WarpTargetName = TEXT("AttackTarget"));

	/** Clear a warp target by name. Call after the attack montage ends. */
	UFUNCTION(BlueprintCallable, Category = "Combat|MotionWarping")
	void ClearWarpTarget(FName WarpTargetName = TEXT("AttackTarget"));

	/** Whether the character is currently in a hit-reaction. */
	UFUNCTION(BlueprintPure, Category = "Movement|State")
	bool IsHitReacting() const { return bIsHitReacting; }

	/** Set the hit-reacting state (called by GA_HitReact). */
	UFUNCTION(BlueprintCallable, Category = "Movement|State")
	void SetHitReacting(bool bNewHitReacting) { bIsHitReacting = bNewHitReacting; }

	/**
	 * Whether the dodge is in its cancel window (late phase where the player
	 * can chain into an attack or another action).
	 */
	UFUNCTION(BlueprintPure, Category = "Movement|Dodge")
	bool IsInDodgeCancelWindow() const { return bInDodgeCancelWindow; }

	/**
	 * Cancel the current dodge early (e.g., to chain into an attack).
	 * Only works during the cancel window.
	 * @return true if the dodge was cancelled.
	 */
	UFUNCTION(BlueprintCallable, Category = "Movement|Dodge")
	bool CancelDodge();

	// --- Anim-notify driven invulnerability ---

	/** Call from an AnimNotify to start invulnerability (replaces hardcoded timer). */
	UFUNCTION(BlueprintCallable, Category = "Movement|Dodge")
	void NotifyDodgeInvulnStart();

	/** Call from an AnimNotify to end invulnerability. */
	UFUNCTION(BlueprintCallable, Category = "Movement|Dodge")
	void NotifyDodgeInvulnEnd();

	// =====================================================================
	// Dodge Accessors — used by GA_Dodge to read protected state
	// =====================================================================

	/** Current stamina value. */
	UFUNCTION(BlueprintPure, Category = "Stamina")
	float GetStamina() const { return Stamina; }

	/** Current stamina as a 0-1 fraction of MaxStamina. Used by AnimBP for sprint variation. */
	UFUNCTION(BlueprintPure, Category = "Stamina")
	float GetStaminaRatio() const { return MaxStamina > 0.f ? FMath::Clamp(Stamina / MaxStamina, 0.f, 1.f) : 0.f; }

	/** Consume stamina by a given amount. */
	UFUNCTION(BlueprintCallable, Category = "Stamina")
	void ConsumeStamina(float Amount) { Stamina = FMath::Max(Stamina - Amount, 0.f); }

	/** Whether the character requires grounded state for dodging. */
	UFUNCTION(BlueprintPure, Category = "Movement|Dodge")
	bool RequiresGroundedForDodge() const { return bRequireGroundedForDodge; }

	/** Get the dodge montage for a given direction (falls back to default). */
	UFUNCTION(BlueprintPure, Category = "Movement|Dodge")
	UAnimMontage* GetDodgeMontageForDirection(EARPGDodgeDirection Direction) const { return GetDodgeMontage(Direction); }

	/** Get the configured dodge montage play rate. */
	UFUNCTION(BlueprintPure, Category = "Movement|Dodge")
	float GetDodgeMontagePlayRate() const { return DodgeMontagePlayRate; }

	// =====================================================================
	// Death — used by GA_Death
	// =====================================================================

	/** Whether the character is dead. Subclasses override with their own bIsAlive flag. */
	UFUNCTION(BlueprintPure, Category = "Combat|Death")
	virtual bool IsDead() const { return false; }

	/** Get the death montage to play (may be null). */
	UFUNCTION(BlueprintPure, Category = "Combat|Death")
	UAnimMontage* GetDeathMontage() const { return DeathMontage; }

	/** Get the hit react montage to play (may be null). */
	UFUNCTION(BlueprintPure, Category = "Combat|HitReact")
	UAnimMontage* GetHitReactMontage() const { return HitReactMontage; }

	/** Enable ragdoll physics on the skeletal mesh. */
	UFUNCTION(BlueprintCallable, Category = "Combat|Death")
	void EnableRagdoll();

	/** Broadcast when death montage finishes and post-death logic runs. */
	UPROPERTY(BlueprintAssignable, Category = "Events|Death")
	FOnDeathFinished OnDeathFinished;

	// =====================================================================
	// Dodge Delegates — bind from Blueprint for VFX/SFX
	// =====================================================================

	UPROPERTY(BlueprintAssignable, Category = "Events|Dodge")
	FOnDodgeStarted OnDodgeStarted;

	UPROPERTY(BlueprintAssignable, Category = "Events|Dodge")
	FOnDodgeEnded OnDodgeEnded;

	UPROPERTY(BlueprintAssignable, Category = "Events|Dodge")
	FOnDodgeInvulnStart OnDodgeInvulnStart;

	UPROPERTY(BlueprintAssignable, Category = "Events|Dodge")
	FOnDodgeInvulnEnd OnDodgeInvulnEnd;

protected:
	// --- Ability System ---
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Abilities")
	TObjectPtr<UAbilitySystemComponent> AbilitySystemComponent;

	/**
	 * Attribute set holding this character's GAS attributes (Health, Mana, Strength, etc.).
	 * Created as a default subobject so the ASC auto-discovers and registers it during
	 * InitializeComponent — required for InitializeAttributes() and GetSet<UARPGAttributeSet>() to work.
	 */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Abilities")
	TObjectPtr<UARPGAttributeSet> AttributeSet;

	/** Abilities granted to this character's ASC on possession (server). Set per-Blueprint. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Abilities")
	TArray<TSubclassOf<class UGameplayAbility>> DefaultAbilities;

	// --- Attribute Initialization ---

	/**
	 * Data Table (row struct: FARPGAttributeInitRow) containing base attribute values.
	 * Row name should match this character's archetype (e.g., "Player", "Skeleton").
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Abilities|Attributes")
	TObjectPtr<UDataTable> AttributeInitTable;

	/** Row name in AttributeInitTable to use for this character. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Abilities|Attributes")
	FName AttributeInitRowName = TEXT("Player");

	/**
	 * Curve Table for per-level attribute scaling.
	 * Row names: Health, MaxHealth, Mana, MaxMana, Strength, Dexterity,
	 * Intelligence, Armor, AttackPower, CriticalChance, CriticalDamage.
	 * X = level, Y = multiplier. If null, base values are used unscaled.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Abilities|Attributes")
	TObjectPtr<UCurveTable> LevelScalingCurveTable;

	/**
	 * Curve Table for XP-per-level requirements.
	 * Row name: "XPToNextLevel". X = level, Y = absolute XP required.
	 * Generated by the AnimAsset commandlet (CT_XPRequirements).
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Abilities|Attributes")
	TObjectPtr<UCurveTable> XPRequirementsCurveTable;

	/** Character level used for curve table evaluation. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Abilities|Attributes")
	int32 CharacterLevel = 1;

	/**
	 * Initialize all GAS attributes from the Data Table + Curve Table.
	 * Called automatically from PossessedBy. Can also be called manually
	 * (e.g., on level-up) to refresh attributes.
	 */
	UFUNCTION(BlueprintCallable, Category = "Abilities|Attributes")
	void InitializeAttributes();

	// --- Motion Warping ---
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Combat|MotionWarping")
	TObjectPtr<UMotionWarpingComponent> MotionWarpingComp;

	// --- Camera ---
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<class USpringArmComponent> SpringArm;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<class UCameraComponent> FollowCamera;

	// --- Camera Lag ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Lag")
	float CameraLagSpeed = 8.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Lag")
	float CameraRotationLagSpeed = 10.f;

	// --- Camera Pitch ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Pitch", meta = (ClampMin = "-89", ClampMax = "0"))
	float CameraPitchAngle = -55.f;

	// --- Camera Zoom ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Zoom")
	float MinArmLength = 600.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Zoom")
	float MaxArmLength = 2000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Zoom")
	float ZoomInterpSpeed = 6.f;

	// --- Camera Rotation (Q/E) ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Rotation")
	float CameraRotationInterpSpeed = 5.f;

	// --- Camera Collision ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Collision")
	bool bEnableCameraCollision = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Collision")
	float CameraCollisionProbeSize = 12.f;

	// --- Camera Sway on Movement ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Sway")
	bool bEnableCameraSway = true;

	/** Max roll tilt (degrees) when strafing at full speed. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Sway", meta = (EditCondition = "bEnableCameraSway", ClampMin = "0", ClampMax = "5"))
	float CameraSwayMaxRoll = 1.5f;

	/** Max pitch offset (degrees) when moving forward/backward at full speed. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Sway", meta = (EditCondition = "bEnableCameraSway", ClampMin = "0", ClampMax = "5"))
	float CameraSwayMaxPitch = 0.8f;

	/** How fast the sway interpolates to target. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Sway", meta = (EditCondition = "bEnableCameraSway"))
	float CameraSwayInterpSpeed = 4.f;

	// --- Sprint tuning ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Sprint")
	float WalkSpeed = 600.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Sprint")
	float SprintSpeed = 900.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Sprint")
	float SprintSpeedInterpTime = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Sprint")
	float SprintArmLengthOffset = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Sprint")
	float SprintFOVOffset = 5.f;

	// --- Stamina ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float MaxStamina = 100.f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stamina")
	float Stamina = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float StaminaDrainPerSec = 20.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float StaminaRegenPerSec = 15.f;

	/** Delay (seconds) after stamina consumption before regen begins. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float StaminaRegenDelay = 1.0f;

	// --- Terrain Handling ---

	/** Max vertical step the character can walk up (stairs, curbs). Default 55 handles most stair meshes. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain")
	float StepHeight = 55.f;

	/** Max slope angle (degrees) the character can walk on. Above this angle, the character slides. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain", meta = (ClampMin = "0", ClampMax = "89"))
	float WalkableFloorAngle = 50.f;

	/** When true, speed is preserved on ramps (horizontal component stays constant). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain")
	bool bMaintainHorizontalGroundVelocity = true;

	/** Braking deceleration when walking (higher = snappier stops). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain")
	float BrakingDeceleration = 2400.f;

	/** Ground friction coefficient (higher = less sliding). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain")
	float MovementGroundFriction = 8.f;

	/** Lateral friction when falling (higher = less air drift). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain")
	float MovementFallingLateralFriction = 0.5f;

	/** Air control factor while falling [0..1]. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain", meta = (ClampMin = "0", ClampMax = "1"))
	float MovementAirControl = 0.2f;

	/** Max distance from ledge edge that the character can stand on without falling. 0 = off. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain", meta = (ClampMin = "0"))
	float LedgePerchWidth = 40.f;

	/** Min floor normal Z for valid perch floor (prevents perching on very steep sub-surfaces near ledges). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Terrain", meta = (ClampMin = "0", ClampMax = "1"))
	float LedgePerchFloorZ = 0.25f;

	// --- Rotation Feel ---

	/** Rotation rate (deg/sec) when idle or at low speed. Higher = snappier turn-on-dime. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Rotation")
	float RotationRateIdle = 720.f;

	/** Rotation rate (deg/sec) at full walk/sprint speed. Lower = smoother arcs. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Rotation")
	float RotationRateAtSpeed = 360.f;

	// --- Acceleration Curves ---

	/**
	 * Optional curve that maps input magnitude (X=0..1) to acceleration multiplier (Y).
	 * Applied on top of MaxAcceleration. Allows e.g. snappy starts with softer top-end.
	 * If null, linear 1:1 mapping is used.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Acceleration")
	TObjectPtr<UCurveFloat> AccelerationCurve;

	/** Max acceleration when starting from idle (used when AccelerationCurve is null). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Acceleration")
	float AccelerationFromIdle = 4096.f;

	/** Max acceleration at full speed (used when AccelerationCurve is null). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Acceleration")
	float AccelerationAtFullSpeed = 2048.f;

	// --- Animation Blendspace ---

	/** Speed threshold (as fraction of MaxWalkSpeed) below which the character is "idle". */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Blendspace", meta = (ClampMin = "0.0", ClampMax = "0.3"))
	float IdleSpeedThreshold = 0.05f;

	/** Speed threshold (as fraction of MaxWalkSpeed) above which the character transitions from walk to run. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Blendspace", meta = (ClampMin = "0.1", ClampMax = "1.0"))
	float RunSpeedThreshold = 0.7f;

	// --- Root Motion ---

	/** When true, root motion from montages will drive character movement. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|RootMotion")
	bool bAllowRootMotion = true;

	// --- Movement Gating Flags (set by gameplay systems) ---

	/** Set to true to block movement during attack montages. */
	UPROPERTY(BlueprintReadWrite, Category = "Movement|State")
	bool bIsAttacking = false;

	/** Set to true to block movement during stagger. */
	UPROPERTY(BlueprintReadWrite, Category = "Movement|State")
	bool bIsStaggered = false;

	/** Set to true to block movement during stun. */
	UPROPERTY(BlueprintReadWrite, Category = "Movement|State")
	bool bIsStunned = false;

	/** Set to true while playing a hit-reaction montage. */
	UPROPERTY(BlueprintReadWrite, Category = "Movement|State")
	bool bIsHitReacting = false;

	// --- Dodge tuning ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge")
	float DodgeDistance = 1200.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge")
	float DodgeDuration = 0.4f;

	/**
	 * Fallback invulnerability duration used when no AnimNotify drives it.
	 * If bUseAnimNotifyInvuln is true, this is ignored in favor of notify timing.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge")
	float DodgeInvulnerabilityDuration = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge")
	float DodgeCooldown = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge")
	float DodgeStaminaCost = 25.f;

	/**
	 * When true, invulnerability is driven by NotifyDodgeInvulnStart/End
	 * (called from anim notifies). When false, uses the hardcoded timer fallback.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge")
	bool bUseAnimNotifyInvuln = false;

	/**
	 * Fraction of DodgeDuration after which the cancel window opens.
	 * E.g., 0.6 means the last 40% of the dodge can be cancelled into an attack.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float DodgeCancelWindowStart = 0.6f;

	/** Whether the character must be grounded to dodge. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge")
	bool bRequireGroundedForDodge = true;

	// --- Death montage ---

	/** Death animation montage. If null, death skips straight to post-death logic. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Death|Animation")
	TObjectPtr<UAnimMontage> DeathMontage;

	// --- Hit React montage ---

	/** Hit reaction montage played when the character takes non-lethal damage. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|HitReact|Animation")
	TObjectPtr<UAnimMontage> HitReactMontage;

	// --- Dodge montages (assign per direction in Blueprint) ---

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge|Animation")
	TObjectPtr<UAnimMontage> DodgeMontage_Forward;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge|Animation")
	TObjectPtr<UAnimMontage> DodgeMontage_Backward;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge|Animation")
	TObjectPtr<UAnimMontage> DodgeMontage_Left;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge|Animation")
	TObjectPtr<UAnimMontage> DodgeMontage_Right;

	/** Fallback montage used if a directional variant is not assigned. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge|Animation")
	TObjectPtr<UAnimMontage> DodgeMontage_Default;

	/** Playback rate for dodge montages. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement|Dodge|Animation", meta = (ClampMin = "0.1", ClampMax = "5.0"))
	float DodgeMontagePlayRate = 1.0f;

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Zoom")
	float ZoomStep = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Rotation")
	float CameraRotationStep = 45.f;

private:
	bool bIsSprinting = false;
	bool bWantsToSprint = false;

	// Combat state
	bool bComboWindowOpen = false;
	bool bHitDetectionActive = false;

	float BaseArmLength = 1200.f;
	float DesiredArmLength = 1200.f;
	float BaseFOV = 0.f; // captured at BeginPlay

	// Camera rotation state
	float DesiredCameraYaw = 0.f;
	float CurrentCameraYaw = 0.f;

	// Camera sway state
	float CurrentSwayRoll = 0.f;
	float CurrentSwayPitch = 0.f;

	void UpdateSprintEffects(float DeltaTime);
	void UpdateCameraZoom(float DeltaTime);
	void UpdateCameraRotation(float DeltaTime);
	void UpdateCameraSway(float DeltaTime);
	void UpdateAcceleration();
	void UpdateRotationRate();

	/** Remaining time before stamina regen kicks in after consumption. */
	float StaminaRegenDelayRemaining = 0.f;

	// Root motion tracking
	bool bRootMotionActive = false;

	// --- Dodge state ---
	bool bIsDodging = false;
	bool bIsInvulnerable = false;
	bool bInDodgeCancelWindow = false;
	float DodgeCooldownRemaining = 0.f;
	float DodgeElapsedTime = 0.f;
	EARPGDodgeDirection CurrentDodgeDirection = EARPGDodgeDirection::Forward;
	FVector DodgeWorldDir = FVector::ZeroVector;
	float DodgeSpeed = 0.f;

	FTimerHandle DodgeEndTimerHandle;
	FTimerHandle InvulnerabilityEndTimerHandle;

	void OnDodgeEnd();
	void OnInvulnerabilityEnd();
	void UpdateDodgeMovement(float DeltaTime);

	/** Classify a world-space dodge direction into the 4-way enum relative to character facing. */
	EARPGDodgeDirection ClassifyDodgeDirection(const FVector& DodgeDir) const;

	/** Select the appropriate montage for the given direction. */
	UAnimMontage* GetDodgeMontage(EARPGDodgeDirection Direction) const;
};
