#pragma once

#include "CoreMinimal.h"
#include "FunctionalTest.h"
#include "VSFunctionalTest.generated.h"

/** Verifies the gray-box vertical slice: movement, attack activation, damage, death+loot. */
UCLASS()
class POF_API AVSFunctionalTest : public AFunctionalTest
{
	GENERATED_BODY()

public:
	AVSFunctionalTest();

	virtual void PrepareTest() override;
	virtual void StartTest() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	int32 Phase = 0;
	float PhaseTime = 0.f;
	FVector StartLocation = FVector::ZeroVector;
	float EnemyStartHealth = 0.f;
	TWeakObjectPtr<class AARPGEnemyCharacter> Enemy;
	TWeakObjectPtr<class AARPGPlayerCharacter> Player;
};
