import { describe, it, expect } from 'vitest';
import { ARPG_CHECKLISTS } from '@/lib/module-registry';
import type { ChecklistItem } from '@/types/modules';

function uiItem(id: string): ChecklistItem {
  const list = (ARPG_CHECKLISTS as Record<string, ChecklistItem[]>)['arpg-ui'];
  const item = list?.find((x) => x.id === id);
  if (!item) throw new Error(`No arpg-ui checklist item ${id}`);
  return item;
}

describe('arpg-ui HUD prompts default to the pure-C++ widget pattern', () => {
  it('au-1 instructs RebuildWidget-based tree construction', () => {
    expect(uiItem('au-1').prompt).toMatch(/RebuildWidget/);
  });

  it('au-1 forbids BindWidget for the slice HUD', () => {
    const p = uiItem('au-1').prompt;
    expect(p).toMatch(/BindWidget/);
    expect(p).toMatch(/do not use `?BindWidget`?|don't use `?BindWidget`?|no companion Widget Blueprint/i);
  });

  it('au-1 requires an explicit ProgressBar style (dark track + bright fill)', () => {
    const p = uiItem('au-1').prompt;
    expect(p).toMatch(/ProgressBar/);
    expect(p).toMatch(/FProgressBarStyle|dark track/i);
  });

  it('pure-C++ HUD prompts name UARPGCodeWidgetBase as the parent class', () => {
    for (const id of ['au-1', 'au-3', 'au-4', 'au-7', 'au-8']) {
      expect(uiItem(id).prompt).toMatch(/UARPGCodeWidgetBase/);
    }
  });

  it('au-7 references the pure-C++ damage-number manager + widget pattern', () => {
    const p = uiItem('au-7').prompt;
    expect(p).toMatch(/RebuildWidget/);
    expect(p).toMatch(/BindWidgetOptional/);
  });
});

describe('arpg-ui widget-creating HUD steps carry the pure-C++ default', () => {
  for (const id of ['au-3', 'au-4', 'au-8']) {
    it(`${id} instructs RebuildWidget-based tree construction`, () => {
      expect(uiItem(id).prompt).toMatch(/RebuildWidget/);
    });

    it(`${id} forbids BindWidget / a companion WBP`, () => {
      expect(uiItem(id).prompt).toMatch(
        /do not use `?BindWidget`?|don't use `?BindWidget`?|no companion Widget Blueprint/i,
      );
    });
  }

  it('au-3 styles its ProgressBar explicitly (dark track + bright fill)', () => {
    expect(uiItem('au-3').prompt).toMatch(/FProgressBarStyle|dark track/i);
  });
});
