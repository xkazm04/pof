/**
 * Acceptance for localization-pipeline/B (scan-sweep --challenge run challenge-2026-09-30a):
 * per-string pseudo-locale readiness. A fixed-width surface has a DECLARED char budget
 * (SURFACE_BUDGETS) and each overflow row cites it; descriptions/tooltips/dialogue reflow;
 * the SOURCE is flagged at >= 85% of its budget; FText::FromString bypasses the catalog;
 * a text_concatenation hazard at the string's location marks it a fragment.
 */
import { describe, it, expect } from 'vitest';
import { assessReadiness, SURFACE_BUDGETS } from '@/lib/localization/readiness';
import type {
  LocalizableString,
  LocalizationHazard,
  StringContext,
} from '@/types/localization-pipeline';

let seq = 0;
function str(
  sourceText: string,
  context: StringContext,
  currentUsage: LocalizableString['currentUsage'] = 'nsloctext',
  line = ++seq,
): LocalizableString {
  return {
    id: `str_${seq}_${context}`,
    sourceText,
    context,
    currentUsage,
    locNamespace: 'UI',
    locKey: `K${seq}`,
    locations: [{ filePath: 'Source/UI/Menu.cpp', lineNumber: line, columnStart: 1, columnEnd: 2, codeSnippet: '' }],
    sourceModule: 'ui',
    detectionConfidence: 0.9,
  };
}

describe('assessReadiness — verdicts against declared surface budgets', () => {
  it('case 5: fits / overflow / overflow / reflow; near-budget on the source; overflow cites its budget', () => {
    const tooltip = 'A'.repeat(60);
    const { rows } = assessReadiness(
      [
        str('Equip', 'ui_button'),
        str('Character Stats', 'menu_title'),
        str('Confirm Choice', 'ui_button'),
        str(tooltip, 'item_tooltip'),
      ],
      [],
    );
    expect(rows.map((r) => r.verdict)).toEqual(['fits', 'overflow', 'overflow', 'reflow']);
    expect(rows[2].sourceNearBudget).toBe(true); // 14 >= 0.85 * 16
    expect(rows[1].sourceNearBudget).toBe(false); // 15 < 0.85 * 24
    expect(SURFACE_BUDGETS.ui_button).toBe(16);
    expect(SURFACE_BUDGETS.menu_title).toBe(24);
    for (const r of rows.filter((x) => x.verdict === 'overflow')) {
      expect(r.budget).not.toBeNull();
      expect(r.budget!.chars).toBe(SURFACE_BUDGETS[r.budget!.surface as keyof typeof SURFACE_BUDGETS]);
    }
    expect(rows[1].budget).toEqual({ surface: 'menu_title', chars: 24 });
    expect(rows[2].budget).toEqual({ surface: 'ui_button', chars: 16 });
  });

  it('case 6: catalog bypass by usage; fragment from a text_concatenation hazard at the same location', () => {
    const fromString = str('Inventory', 'menu_title', 'ftext_fromstring');
    const macro = str('Options', 'menu_title', 'nsloctext');
    const concat = str('Restores ', 'item_tooltip', 'hardcoded');
    const hazard: LocalizationHazard = {
      id: 'haz_concat',
      type: 'text_concatenation',
      severity: 'critical',
      description: 'concat',
      evidence: 'FString Desc = TEXT("Restores ") + ...',
      location: { ...concat.locations[0] },
      suggestion: 'Use FText::Format',
      fixPrompt: 'fix',
    };
    const { rows } = assessReadiness([fromString, macro, concat], [hazard]);
    expect(rows[0].bypassesCatalog).toBe(true);
    expect(rows[1].bypassesCatalog).toBe(false);
    expect(rows[2].fragment).toBe(true);
    expect(rows[0].fragment).toBe(false);
    expect(rows[1].fragment).toBe(false);
  });
});
