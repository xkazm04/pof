import type { LootEditorEntry, LootSource, UE5LootEntry, UE5LootTableJson, EnemyLootBinding } from './data';
import { RARITY_COLOR_MAP, RARITY_ENUM_VALUES } from './data';
import { STATUS_MUTED } from '@/lib/chart-colors';

/* -- UE5 Import helpers --------------------------------------------------- */

const VALID_LOOT_SOURCES: LootSource[] = ['enemy', 'chest', 'quest', 'crafting'];

/**
 * Resolve a UE5 `Source` field (which may be an enum-qualified string like
 * `ELootSource::Chest`, a bare word, or absent) to a valid LootSource. Falls
 * back to 'enemy' when missing/unrecognized so an external export without source
 * data still imports, but a real source is never silently dropped.
 */
export function resolveLootSource(value: unknown): LootSource {
  if (typeof value === 'string') {
    const stripped = value.replace(/^.*::/, '').toLowerCase();
    const found = VALID_LOOT_SOURCES.find((s) => s === stripped);
    if (found) return found;
  }
  return 'enemy';
}

export function resolveRarityName(value: string | number | undefined): string {
  if (value === undefined) return 'Common';
  if (typeof value === 'number') return RARITY_ENUM_VALUES[value] ?? 'Common';
  const stripped = String(value).replace(/^.*::/, '');
  return RARITY_ENUM_VALUES.find(r => r.toLowerCase() === stripped.toLowerCase()) ?? stripped;
}

/**
 * Clamp a rarity to a real EARPGItemRarity value. Anything outside the enum (an unknown
 * imported name) becomes 'Common' so generated C++/JSON never names a value UE rejects.
 */
function enumRarity(value: string | undefined): string {
  const raw = value ?? 'Common';
  return RARITY_ENUM_VALUES.includes(raw) ? raw : 'Common';
}

function isKnownRarity(value: string | number | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === 'number') return RARITY_ENUM_VALUES[value] !== undefined;
  const stripped = String(value).replace(/^.*::/, '').toLowerCase();
  return RARITY_ENUM_VALUES.some(r => r.toLowerCase() === stripped);
}

export function resolveItemName(item: UE5LootEntry['Item']): string {
  if (!item) return 'Unknown Item';
  if (typeof item === 'string') {
    const match = item.match(/([^/.]+)(?:\.[^/.]+)?$/);
    return match ? match[1].replace(/^IT_/, '').replace(/_/g, ' ') : item;
  }
  return item.Name ?? item.AssetName ?? item.ObjectName ?? 'Unknown Item';
}

/**
 * Coerce an imported numeric field to a finite, non-negative number. The UE5 import is a
 * trust boundary (arbitrary user JSON): `??` only guards null/undefined, so a string,
 * NaN, negative, or Infinity DropWeight would otherwise pass straight through and poison
 * the weight sum (one NaN → NaN%), the live-preview bars, and the regenerated UE5 codegen.
 */
function finiteNonNeg(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseUE5LootTable(
  json: UE5LootTableJson,
): { entries: (LootEditorEntry & { source: LootSource })[]; nothingWeight: number; warnings: string[] } {
  // Valid JSON of the wrong shape (null, an array, a non-array Entries, a null row) imports
  // as "no entries" instead of throwing into the caller's "Failed to parse JSON" catch.
  const root: Record<string, unknown> = isRecord(json) ? json : {};
  const props = isRecord(root.Properties) ? root.Properties : root;
  const rawEntries = (Array.isArray(props.Entries) ? props.Entries : []).filter(isRecord) as UE5LootEntry[];
  const nothingWeight = finiteNonNeg(props.NothingWeight, 0);
  const warnings: string[] = [];

  const entries = rawEntries.map((entry, i) => {
    const rowName = resolveItemName(entry.Item);
    // An unknown rarity is mapped to Common (never carried into codegen) and reported by row.
    const rarityOf = (raw: string | number | undefined, field: string): string => {
      if (!isKnownRarity(raw)) {
        warnings.push(`Row ${i + 1} "${rowName}": unknown ${field} "${String(raw)}" mapped to Common.`);
        return 'Common';
      }
      return resolveRarityName(raw);
    };
    const minRarity = rarityOf(entry.MinRarity, 'MinRarity');
    const maxRarity = rarityOf(entry.MaxRarity, 'MaxRarity');
    // UE5 rolls RandRange(Min, Max): normalise an inverted range so it never round-trips.
    const qa = finiteNonNeg(entry.MinQuantity, 1);
    const qb = finiteNonNeg(entry.MaxQuantity, 1);
    return {
      id: `ue5_${i}_${Date.now()}`,
      name: resolveItemName(entry.Item),
      weight: finiteNonNeg(entry.DropWeight, 1),
      rarity: minRarity,
      color: RARITY_COLOR_MAP[minRarity] ?? STATUS_MUTED,
      minQuantity: Math.min(qa, qb),
      maxQuantity: Math.max(qa, qb),
      minRarity,
      maxRarity,
      // Carry the real loot source through import instead of hardcoding 'enemy'.
      source: resolveLootSource(entry.Source),
    };
  });

  return { entries, nothingWeight, warnings };
}

/* -- UE5 Export helpers --------------------------------------------------- */

export function generateUE5LootTableJson(entries: (LootEditorEntry & { source?: LootSource })[], nothingWeight: number): string {
  const ue5Entries = entries.map(e => ({
    Item: e.name,
    DropWeight: e.weight,
    MinQuantity: e.minQuantity ?? 1,
    MaxQuantity: e.maxQuantity ?? 1,
    MinRarity: `EARPGItemRarity::${enumRarity(e.minRarity ?? e.rarity)}`,
    MaxRarity: `EARPGItemRarity::${enumRarity(e.maxRarity ?? e.rarity)}`,
    // Emit source so an export → re-import round-trip preserves it.
    ...(e.source ? { Source: e.source } : {}),
  }));
  return JSON.stringify({ Entries: ue5Entries, NothingWeight: nothingWeight }, null, 2);
}

/** Imported text going into a // comment: line breaks would end the comment and start live code. */
const commentSafe = (text: string): string => text.replace(/[\r\n\u2028\u2029\u0085]+/g, ' ');
/** Imported text going into a UE asset path: UE-legal charset only (letters, digits, _ and -). */
const assetPathSafe = (text: string): string => text.replace(/[^A-Za-z0-9_-]/g, '_');

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
    lines.push(`//     Item = "${commentSafe(e.name)}",`);
    lines.push(`//     DropWeight = ${e.weight.toFixed(1)}f,`);
    lines.push(`//     MinQuantity = ${e.minQuantity ?? 1},`);
    lines.push(`//     MaxQuantity = ${e.maxQuantity ?? 1},`);
    lines.push(`//     MinRarity = EARPGItemRarity::${enumRarity(e.minRarity ?? e.rarity)},`);
    lines.push(`//     MaxRarity = EARPGItemRarity::${enumRarity(e.maxRarity ?? e.rarity)},`);
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
    lines.push(`\t// E.Item = LoadObject<UARPGItemDefinition>(nullptr, TEXT("/Game/Items/${assetPathSafe(e.name)}"));`);
    lines.push(`\tE.DropWeight = ${e.weight.toFixed(1)}f;`);
    lines.push(`\tE.MinQuantity = ${e.minQuantity ?? 1};`);
    lines.push(`\tE.MaxQuantity = ${e.maxQuantity ?? 1};`);
    lines.push(`\tE.MinRarity = EARPGItemRarity::${enumRarity(e.minRarity ?? e.rarity)};`);
    lines.push(`\tE.MaxRarity = EARPGItemRarity::${enumRarity(e.maxRarity ?? e.rarity)};`);
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
