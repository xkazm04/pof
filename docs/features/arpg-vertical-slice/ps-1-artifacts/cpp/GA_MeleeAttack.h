#pragma once

#include "CoreMinimal.h"
#include "AbilitySystem/ARPGGameplayAbility.h"
#include "GA_MeleeAttack.generated.h"

class UAnimMontage;
class UGameplayEffect;
class UAbilityTask_PlayMontageAndWait;
class UAbilityTask_WaitGameplayEvent;

/**
 * Melee attack ability with montage-driven combo chaining.
 *
 * Flow:
 *   1. ActivateAbility -> CommitAbility (cost/cooldown) -> set bIsAttacking
 *   2. PlayMontageAndWait starts the montage at section 0
 *   3. AnimNotify_ComboWindow fires Event.Combo.Open -> WaitGameplayEvent catches it
 *   4. If player presses attack during the combo window, we jump to the next section
 *   5. If the combo window closes without input, the montage finishes naturally
 *   6. OnMontageCompleted/Interrupted/Cancelled -> EndAbility, clear bIsAttacking
 *
 * Montage setup:
 *   The montage should have named sections (e.g., "Attack1", "Attack2", "Attack3")
 *   linked sequentially. Place AnimNotify_ComboWindow (bOpenWindow=true/false)
 *   in each section to define the input window.
 */
UCLASS()
class POF_API UGA_MeleeAttack : public UARPGGameplayAbility
{
	GENERATED_BODY()

public:
	UGA_MeleeAttack();

	virtual bool CanActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayTagContainer* SourceTags = nullptr, const FGameplayTagContainer* TargetTags = nullptr, FGameplayTagContainer* OptionalRelevantTags = nullptr) const override;
	virtual void ActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo, const FGameplayEventData* TriggerEventData) override;
	virtual void EndAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo, bool bReplicateEndAbility, bool bWasCancelled) override;

protected:
	/** The melee attack montage. Must have combo sections. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee")
	TObjectPtr<UAnimMontage> AttackMontage;

	/** Ordered list of section names in the montage for combo progression. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee")
	TArray<FName> ComboSectionNames;

	/** Play rate for the attack montage. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee", meta = (ClampMin = "0.1", ClampMax = "5.0"))
	float MontagePlayRate = 1.0f;

	// --- Damage ---

	/** Gameplay effect applied to each hit target (should be GE_Damage or subclass). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|Damage")
	TSubclassOf<UGameplayEffect> DamageEffect;

	/** Base damage per hit (passed as SetByCaller "Data.Damage.Base"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|Damage")
	float BaseDamage = 20.f;

	/** Per-combo-section damage multipliers. Index maps to ComboSectionNames. Falls back to 1.0 if missing. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|Damage")
	TArray<float> ComboDamageMultipliers;

	/**
	 * Fallback attack-window duration (seconds). If the attack montage fails to
	 * play (e.g. a gray-box character with no skeletal mesh, or an empty montage),
	 * the ability stays active for this long so the hit-detection / Event.MeleeHit
	 * listener can still resolve, then ends cleanly. Prevents the ability from
	 * self-cancelling and tearing down the hit listener before a hit lands.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee")
	float FallbackAttackWindow = 0.5f;

	// --- Motion Warping (attack magnetism) ---

	/** Whether to auto-acquire the nearest target and set a warp target before each attack. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|MotionWarping")
	bool bEnableAttackMagnetism = true;

	/** Max distance (cm) to search for a warp target in front of the character. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|MotionWarping", meta = (ClampMin = "0", EditCondition = "bEnableAttackMagnetism"))
	float WarpTargetSearchRadius = 400.f;

	/** Half-angle (degrees) of the forward cone used for target search. 90 = full hemisphere. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|MotionWarping", meta = (ClampMin = "0", ClampMax = "180", EditCondition = "bEnableAttackMagnetism"))
	float WarpTargetSearchAngle = 60.f;

	/** Name of the warp target (must match the name in the montage's MotionWarping notify). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|MotionWarping")
	FName WarpTargetName = TEXT("AttackTarget");

	/** Stop distance from the target — don't warp all the way into them. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|MotionWarping", meta = (ClampMin = "0", EditCondition = "bEnableAttackMagnetism"))
	float WarpStopDistance = 100.f;

private:
	/** Current combo section index (0-based). */
	int32 CurrentComboIndex = 0;

	/** Whether the player has buffered a combo input during the current window. */
	bool bComboInputBuffered = false;

	/** Whether the combo window is currently open. */
	bool bComboWindowOpen = false;

	/**
	 * True when the attack montage failed to play and the ability is being kept
	 * alive by the fallback timer instead. While set, the montage task's
	 * OnCancelled/OnInterrupted callbacks are ignored so they don't prematurely
	 * end the ability (and tear down the Event.MeleeHit listener).
	 */
	bool bUsingFallbackWindow = false;

	/** Start the montage and bind tasks. */
	void StartMontageAndListenForCombo();

	/** Listen for the combo open event. */
	void ListenForComboWindow();

	// --- Task callbacks ---
	UFUNCTION()
	void OnComboWindowOpened(FGameplayEventData Payload);

	UFUNCTION()
	void OnComboWindowClosed(FGameplayEventData Payload);

	UFUNCTION()
	void OnMontageCompleted();

	UFUNCTION()
	void OnMontageBlendOut();

	UFUNCTION()
	void OnMontageInterrupted();

	UFUNCTION()
	void OnMontageCancelled();

	/** Fired when the fallback attack-window timer elapses (used when the montage fails to play). */
	UFUNCTION()
	void OnFallbackWindowElapsed();

	UFUNCTION()
	void OnComboInputReceived(FGameplayEventData Payload);

	UFUNCTION()
	void OnMeleeHit(FGameplayEventData Payload);

	/** Advance to the next combo section if possible. */
	void AdvanceCombo();

	/** Find the nearest valid target in a forward cone and set the motion warp target. */
	void AcquireWarpTarget();

	/** Clear the warp target on the owning character. */
	void ClearWarpTarget();
};
