// /diablo W10 (D6): the schema-down snapshot was `{}`, and its regex matched 2 of 9 row structs: it could not skip an
// export macro (`struct POF_API FRow`), skipped every field with a default (`float X = 1.f;`), and never read a data
// asset class (UARPGItemDefinition). One parser, over header TEXT, used by the snapshot script and these tests.
import { describe, it, expect } from 'vitest';
import { parseUeTypes } from '@/lib/catalog/ue-schema';

const HEADER = `
USTRUCT(BlueprintType)
struct POF_API FAffixTableRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Affix")
	FGameplayTag AffixTag;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Affix", meta = (ClampMin = "0"))
	float MinValue = 1.f;

	UPROPERTY(EditAnywhere)
	TSubclassOf<UGameplayEffect> Effect;

	UPROPERTY(EditAnywhere) bool bIsPrefix = true;
};

UCLASS(BlueprintType)
class POF_API UARPGItemDefinition : public UPrimaryDataAsset
{
	GENERATED_BODY()
public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	FText DisplayName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item|Equip",
		meta = (EditCondition = "Type == EItemType::Equipment"))
	TArray<EEquipmentSlot> AllowedSlots;

	UPROPERTY(EditDefaultsOnly, Category = "Item")
	TObjectPtr<UTexture2D> Icon = nullptr;

	void NotAProperty();
	int32 AlsoNotAProperty = 0;
};

struct FPlainStruct { UPROPERTY() int32 Hidden; };
`;

describe('parseUeTypes', () => {
  const out = parseUeTypes(HEADER);

  it('reads a row struct behind an export macro, including fields with defaults and one-line properties', () => {
    expect(out.FAffixTableRow).toEqual(['AffixTag', 'MinValue', 'Effect', 'bIsPrefix']);
  });

  it('reads a data-asset class and its UPROPERTY fields only (multi-line meta, templates, defaults)', () => {
    expect(out.UARPGItemDefinition).toEqual(['DisplayName', 'AllowedSlots', 'Icon']);
  });

  it('ignores types that are neither a table row nor a data asset', () => {
    expect(out.FPlainStruct).toBeUndefined();
  });
});
