USTRUCT() struct FARPGCurrencyDef : public FTableRowBase {
  GENERATED_BODY()
  UPROPERTY(EditAnywhere) FText DisplayName;
  UPROPERTY(EditAnywhere) float Cap;
};
