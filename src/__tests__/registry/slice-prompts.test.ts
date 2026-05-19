import { describe, it, expect } from 'vitest';
import { ARPG_CHECKLISTS, SUB_MODULES } from '@/lib/module-registry';
import { MODULE_CONTEXTS } from '@/lib/evaluator/module-eval-prompts';
import type { ChecklistItem, SubModuleDefinition } from '@/types/modules';

function getItem(moduleId: string, itemId: string): ChecklistItem {
  // First check ARPG_CHECKLISTS (where arpg-* modules live).
  const arpgList = (ARPG_CHECKLISTS as Record<string, ChecklistItem[]>)[moduleId];
  if (arpgList) {
    const item = arpgList.find((x) => x.id === itemId);
    if (item) return item;
  }
  // Fall back to SUB_MODULES (where input-handling and other modules live).
  const subModule = (SUB_MODULES as SubModuleDefinition[]).find((m) => m.id === moduleId);
  if (!subModule) throw new Error(`No module ${moduleId}`);
  const checklist = subModule.checklist;
  if (!checklist) throw new Error(`No checklist for module ${moduleId}`);
  const item = checklist.find((x) => x.id === itemId);
  if (!item) throw new Error(`No checklist item ${itemId} in ${moduleId}`);
  return item;
}

describe('slice-mode prompt edits', () => {
  it('al-5 includes the inventory cheat-path (Lifetime auto-destroy)', () => {
    const item = getItem('arpg-loot', 'al-5');
    expect(item.prompt).toMatch(/Lifetime/);
    expect(item.prompt).toMatch(/SLICE/i);
  });

  it('al-6 documents overlap-destroy "+gold" variant', () => {
    const item = getItem('arpg-loot', 'al-6');
    expect(item.prompt).toMatch(/\+gold/i);
    expect(item.prompt).toMatch(/overlap/i);
  });

  it('au-5 is annotated SLICE: skip', () => {
    const item = getItem('arpg-ui', 'au-5');
    expect(item.prompt).toMatch(/SLICE:\s*skip/i);
  });

  it('au-6 is annotated SLICE: skip', () => {
    const item = getItem('arpg-ui', 'au-6');
    expect(item.prompt).toMatch(/SLICE:\s*skip/i);
  });

  it('ih-1 is narrowed to IA_Move + IA_Attack as the primary path', () => {
    const item = getItem('input-handling', 'ih-1');
    expect(item.prompt).toMatch(/IA_Move/);
    expect(item.prompt).toMatch(/IA_Attack/);
    expect(item.prompt).toMatch(/LATER:/i);
  });

  it('ih-2 IMC_Default focuses on slice actions', () => {
    const item = getItem('input-handling', 'ih-2');
    expect(item.prompt).toMatch(/IMC_Default/);
    expect(item.prompt).toMatch(/LATER:/i);
  });
});

describe('arpg-enemy-ai checklist metadata', () => {
  it('ae-1 has no dependsOn (it is the foundation)', () => {
    const item = getItem('arpg-enemy-ai', 'ae-1');
    expect(item.dependsOn ?? []).toEqual([]);
  });

  it('ae-2 through ae-8 declare dependsOn: ["ae-1"] and a non-empty features array', () => {
    for (const id of ['ae-2', 'ae-3', 'ae-4', 'ae-5', 'ae-6', 'ae-7', 'ae-8']) {
      const item = getItem('arpg-enemy-ai', id);
      expect(item.dependsOn).toContain('ae-1');
      expect(Array.isArray(item.features)).toBe(true);
      expect((item.features ?? []).length).toBeGreaterThan(0);
    }
  });
});

describe('arpg-combat evaluator prompts', () => {
  it('quality pass mentions HitActors TSet on the ability instance (GAP-002)', () => {
    const combat = (MODULE_CONTEXTS as Record<string, { qualityChecks?: string }>)['arpg-combat'];
    expect(combat?.qualityChecks ?? '').toMatch(/HitActors/);
    expect(combat?.qualityChecks ?? '').toMatch(/ability instance/i);
  });

  it('structure pass mentions State.Dead tag + GE_Death (GAP-003)', () => {
    const combat = (MODULE_CONTEXTS as Record<string, { structureChecks?: string }>)['arpg-combat'];
    expect(combat?.structureChecks ?? '').toMatch(/State\.Dead/);
    expect(combat?.structureChecks ?? '').toMatch(/GE_Death/);
  });
});
