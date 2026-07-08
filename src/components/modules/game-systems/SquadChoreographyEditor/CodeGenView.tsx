import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { OPACITY_10 } from '@/lib/chart-colors';
import type { DirectorConfig } from '@/types/squad-tactics';
import { ACCENT } from './constants';

/* ── UE5 Code Generation View ─────────────────────────────────────────────── */

export function CodeGenView({ config }: { config: DirectorConfig }) {
  const code = useMemo(() => {
    const roleEntries = config.formation.roles
      .map(({ role, count }) => `    { ESquadRole::${role.charAt(0).toUpperCase() + role.slice(1)}, ${count} }`)
      .join(',\n');

    return `// ── UARPGSquadDirector.h ──────────────────────────────────────────────
// AI Director that composes EQS queries across a squad for coordinated tactics.
// Generated for "${config.formation.name}" formation.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "EnvironmentQuery/EnvQueryManager.h"
#include "UARPGSquadDirector.generated.h"

UENUM(BlueprintType)
enum class ESquadRole : uint8
{
    Aggressor   UMETA(DisplayName = "Aggressor"),
    Flanker     UMETA(DisplayName = "Flanker"),
    Support     UMETA(DisplayName = "Support"),
    Tank        UMETA(DisplayName = "Tank"),
    Ambusher    UMETA(DisplayName = "Ambusher"),
};

USTRUCT(BlueprintType)
struct FSquadRoleAssignment
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    ESquadRole Role = ESquadRole::Aggressor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Count = 1;
};

USTRUCT(BlueprintType)
struct FSquadFormation
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName FormationName = TEXT("${config.formation.name}");

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FSquadRoleAssignment> Roles = {
${roleEntries}
    };

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float AttackDistance = ${config.attackDistance}.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float FlankWeight = ${config.flankWeight.toFixed(2)}f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float SeparationWeight = ${config.separationWeight.toFixed(2)}f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float RangeWeight = ${config.rangeWeight.toFixed(2)}f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MinSeparation = ${config.minSeparation}.0f;
};

UCLASS()
class UARPGSquadDirector : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    /** Register a squad of AI controllers for coordinated positioning. */
    UFUNCTION(BlueprintCallable, Category = "AI|Squad")
    void RegisterSquad(
        FName SquadId,
        const TArray<AAIController*>& Members,
        const FSquadFormation& Formation
    );

    /**
     * Allocate positions for the entire squad.
     * Runs EQS queries sequentially by role priority:
     *   Tank/Aggressor first → Flanker → Support/Ambusher
     * Each query includes an AllySeparation test scored against
     * previously allocated positions.
     */
    UFUNCTION(BlueprintCallable, Category = "AI|Squad")
    void AllocateSquadPositions(FName SquadId, AActor* TargetActor);

    /** Get the allocated position for a specific squad member. */
    UFUNCTION(BlueprintPure, Category = "AI|Squad")
    FVector GetAllocatedPosition(AAIController* Member) const;

    /** Get the role assigned to a member. */
    UFUNCTION(BlueprintPure, Category = "AI|Squad")
    ESquadRole GetMemberRole(AAIController* Member) const;

private:
    /** Compose EQS query for a role with ally-awareness. */
    UEnvQuery* ComposeQueryForRole(
        ESquadRole Role,
        const TArray<FVector>& AllocatedPositions
    ) const;

    /** Score a candidate position for the given role. */
    float ScorePosition(
        const FVector& Candidate,
        ESquadRole Role,
        const FVector& TargetForward,
        const TArray<FVector>& AllocatedPositions,
        const FSquadFormation& Formation
    ) const;

    TMap<FName, TArray<AAIController*>> Squads;
    TMap<FName, FSquadFormation> SquadFormations;
    TMap<AAIController*, FVector> AllocatedPositions;
    TMap<AAIController*, ESquadRole> MemberRoles;
};`;
  }, [config]);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="squad-codegen-view">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT}${OPACITY_10}` }}
        >
          <Users className="w-4 h-4" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">UE5 C++ Preview</h3>
          <p className="text-2xs text-text-muted">
            <code className="font-mono">UARPGSquadDirector</code> — WorldSubsystem for squad-level EQS composition
          </p>
        </div>
        <span
          className="text-2xs font-mono px-2 py-1 rounded"
          style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT }}
        >
          {config.formation.name} Formation
        </span>
      </div>

      <div className="overflow-x-auto">
        <pre className="p-4 text-2xs font-mono text-text leading-relaxed whitespace-pre">
          {code}
        </pre>
      </div>
    </SurfaceCard>
  );
}
