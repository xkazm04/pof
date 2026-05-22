#include "ARPGCharacterBase.h"
#include "AbilitySystemComponent.h"
#include "Abilities/GameplayAbility.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Camera/CameraComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Curves/CurveFloat.h"
#include "Engine/CurveTable.h"
#include "MotionWarpingComponent.h"
#include "AbilitySystem/ARPGAttributeSet.h"
#include "AbilitySystem/ARPGAttributeInitData.h"
#include "AbilitySystem/ARPGGameplayTags.h"
#include "AbilitySystem/Effects/GE_InitAttributes.h"

AARPGCharacterBase::AARPGCharacterBase()
{
	PrimaryActorTick.bCanEverTick = true;

	// --- Controller rotation should NOT drive the character directly ---
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	// --- Movement defaults ---
	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	MoveComp->MaxWalkSpeed = WalkSpeed;
	MoveComp->MaxAcceleration = AccelerationFromIdle;
	MoveComp->RotationRate = FRotator(0.f, RotationRateIdle, 0.f);
	MoveComp->bOrientRotationToMovement = true;

	// Terrain handling
	MoveComp->MaxStepHeight = StepHeight;
	MoveComp->SetWalkableFloorAngle(WalkableFloorAngle);
	MoveComp->bMaintainHorizontalGroundVelocity = bMaintainHorizontalGroundVelocity;
	MoveComp->BrakingDecelerationWalking = BrakingDeceleration;
	MoveComp->GroundFriction = MovementGroundFriction;
	MoveComp->bCanWalkOffLedges = true;
	MoveComp->FallingLateralFriction = MovementFallingLateralFriction;
	MoveComp->AirControl = MovementAirControl;
	MoveComp->JumpZVelocity = 0.f;

	// Ledge/perch handling
	MoveComp->PerchRadiusThreshold = LedgePerchWidth;
	MoveComp->PerchAdditionalHeight = 0.f;

	// Use separate braking friction (allows fine control independent of GroundFriction)
	MoveComp->bUseSeparateBrakingFriction = false;

	// --- Spring arm (isometric-style) ---
	SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
	SpringArm->SetupAttachment(RootComponent);
	SpringArm->TargetArmLength = BaseArmLength;
	SpringArm->SetRelativeRotation(FRotator(CameraPitchAngle, 0.f, 0.f));
	SpringArm->bUsePawnControlRotation = false;
	SpringArm->bInheritPitch = false;
	SpringArm->bInheritYaw = false;
	SpringArm->bInheritRoll = false;

	// Camera lag for smooth follow
	SpringArm->bEnableCameraLag = true;
	SpringArm->CameraLagSpeed = CameraLagSpeed;
	SpringArm->bEnableCameraRotationLag = true;
	SpringArm->CameraRotationLagSpeed = CameraRotationLagSpeed;

	// Collision
	SpringArm->bDoCollisionTest = bEnableCameraCollision;
	SpringArm->ProbeSize = CameraCollisionProbeSize;
	SpringArm->ProbeChannel = ECC_Camera;

	// --- Camera ---
	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(SpringArm, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	// Init zoom target
	DesiredArmLength = BaseArmLength;

	// --- Motion Warping ---
	MotionWarpingComp = CreateDefaultSubobject<UMotionWarpingComponent>(TEXT("MotionWarping"));

	// --- Ability System ---
	AbilitySystemComponent = CreateDefaultSubobject<UAbilitySystemComponent>(TEXT("AbilitySystemComponent"));
	AbilitySystemComponent->SetIsReplicated(true);
	AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Mixed);

	// Create the attribute set as a default subobject. Because it is a UPROPERTY UObject
	// subobject of this actor (the ASC's owner), UAbilitySystemComponent::InitializeComponent
	// auto-discovers and registers it — no manual AddSpawnedAttribute needed at runtime.
	AttributeSet = CreateDefaultSubobject<UARPGAttributeSet>(TEXT("AttributeSet"));
}

UAbilitySystemComponent* AARPGCharacterBase::GetAbilitySystemComponent() const
{
	return AbilitySystemComponent;
}

void AARPGCharacterBase::PossessedBy(AController* NewController)
{
	Super::PossessedBy(NewController);

	// Server-authoritative init. Owner = controller (drives input prediction/auth);
	// Avatar = this character (the physical representation that abilities act on).
	// Covers both AI pawns (AIController) and player pawns (PlayerController) on server.
	if (AbilitySystemComponent)
	{
		AbilitySystemComponent->InitAbilityActorInfo(NewController, this);

		// Initialize attributes from Data Table + Curve Table
		InitializeAttributes();

		// Grant default abilities (server only)
		if (HasAuthority())
		{
			for (const TSubclassOf<UGameplayAbility>& AbilityClass : DefaultAbilities)
			{
				if (AbilityClass)
				{
					AbilitySystemComponent->GiveAbility(FGameplayAbilitySpec(AbilityClass, 1, INDEX_NONE, this));
				}
			}
		}
	}
}

void AARPGCharacterBase::BeginPlay()
{
	Super::BeginPlay();

	// Client-side / fallback init. PossessedBy is server-only, so simulated proxies
	// and autonomous proxies on clients need their AbilityActorInfo set here.
	// If a controller already exists, use it as the owner; otherwise fall back to self
	// (PossessedBy will refresh owner→controller once possession replicates).
	if (AbilitySystemComponent)
	{
		AActor* OwnerActor = GetController() ? static_cast<AActor*>(GetController()) : static_cast<AActor*>(this);
		AbilitySystemComponent->InitAbilityActorInfo(OwnerActor, this);
	}
}

void AARPGCharacterBase::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	// Capture base FOV on first tick (camera not ready in constructor).
	if (BaseFOV == 0.f && FollowCamera)
	{
		BaseFOV = FollowCamera->FieldOfView;
	}

	// --- Acceleration curve & rotation rate ---
	UpdateAcceleration();
	UpdateRotationRate();

	// --- Root motion tracking ---
	// Detect whether anim root motion is actively driving the character.
	// HasAnimRootMotion() returns true when the AnimInstance is providing
	// root motion data this frame (e.g., from a montage with root motion).
	if (bAllowRootMotion && GetCharacterMovement())
	{
		bRootMotionActive = GetCharacterMovement()->HasAnimRootMotion();
	}
	else
	{
		bRootMotionActive = false;
	}

	// --- Dodge cooldown ---
	if (DodgeCooldownRemaining > 0.f)
	{
		DodgeCooldownRemaining -= DeltaTime;
	}

	// --- Dodge movement (custom movement mode) ---
	if (bIsDodging)
	{
		UpdateDodgeMovement(DeltaTime);
	}

	// --- Stamina ---
	if (bIsSprinting)
	{
		// Only drain if actually moving
		const float Speed = GetVelocity().Size2D();
		if (Speed > 10.f)
		{
			Stamina -= StaminaDrainPerSec * DeltaTime;
			StaminaRegenDelayRemaining = StaminaRegenDelay;
			if (Stamina <= 0.f)
			{
				Stamina = 0.f;
				StopSprinting();
				UE_LOG(LogTemp, Warning, TEXT("[Stamina] Exhausted — sprint forced off"));
			}
		}
	}
	else if (!bIsDodging)
	{
		// Regen after delay when not sprinting and not dodging
		if (StaminaRegenDelayRemaining > 0.f)
		{
			StaminaRegenDelayRemaining -= DeltaTime;
		}
		else if (Stamina < MaxStamina)
		{
			Stamina = FMath::Min(Stamina + StaminaRegenPerSec * DeltaTime, MaxStamina);
		}
	}

	// Auto-stop sprint if character isn't moving while holding sprint
	if (bIsSprinting && GetVelocity().Size2D() < 10.f)
	{
		bIsSprinting = false;
	}
	// Re-engage sprint if player is holding shift and starts moving again
	if (!bIsSprinting && bWantsToSprint && !bIsDodging && GetVelocity().Size2D() > 10.f && Stamina > 0.f)
	{
		bIsSprinting = true;
	}

	UpdateSprintEffects(DeltaTime);
	UpdateCameraZoom(DeltaTime);
	UpdateCameraRotation(DeltaTime);
	UpdateCameraSway(DeltaTime);

#if !UE_BUILD_SHIPPING
	// Debug stamina display
	if (GEngine)
	{
		FString StateStr;
		if (bIsSprinting) StateStr += TEXT("[SPRINTING] ");
		if (bIsDodging)
		{
			StateStr += TEXT("[DODGING");
			if (bInDodgeCancelWindow) StateStr += TEXT("-CANCEL");
			StateStr += TEXT("] ");
		}
		if (bIsInvulnerable) StateStr += TEXT("[INVULN] ");

		FColor DisplayColor = bIsDodging ? FColor::Cyan : (bIsSprinting ? FColor::Orange : FColor::Green);
		GEngine->AddOnScreenDebugMessage(1, 0.f, DisplayColor,
			FString::Printf(TEXT("Stamina: %.0f / %.0f  %s"), Stamina, MaxStamina, *StateStr));
	}
#endif
}

void AARPGCharacterBase::ZoomCamera(float DeltaLength)
{
	if (!SpringArm) return;
	DesiredArmLength = FMath::Clamp(DesiredArmLength + DeltaLength, MinArmLength, MaxArmLength);
	BaseArmLength = FMath::Clamp(BaseArmLength + DeltaLength, MinArmLength, MaxArmLength);
}

void AARPGCharacterBase::RotateCamera(float DeltaYaw)
{
	DesiredCameraYaw += DeltaYaw;
}

void AARPGCharacterBase::StartSprinting()
{
	bWantsToSprint = true;
	if (Stamina > 0.f && !bIsDodging)
	{
		bIsSprinting = true;
	}
}

void AARPGCharacterBase::StopSprinting()
{
	bWantsToSprint = false;
	bIsSprinting = false;
}

// =========================================================================
// Dodge
// =========================================================================

bool AARPGCharacterBase::TryDodge(const FVector2D& MoveInput)
{
	if (bIsDodging) return false;
	if (DodgeCooldownRemaining > 0.f) return false;
	if (Stamina < DodgeStaminaCost) return false;

	// Ground check — must be on the ground (walking or on floor)
	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	if (bRequireGroundedForDodge && MoveComp && !MoveComp->IsMovingOnGround())
	{
		return false;
	}

	// Pay stamina cost
	Stamina -= DodgeStaminaCost;
	StaminaRegenDelayRemaining = StaminaRegenDelay;

	// Cancel sprint
	if (bIsSprinting)
	{
		StopSprinting();
	}

	// Determine dodge direction: use movement input if provided, otherwise dodge backward
	FVector DodgeDir;
	if (!MoveInput.IsNearlyZero())
	{
		DodgeDir = FVector(MoveInput.X, MoveInput.Y, 0.f).GetSafeNormal();
	}
	else
	{
		DodgeDir = -GetActorForwardVector();
		DodgeDir.Z = 0.f;
		DodgeDir = DodgeDir.GetSafeNormal();
	}

	// Classify direction for animation selection
	CurrentDodgeDirection = ClassifyDodgeDirection(DodgeDir);

	// Snap rotation to dodge direction
	SetActorRotation(DodgeDir.Rotation());

	bIsDodging = true;
	bInDodgeCancelWindow = false;
	DodgeElapsedTime = 0.f;
	DodgeWorldDir = DodgeDir;
	DodgeSpeed = DodgeDistance / FMath::Max(DodgeDuration, 0.01f);
	DodgeCooldownRemaining = DodgeCooldown;

	// Switch to custom movement mode — this prevents slope sliding,
	// external forces, and gives us full control over dodge velocity
	if (MoveComp)
	{
		MoveComp->SetMovementMode(MOVE_Custom, EARPGCustomMovement::Dodge);
		// Disable orientation to movement during dodge so we hold our facing
		MoveComp->bOrientRotationToMovement = false;
	}

	// --- Invulnerability ---
	if (bUseAnimNotifyInvuln)
	{
		// Invulnerability is driven by anim notifies — don't set it here.
		// The montage should call NotifyDodgeInvulnStart/End.
		bIsInvulnerable = false;
	}
	else
	{
		// Fallback: use hardcoded timer
		bIsInvulnerable = true;
		GetWorldTimerManager().SetTimer(InvulnerabilityEndTimerHandle, this,
			&AARPGCharacterBase::OnInvulnerabilityEnd, DodgeInvulnerabilityDuration, false);
		OnDodgeInvulnStart.Broadcast();
	}

	// --- Play montage ---
	if (UAnimMontage* Montage = GetDodgeMontage(CurrentDodgeDirection))
	{
		if (UAnimInstance* AnimInst = GetMesh()->GetAnimInstance())
		{
			AnimInst->Montage_Play(Montage, DodgeMontagePlayRate);
		}
	}

	// End dodge state after DodgeDuration
	GetWorldTimerManager().SetTimer(DodgeEndTimerHandle, this,
		&AARPGCharacterBase::OnDodgeEnd, DodgeDuration, false);

	// Broadcast VFX/SFX hook
	OnDodgeStarted.Broadcast(CurrentDodgeDirection, DodgeWorldDir);

	UE_LOG(LogTemp, Log, TEXT("[Dodge] Direction=%d Speed=%.0f Duration=%.2f"),
		static_cast<int32>(CurrentDodgeDirection), DodgeSpeed, DodgeDuration);

	return true;
}

void AARPGCharacterBase::UpdateDodgeMovement(float DeltaTime)
{
	DodgeElapsedTime += DeltaTime;

	// Open cancel window at the configured fraction of dodge duration
	if (!bInDodgeCancelWindow && DodgeElapsedTime >= DodgeDuration * DodgeCancelWindowStart)
	{
		bInDodgeCancelWindow = true;
	}

	// Apply controlled velocity — character moves along DodgeWorldDir at DodgeSpeed
	// Using custom movement mode means CharacterMovementComponent won't apply
	// walking physics (friction, slope, gravity) to us automatically.
	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	if (MoveComp && MoveComp->MovementMode == MOVE_Custom)
	{
		// Ease-out: decelerate smoothly over the dodge duration
		const float Alpha = FMath::Clamp(DodgeElapsedTime / FMath::Max(DodgeDuration, 0.01f), 0.f, 1.f);
		const float CurrentSpeed = DodgeSpeed * (1.f - Alpha * Alpha); // Quadratic ease-out
		const FVector Velocity = DodgeWorldDir * CurrentSpeed;

		MoveComp->Velocity = Velocity;
		// MoveUpdatedComponent in custom mode
		const FVector Delta = Velocity * DeltaTime;
		FHitResult Hit;
		MoveComp->SafeMoveUpdatedComponent(Delta, GetActorRotation(), true, Hit);

		if (Hit.bBlockingHit)
		{
			// Slide along walls: project remaining movement onto the wall surface
			const FVector Remaining = Delta * (1.f - Hit.Time);
			const FVector SlideDir = FVector::VectorPlaneProject(Remaining, Hit.Normal);
			if (!SlideDir.IsNearlyZero())
			{
				FHitResult SlideHit;
				MoveComp->SafeMoveUpdatedComponent(SlideDir, GetActorRotation(), true, SlideHit);
			}
		}
	}
}

bool AARPGCharacterBase::CancelDodge()
{
	if (!bIsDodging || !bInDodgeCancelWindow) return false;

	// Clear timers
	GetWorldTimerManager().ClearTimer(DodgeEndTimerHandle);

	// End dodge immediately
	OnDodgeEnd();

	UE_LOG(LogTemp, Log, TEXT("[Dodge] Cancelled during cancel window"));
	return true;
}

void AARPGCharacterBase::OnDodgeEnd()
{
	if (!bIsDodging) return;

	bIsDodging = false;
	bInDodgeCancelWindow = false;
	DodgeElapsedTime = 0.f;

	// Restore normal walking movement mode
	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	if (MoveComp)
	{
		MoveComp->SetMovementMode(MOVE_Walking);
		MoveComp->bOrientRotationToMovement = true;
		MoveComp->Velocity = FVector::ZeroVector;
	}

	// End invulnerability if still active (safety net)
	if (bIsInvulnerable)
	{
		OnInvulnerabilityEnd();
	}
	GetWorldTimerManager().ClearTimer(InvulnerabilityEndTimerHandle);

	OnDodgeEnded.Broadcast();
}

// =========================================================================
// Anim-notify driven invulnerability
// =========================================================================

void AARPGCharacterBase::NotifyDodgeInvulnStart()
{
	if (!bIsDodging) return;

	bIsInvulnerable = true;
	OnDodgeInvulnStart.Broadcast();

	UE_LOG(LogTemp, Verbose, TEXT("[Dodge] Invulnerability START (notify-driven)"));
}

void AARPGCharacterBase::NotifyDodgeInvulnEnd()
{
	if (!bIsInvulnerable) return;

	bIsInvulnerable = false;
	OnDodgeInvulnEnd.Broadcast();

	UE_LOG(LogTemp, Verbose, TEXT("[Dodge] Invulnerability END (notify-driven)"));
}

void AARPGCharacterBase::OnInvulnerabilityEnd()
{
	if (!bIsInvulnerable) return;

	bIsInvulnerable = false;
	OnDodgeInvulnEnd.Broadcast();
}

// =========================================================================
// Dodge helpers
// =========================================================================

EARPGDodgeDirection AARPGCharacterBase::ClassifyDodgeDirection(const FVector& DodgeDir) const
{
	const FVector Forward = GetActorForwardVector();
	const FVector Right = GetActorRightVector();

	const float ForwardDot = FVector::DotProduct(DodgeDir, Forward);
	const float RightDot = FVector::DotProduct(DodgeDir, Right);

	// Pick the dominant axis
	if (FMath::Abs(ForwardDot) >= FMath::Abs(RightDot))
	{
		return ForwardDot >= 0.f ? EARPGDodgeDirection::Forward : EARPGDodgeDirection::Backward;
	}
	else
	{
		return RightDot >= 0.f ? EARPGDodgeDirection::Right : EARPGDodgeDirection::Left;
	}
}

UAnimMontage* AARPGCharacterBase::GetDodgeMontage(EARPGDodgeDirection Direction) const
{
	UAnimMontage* Montage = nullptr;

	switch (Direction)
	{
	case EARPGDodgeDirection::Forward:  Montage = DodgeMontage_Forward;  break;
	case EARPGDodgeDirection::Backward: Montage = DodgeMontage_Backward; break;
	case EARPGDodgeDirection::Left:     Montage = DodgeMontage_Left;     break;
	case EARPGDodgeDirection::Right:    Montage = DodgeMontage_Right;    break;
	}

	// Fall back to default if directional variant not assigned
	return Montage ? Montage : DodgeMontage_Default.Get();
}

// =========================================================================
// Sprint
// =========================================================================

void AARPGCharacterBase::UpdateSprintEffects(float DeltaTime)
{
	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	if (!MoveComp) return;

	// Don't modify walk speed during dodge
	if (bIsDodging) return;

	const float TargetSpeed = bIsSprinting ? SprintSpeed : WalkSpeed;
	// InterpSpeed = 1/InterpTime gives us ~63% per InterpTime, effectively smooth over 0.2s
	const float InterpSpeed = (SprintSpeedInterpTime > 0.f) ? (1.f / SprintSpeedInterpTime) : 100.f;

	MoveComp->MaxWalkSpeed = FMath::FInterpTo(MoveComp->MaxWalkSpeed, TargetSpeed, DeltaTime, InterpSpeed);

	// Spring arm pull-back (modifies DesiredArmLength target so zoom interp handles it)
	if (SpringArm)
	{
		const float SprintTarget = bIsSprinting ? BaseArmLength + SprintArmLengthOffset : BaseArmLength;
		DesiredArmLength = FMath::Clamp(SprintTarget, MinArmLength, MaxArmLength);
	}

	// FOV shift
	if (FollowCamera && BaseFOV > 0.f)
	{
		const float TargetFOV = bIsSprinting ? BaseFOV + SprintFOVOffset : BaseFOV;
		FollowCamera->FieldOfView = FMath::FInterpTo(FollowCamera->FieldOfView, TargetFOV, DeltaTime, InterpSpeed);
	}
}

void AARPGCharacterBase::UpdateCameraZoom(float DeltaTime)
{
	if (!SpringArm) return;

	// Smoothly interpolate arm length toward desired value
	SpringArm->TargetArmLength = FMath::FInterpTo(
		SpringArm->TargetArmLength, DesiredArmLength, DeltaTime, ZoomInterpSpeed);
}

void AARPGCharacterBase::UpdateCameraRotation(float DeltaTime)
{
	if (!SpringArm) return;

	// Smoothly interpolate toward desired yaw
	CurrentCameraYaw = FMath::FInterpTo(CurrentCameraYaw, DesiredCameraYaw, DeltaTime, CameraRotationInterpSpeed);

	// Apply pitch + yaw rotation to spring arm
	SpringArm->SetRelativeRotation(FRotator(CameraPitchAngle, CurrentCameraYaw, 0.f));
}

void AARPGCharacterBase::UpdateCameraSway(float DeltaTime)
{
	if (!FollowCamera || !bEnableCameraSway) return;

	const FVector Velocity = GetVelocity();
	const float MaxSpeed = GetCharacterMovement() ? GetCharacterMovement()->MaxWalkSpeed : WalkSpeed;

	if (MaxSpeed <= 0.f) return;

	// Decompose velocity into camera-relative forward and right
	const FRotator CameraRot(0.f, CurrentCameraYaw, 0.f);
	const FVector CameraForward = FRotationMatrix(CameraRot).GetUnitAxis(EAxis::X);
	const FVector CameraRight = FRotationMatrix(CameraRot).GetUnitAxis(EAxis::Y);

	const float ForwardDot = FVector::DotProduct(Velocity, CameraForward);
	const float RightDot = FVector::DotProduct(Velocity, CameraRight);

	// Normalize to [-1, 1] based on current max speed
	const float ForwardFraction = FMath::Clamp(ForwardDot / MaxSpeed, -1.f, 1.f);
	const float RightFraction = FMath::Clamp(RightDot / MaxSpeed, -1.f, 1.f);

	// Target sway: strafe -> roll, forward/back -> slight pitch offset
	const float TargetRoll = -RightFraction * CameraSwayMaxRoll;
	const float TargetPitch = -ForwardFraction * CameraSwayMaxPitch;

	CurrentSwayRoll = FMath::FInterpTo(CurrentSwayRoll, TargetRoll, DeltaTime, CameraSwayInterpSpeed);
	CurrentSwayPitch = FMath::FInterpTo(CurrentSwayPitch, TargetPitch, DeltaTime, CameraSwayInterpSpeed);

	FollowCamera->SetRelativeRotation(FRotator(CurrentSwayPitch, 0.f, CurrentSwayRoll));
}

// =========================================================================
// Movement Gating
// =========================================================================

bool AARPGCharacterBase::CanMove() const
{
	if (IsDead()) return false;
	if (bIsDodging) return false;
	if (bIsAttacking) return false;
	if (bIsStaggered) return false;
	if (bIsStunned) return false;
	if (bIsHitReacting) return false;

	// Root motion from montages takes over — block voluntary input
	if (bRootMotionActive) return false;

	return true;
}

// =========================================================================
// Animation Blendspace Getters
// =========================================================================

float AARPGCharacterBase::GetSpeedRatio() const
{
	const UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	if (!MoveComp || MoveComp->MaxWalkSpeed <= 0.f) return 0.f;

	const float Speed = GetVelocity().Size2D();
	return FMath::Clamp(Speed / MoveComp->MaxWalkSpeed, 0.f, 1.f);
}

float AARPGCharacterBase::GetMovementDirection() const
{
	const FVector Velocity = GetVelocity();
	if (Velocity.Size2D() < 1.f) return 0.f;

	// Direction relative to character facing, in degrees (-180 to 180)
	const FVector Forward = GetActorForwardVector();
	const FVector VelDir = Velocity.GetSafeNormal2D();

	const float ForwardDot = FVector::DotProduct(Forward, VelDir);
	const float RightDot = FVector::DotProduct(GetActorRightVector(), VelDir);

	// atan2 gives us the signed angle
	return FMath::RadiansToDegrees(FMath::Atan2(RightDot, ForwardDot));
}

int32 AARPGCharacterBase::GetLocomotionState() const
{
	const float Ratio = GetSpeedRatio();
	if (Ratio < IdleSpeedThreshold) return 0; // Idle
	if (Ratio < RunSpeedThreshold)  return 1; // Walk
	return 2; // Run/Sprint
}

// =========================================================================
// Acceleration Curves
// =========================================================================

void AARPGCharacterBase::UpdateAcceleration()
{
	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	if (!MoveComp) return;

	const float SpeedRatio = GetSpeedRatio();

	if (AccelerationCurve)
	{
		// Use designer-authored curve: X = speed ratio, Y = acceleration multiplier
		const float Multiplier = AccelerationCurve->GetFloatValue(SpeedRatio);
		MoveComp->MaxAcceleration = AccelerationFromIdle * FMath::Max(Multiplier, 0.1f);
	}
	else
	{
		// Default: high acceleration at low speed, lower at full speed
		// This gives a snappy start with smooth top-end
		MoveComp->MaxAcceleration = FMath::Lerp(AccelerationFromIdle, AccelerationAtFullSpeed, SpeedRatio);
	}
}

// =========================================================================
// Speed-Dependent Rotation Rate
// =========================================================================

void AARPGCharacterBase::UpdateRotationRate()
{
	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	if (!MoveComp) return;

	// Don't modify rotation rate during dodge (it's disabled anyway)
	if (bIsDodging) return;

	// Lerp between idle (snappy) and at-speed (smooth) rotation rates
	const float SpeedRatio = GetSpeedRatio();
	const float Rate = FMath::Lerp(RotationRateIdle, RotationRateAtSpeed, SpeedRatio);
	MoveComp->RotationRate = FRotator(0.f, Rate, 0.f);
}

// =========================================================================
// Attribute Initialization
// =========================================================================

void AARPGCharacterBase::InitializeAttributes()
{
	if (!AbilitySystemComponent || !AttributeInitTable)
	{
		UE_LOG(LogTemp, Warning, TEXT("[%s] InitializeAttributes: missing ASC or AttributeInitTable"), *GetName());
		return;
	}

	// Look up the row from the Data Table
	const FARPGAttributeInitRow* Row = AttributeInitTable->FindRow<FARPGAttributeInitRow>(
		AttributeInitRowName, TEXT("InitializeAttributes"));

	if (!Row)
	{
		UE_LOG(LogTemp, Warning, TEXT("[%s] InitializeAttributes: row '%s' not found in DataTable"),
			*GetName(), *AttributeInitRowName.ToString());
		return;
	}

	// Helper: evaluate a curve multiplier for a given attribute at CharacterLevel.
	// Returns 1.0 if no CurveTable or row is missing.
	auto GetLevelMultiplier = [this](FName CurveRowName) -> float
	{
		if (!LevelScalingCurveTable) return 1.f;

		const FRealCurve* Curve = LevelScalingCurveTable->FindCurve(CurveRowName, TEXT("LevelScaling"), false);
		if (!Curve) return 1.f;

		return Curve->Eval(static_cast<float>(CharacterLevel));
	};

	// Build the GE spec with SetByCaller values = BaseValue * LevelMultiplier
	FGameplayEffectContextHandle Context = AbilitySystemComponent->MakeEffectContext();
	Context.AddSourceObject(this);

	FGameplayEffectSpecHandle SpecHandle = AbilitySystemComponent->MakeOutgoingSpec(
		UGE_InitAttributes::StaticClass(), static_cast<float>(CharacterLevel), Context);

	if (!SpecHandle.IsValid())
	{
		UE_LOG(LogTemp, Error, TEXT("[%s] InitializeAttributes: failed to create GE spec"), *GetName());
		return;
	}

	FGameplayEffectSpec* Spec = SpecHandle.Data.Get();

	// Set each attribute's init value: Base * CurveMultiplier(Level)
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_Health,         Row->Health         * GetLevelMultiplier(ARPGCurveRowNames::Health));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_MaxHealth,      Row->MaxHealth      * GetLevelMultiplier(ARPGCurveRowNames::MaxHealth));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_Mana,           Row->Mana           * GetLevelMultiplier(ARPGCurveRowNames::Mana));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_MaxMana,        Row->MaxMana        * GetLevelMultiplier(ARPGCurveRowNames::MaxMana));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_Strength,       Row->Strength       * GetLevelMultiplier(ARPGCurveRowNames::Strength));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_Dexterity,      Row->Dexterity      * GetLevelMultiplier(ARPGCurveRowNames::Dexterity));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_Intelligence,   Row->Intelligence   * GetLevelMultiplier(ARPGCurveRowNames::Intelligence));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_Armor,          Row->Armor          * GetLevelMultiplier(ARPGCurveRowNames::Armor));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_AttackPower,    Row->AttackPower    * GetLevelMultiplier(ARPGCurveRowNames::AttackPower));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_CriticalChance, Row->CriticalChance * GetLevelMultiplier(ARPGCurveRowNames::CriticalChance));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_CriticalDamage, Row->CriticalDamage * GetLevelMultiplier(ARPGCurveRowNames::CriticalDamage));

	// Resistances
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_FireResistance,      Row->FireResistance      * GetLevelMultiplier(ARPGCurveRowNames::FireResistance));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_IceResistance,       Row->IceResistance       * GetLevelMultiplier(ARPGCurveRowNames::IceResistance));
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_LightningResistance, Row->LightningResistance * GetLevelMultiplier(ARPGCurveRowNames::LightningResistance));

	// Progression attributes
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_CurrentXP, Row->CurrentXP);
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_CharacterLevel, Row->CharacterLevel);

	// XPToNextLevel: look up from dedicated XP curve table (absolute value, not a multiplier)
	float XPRequired = 100.f; // fallback for Level 1
	if (XPRequirementsCurveTable)
	{
		const FRealCurve* XPCurve = XPRequirementsCurveTable->FindCurve(
			ARPGCurveRowNames::XPToNextLevel, TEXT("XPRequirements"), false);
		if (XPCurve)
		{
			XPRequired = XPCurve->Eval(static_cast<float>(CharacterLevel));
		}
	}
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Init_XPToNextLevel, XPRequired);

	AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(*Spec);

	UE_LOG(LogTemp, Log, TEXT("[%s] Attributes initialized: Row='%s' Level=%d (MaxHP=%.0f, Str=%.0f, AP=%.0f, XPReq=%.0f)"),
		*GetName(), *AttributeInitRowName.ToString(), CharacterLevel,
		Row->MaxHealth * GetLevelMultiplier(ARPGCurveRowNames::MaxHealth),
		Row->Strength  * GetLevelMultiplier(ARPGCurveRowNames::Strength),
		Row->AttackPower * GetLevelMultiplier(ARPGCurveRowNames::AttackPower),
		XPRequired);
}

// =========================================================================
// Death
// =========================================================================

void AARPGCharacterBase::EnableRagdoll()
{
	USkeletalMeshComponent* MeshComp = GetMesh();
	if (!MeshComp) return;

	MeshComp->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	MeshComp->SetSimulatePhysics(true);
	MeshComp->SetAllBodiesSimulatePhysics(true);
	MeshComp->SetAllBodiesPhysicsBlendWeight(1.0f);
	MeshComp->bBlendPhysics = true;

	// Detach mesh from capsule so ragdoll isn't anchored
	MeshComp->DetachFromComponent(FDetachmentTransformRules::KeepWorldTransform);

	UE_LOG(LogTemp, Log, TEXT("[Death] Ragdoll enabled for %s"), *GetName());
}

// =========================================================================
// Motion Warping
// =========================================================================

void AARPGCharacterBase::SetAttackWarpTarget(const FVector& TargetLocation, FName WarpTargetName)
{
	if (!MotionWarpingComp) return;

	FMotionWarpingTarget WarpTarget;
	WarpTarget.Name = WarpTargetName;
	WarpTarget.Location = TargetLocation;
	WarpTarget.Rotation = (TargetLocation - GetActorLocation()).GetSafeNormal2D().Rotation();

	MotionWarpingComp->AddOrUpdateWarpTarget(WarpTarget);
}

void AARPGCharacterBase::SetAttackWarpTargetFromActor(AActor* TargetActor, FName WarpTargetName)
{
	if (!TargetActor || !MotionWarpingComp) return;

	FMotionWarpingTarget WarpTarget;
	WarpTarget.Name = WarpTargetName;
	WarpTarget.Location = TargetActor->GetActorLocation();
	WarpTarget.Rotation = (TargetActor->GetActorLocation() - GetActorLocation()).GetSafeNormal2D().Rotation();

	MotionWarpingComp->AddOrUpdateWarpTarget(WarpTarget);
}

void AARPGCharacterBase::ClearWarpTarget(FName WarpTargetName)
{
	if (!MotionWarpingComp) return;
	MotionWarpingComp->RemoveWarpTarget(WarpTargetName);
}
