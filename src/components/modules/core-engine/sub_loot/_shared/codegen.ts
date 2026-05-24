import type { LootEditorEntry, UE5LootEntry, UE5LootTableJson, EnemyLootBinding } from './data';
import { RARITY_COLOR_MAP, RARITY_ENUM_VALUES } from './data';
import { STATUS_MUTED } from '@/lib/chart-colors';

/* -- UE5 Import helpers --------------------------------------------------- */

export function resolveRarityName(value: string | number | undefined): string {
  if (value === undefined) return 'Common';
  if (typeof value === 'number') return RARITY_ENUM_VALUES[value] ?? 'Common';
  const stripped = String(value).replace(/^.*::/, '');
  return RARITY_ENUM_VALUES.find(r => r.toLowerCase() === stripped.toLowerCase()) ?? stripped;
}

export function resolveItemName(item: UE5LootEntry['Item']): string {
  if (!item) return 'Unknown Item';
  if (typeof item === 'string') {
    const match = item.match(/([^/.]+)(?:\.[^/.]+)?$/);
    return match ? match[1].replace(/^IT_/, '').replace(/_/g, ' ') : item;
  }
  return item.Name ?? item.AssetName ?? item.ObjectName ?? 'Unknown Item';
}

export function parseUE5LootTable(json: UE5LootTableJson): { entries: LootEditorEntry[]; nothingWeight: number } {
  const props = json.Properties ?? json;
  const rawEntries = props.Entries ?? [];
  const nothingWeight = props.NothingWeight ?? 0;

  const entries: LootEditorEntry[] = rawEntries.map((entry, i) => {
    const minRarity = resolveRarityName(entry.MinRarity);
    const maxRarity = resolveRarityName(entry.MaxRarity);
    return {
      id: `ue5_${i}_${Date.now()}`,
      name: resolveItemName(entry.Item),
      weight: entry.DropWeight ?? 1,
      rarity: minRarity,
      color: RARITY_COLOR_MAP[minRarity] ?? STATUS_MUTED,
      minQuantity: entry.MinQuantity ?? 1,
      maxQuantity: entry.MaxQuantity ?? 1,
      minRarity,
      maxRarity,
    };
  });

  return { entries, nothingWeight };
}

/* -- UE5 Export helpers --------------------------------------------------- */

export function generateUE5LootTableJson(entries: LootEditorEntry[], nothingWeight: number): string {
  const ue5Entries = entries.map(e => ({
    Item: e.name,
    DropWeight: e.weight,
    MinQuantity: e.minQuantity ?? 1,
    MaxQuantity: e.maxQuantity ?? 1,
    MinRarity: `EARPGItemRarity::${e.minRarity ?? e.rarity}`,
    MaxRarity: `EARPGItemRarity::${e.maxRarity ?? e.rarity}`,
  }));
  return JSON.stringify({ Entries: ue5Entries, NothingWeight: nothingWeight }, null, 2);
}

export function generateUE5LootTableCpp(entries: LootEditorEntry[], nothingWeight: number): string {
  const lines = [
    '// --- Generated UARPGLootTable Configuration ---',
    '// Paste into your data asset constructor or use as reference for Blueprint defaults.',
    '//',
    `// NothingWeight = ${nothingWeight.toFixed(1)}f;`,
    '//',
    '// Entries:',
  ];
  for (const e of entries) {
    lines.push(`// {`);
    lines.push(`//     Item = "${e.name}",`);
    lines.push(`//     DropWeight = ${e.weight.toFixed(1)}f,`);
    lines.push(`//     MinQuantity = ${e.minQuantity ?? 1},`);
    lines.push(`//     MaxQuantity = ${e.maxQuantity ?? 1},`);
    lines.push(`//     MinRarity = EARPGItemRarity::${e.minRarity ?? e.rarity},`);
    lines.push(`//     MaxRarity = EARPGItemRarity::${e.maxRarity ?? e.rarity},`);
    lines.push(`// },`);
  }
  lines.push('');
  lines.push('// --- C++ setup (call in constructor or PostInitProperties) ---');
  lines.push('');
  lines.push(`NothingWeight = ${nothingWeight.toFixed(1)}f;`);
  lines.push('');
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    lines.push(`{`);
    lines.push(`\tFLootEntry& E = Entries.AddDefaulted_GetRef();`);
    lines.push(`\t// E.Item = LoadObject<UARPGItemDefinition>(nullptr, TEXT("/Game/Items/${e.name.replace(/ /g, '_')}"));`);
    lines.push(`\tE.DropWeight = ${e.weight.toFixed(1)}f;`);
    lines.push(`\tE.MinQuantity = ${e.minQuantity ?? 1};`);
    lines.push(`\tE.MaxQuantity = ${e.maxQuantity ?? 1};`);
    lines.push(`\tE.MinRarity = EARPGItemRarity::${e.minRarity ?? e.rarity};`);
    lines.push(`\tE.MaxRarity = EARPGItemRarity::${e.maxRarity ?? e.rarity};`);
    lines.push(`}`);
  }
  return lines.join('\n');
}

/* -- Enemy loot C++ codegen ----------------------------------------------- */

export function generateEnemyLootCpp(bindings: EnemyLootBinding[]): string {
  return `// Add to ARPGEnemyCharacter.h -- protected section:
//
// /** Loot table to roll on death. Assign per-archetype in the enemy BP. */
// UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot")
// TObjectPtr<UARPGLootTable> LootTable;
//
// /** Chance to drop any item on death [0.0 - 1.0]. */
// UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loot", meta = (ClampMin = "0.0", ClampMax = "1.0"))
// float DropChance = 0.3f;
//
// /** Bonus gold dropped on death. */
// UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loot", meta = (ClampMin = "0"))
// int32 BonusGold = 15;

// --- Add to OnDeathFromAbility() in ARPGEnemyCharacter.cpp ---

void AARPGEnemyCharacter::OnDeathFromAbility(AActor* KillingActor)
{
\t// ... existing XP award code ...

\t// Loot drop
\tif (LootTable && FMath::FRand() <= DropChance)
\t{
\t\tFARPGLootResult LootResult;
\t\tif (LootTable->RollLoot(CharacterLevel, LootResult))
\t\t{
\t\t\t// Spawn world item at death location
\t\t\tconst FVector SpawnLoc = GetActorLocation() + FVector(0, 0, 50.f);
\t\t\tFActorSpawnParameters SpawnParams;
\t\t\tSpawnParams.SpawnCollisionHandlingOverride =
\t\t\t\tESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

\t\t\tif (AARPGWorldItem* WorldItem = GetWorld()->SpawnActor<AARPGWorldItem>(
\t\t\t\tAARPGWorldItem::StaticClass(), SpawnLoc, FRotator::ZeroRotator, SpawnParams))
\t\t\t{
\t\t\t\tWorldItem->InitFromLootResult(LootResult);
\t\t\t}
\t\t}
\t}

\t// Gold drop
\tif (BonusGold > 0 && KillingActor)
\t{
\t\tif (AARPGPlayerCharacter* Player = Cast<AARPGPlayerCharacter>(KillingActor))
\t\t{
\t\t\t// Player->AddGold(BonusGold);
\t\t}
\t}

\t// ... existing death broadcast ...
}

// --- Default values per archetype (set in constructor or BP) ---
${bindings.map(b => `// ${b.archetypeName}: LootTable=${b.lootTableName}, DropChance=${b.dropChance.toFixed(2)}, Gold=${b.bonusGold}`).join('\n')}
`;
}
