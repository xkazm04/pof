/**
 * Localization scan over REAL C++ text (scan-sweep challenge localization-pipeline/A).
 *
 * `extractStrings(relPath, content)` turns one source file into units carrying their real
 * file:line, classifies non-user-facing literals out (UE_LOG text is 'log', never counted),
 * and counts every literal independently so the walk reconciles: literalsSeen === units +
 * excluded. `scanFromUnits` runs the six hazard rules over those units, so a hazard's
 * location and fix prompt cite the line that actually holds the code.
 */
import { describe, it, expect } from 'vitest';
import { extractStrings } from '@/lib/localization/extract';
import { scanFromUnits } from '@/lib/localization/scan-engine';

describe('extractStrings', () => {
  it('case 1: FText::FromString(TEXT(..)) -> one unit with its real line and snippet', () => {
    const src = 'void W::Init()\n{\n  EquipButton->SetText(FText::FromString(TEXT("Equip")));\n}';
    const { units } = extractStrings('Source/UI/WBP_Menu.cpp', src);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      text: 'Equip',
      usage: 'ftext_fromstring',
      line: 3,
      filePath: 'Source/UI/WBP_Menu.cpp',
    });
    expect(units[0].snippet).toBe(src.split('\n')[2].trim());
  });

  it('case 2: LOCTEXT takes its namespace from #define LOCTEXT_NAMESPACE; NSLOCTEXT is localized', () => {
    const src = '#define LOCTEXT_NAMESPACE "Inventory"\nLOCTEXT("DropKey", "Drop")\nNSLOCTEXT("Game.UI", "Play", "Play")';
    const { units } = extractStrings('Source/UI/WBP_Inventory.cpp', src);
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ text: 'Drop', usage: 'loctext', line: 2, namespace: 'Inventory', key: 'DropKey' });
    expect(units[1]).toMatchObject({ text: 'Play', usage: 'nsloctext', line: 3 });
  });

  it('case 3: UE_LOG text is classified out as log, and the independent literal count reconciles', () => {
    const { units, excluded, literalsSeen } = extractStrings(
      'Source/Game/Spawner.cpp',
      'UE_LOG(LogTemp, Warning, TEXT("Spawned %s"), *Name);',
    );
    expect(units).toEqual([]);
    expect(excluded.map((e) => ({ class: e.class, line: e.line }))).toEqual([{ class: 'log', line: 1 }]);
    expect(literalsSeen).toBe(1);
    expect(literalsSeen).toBe(units.length + excluded.length);
  });

  it('never counts commented code, reflection metadata or string-table keys as text, and still reconciles', () => {
    const src = [
      '// Label->SetText(FText::FromString(TEXT("Commented")));',
      '/* FText::FromString("Block") */ UPROPERTY(EditAnywhere, Category = "Combat")',
      'Title->SetText(FText::FromStringTable("ST_Menu", "Title"));',
      'const TCHAR Q = \'"\'; Hint->SetText(FText::FromString("Real")); // "tail"',
    ].join('\n');
    const { units, excluded, literalsSeen } = extractStrings('Source/UI/W.cpp', src);
    expect(units.map((u) => [u.text, u.line])).toEqual([['Real', 4]]);
    expect(excluded.map((e) => e.class).sort()).toEqual(['loc-key', 'loc-key', 'metadata']);
    expect(literalsSeen).toBe(units.length + excluded.length);
  });
});

describe('scanFromUnits', () => {
  it('case 4: a concatenation hazard cites the real file:line in its location and fix prompt', () => {
    const src = [
      '#include "Consumable.h"',
      '',
      'void UConsumable::Describe(int32 Amount)',
      '{',
      '  FString Desc = TEXT("Restores ") + FString::FromInt(Amount) + TEXT(" Health");',
    ].join('\n');
    const scan = scanFromUnits(extractStrings('Source/Items/Consumable.cpp', src).units);
    const concat = scan.hazards.find((h) => h.type === 'text_concatenation');
    expect(concat).toBeDefined();
    expect(concat!.location.filePath).toBe('Source/Items/Consumable.cpp');
    expect(concat!.location.lineNumber).toBe(5);
    expect(concat!.fixPrompt).toContain('Consumable.cpp:5');
  });
});
