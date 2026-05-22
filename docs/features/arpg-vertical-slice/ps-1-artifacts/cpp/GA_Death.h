#pragma once

#include "CoreMinimal.h"
#include "AbilitySystem/ARPGGameplayAbility.h"
#include "GA_Death.generated.h"

class UAbilityTask_PlayMontageAndWait;

/**
 * Death ability — activated by Event.Death from the attribute set.
 *
 * Flow:
 *   1. PostGameplayEffectExecute detects Health <= 0 → sends Event.Death
 *   2. GA_Death activates via WaitGameplayEvent (event-triggered)
 *   3. Grants State.Dead via ActivationOwnedTags → blocks all other abilities
 *   4. Cancels all active abilities, disables movement
 *   5. Plays death montage via PlayMontageAndWait
 *   6. On montage end: optionally enables ragdoll, broadcasts OnDeathFinished
 *   7. Player: disables input, schedules respawn via player character
 *   8. Enemy: triggers loot drop delegate, starts destroy timer
 *
 * The ability never calls EndAbility — State.Dead persists until
 * explicitly cleared (e.g., by respawn logic removing the tag).
 */
UCLASS()
class POF_API UGA_Death : public UARPGGameplayAbility
{
	GENERATED_BODY()

public:
	UGA_Death();

	virtual void ActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo, const FGameplayEventData* TriggerEventData) override;

protected:
	/** Whether to enable ragdoll physics after the death montage finishes. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Death")
	bool bEnableRagdollAfterMontage = true;

	/** Delay after death montage before enemies are destroyed. 0 = never auto-destroy. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Death|Enemy")
	float EnemyDestroyDelay = 5.0f;

	/** Play rate for the death montage. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Death", meta = (ClampMin = "0.1", ClampMax = "5.0"))
	float MontagePlayRate = 1.0f;

private:
	UFUNCTION()
	void OnMontageCompleted();

	UFUNCTION()
	void OnMontageBlendOut();

	UFUNCTION()
	void OnMontageInterrupted();

	UFUNCTION()
	void OnMontageCancelled();

	/** Common logic after montage finishes or is skipped. */
	void OnDeathMontageFinished();

	/** Guards against double invocation of OnDeathMontageFinished (OnBlendOut + OnCompleted
	 *  both fire when a real death montage plays, which would double-broadcast
	 *  OnDeathFinished and call SetLifeSpan twice). */
	bool bDeathMontageFinished = false;
};
