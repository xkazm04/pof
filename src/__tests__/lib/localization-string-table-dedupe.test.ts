import { describe, it, expect } from 'vitest';
import { scanFromUnits, generateStringTable } from '@/lib/localization/scan-engine';
import type { RawStringUnit } from '@/types/localization-pipeline';

function unit(text: string, filePath: string, key?: string): RawStringUnit {
  const snippet = `Label = FText::FromString(TEXT("${text}"));`;
  return { text, usage: 'ftext_fromstring', filePath, line: 1, column: 1, snippet, identifierHint: 'Label', key };
}

describe('generateStringTable key uniqueness', () => {
  it('merges one literal found in two files into one row for its key', () => {
    const scan = scanFromUnits([unit('Inventory', 'Source/UI/Hud.cpp'), unit('Inventory', 'Source/UI/Menu.cpp')]);
    const rows = generateStringTable(scan.strings, 'PoF').flatMap((t) => t.rows);
    const keys = rows.map((r) => r.key);
    expect(scan.strings).toHaveLength(2);
    expect(keys.length).toBe(new Set(keys).size);
    expect(rows).toHaveLength(1);
  });

  it('keeps and flags a same-key different-source collision', () => {
    const scan = scanFromUnits([unit('Alpha', 'Source/UI/A.cpp', 'Shared_Key'), unit('Beta', 'Source/UI/B.cpp', 'Shared_Key')]);
    const rows = generateStringTable(scan.strings, 'PoF').flatMap((t) => t.rows);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.comment.includes('KEY COLLISION'))).toBe(true);
  });
});
