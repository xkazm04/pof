/**
 * The auto-verify trigger index is DERIVED from the expectation table the verifier checks
 * (`CHECKLIST_EXPECTATIONS`), scoped module -> item. It used to be a regex over checklist
 * prose (useFileWatcher.buildVerificationMap), which routed AARPGCharacterBase to
 * arpg-enemy-ai::ae-2, reached no secondary class, and bare-name-ticked items the verifier
 * cannot check (UPROPERTY -> save-load::sl-1).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveAffectedItems,
  unboundExpectationIds,
  verifyIndexEntries,
} from '@/lib/checklist-verify-index';
import { getExpectationsFor, getExpectationsForItem } from '@/lib/checklist-expectations';
import { SUB_MODULE_MAP } from '@/lib/module-registry';

const keys = (items: { moduleId: string; itemId: string }[]) =>
  items.map((i) => `${i.moduleId}::${i.itemId}`);

describe('resolveAffectedItems — triggers come from the expectation table', () => {
  it('AARPGCharacterBase reaches every item that verifies it, and not ae-2', () => {
    const got = keys(resolveAffectedItems([{ name: 'AARPGCharacterBase', kind: 'UCLASS', prefix: 'A' }]));
    expect(new Set(got)).toEqual(new Set([
      'arpg-character::ac-1',
      'arpg-character::ac-2',
      'arpg-character::ac-3',
      'arpg-gas::ag-1',
    ]));
    expect(got).toHaveLength(4);
    expect(got).not.toContain('arpg-enemy-ai::ae-2');
  });

  it('primary and secondary classes trigger their own item', () => {
    expect(keys(resolveAffectedItems([{ name: 'UARPGAnimInstance' }]))).toEqual(['arpg-animation::aa-1']);
    expect(keys(resolveAffectedItems([{ name: 'UAnimNotify_SpawnVFX' }]))).toEqual(['arpg-animation::aa-5']);
  });

  it('expectations are owner-scoped: ai-1 belongs to arpg-inventory, never ai-behavior', () => {
    expect(getExpectationsFor('arpg-inventory', 'ai-1')?.primary.className).toBe('UARPGItemDefinition');
    expect(getExpectationsFor('ai-behavior', 'ai-1')).toBeNull();
    expect(keys(resolveAffectedItems([{ name: 'UARPGItemDefinition' }]))).toEqual(['arpg-inventory::ai-1']);
    // The bare lookup stays for existing readers (save-schema/fields.test.ts).
    expect(getExpectationsForItem('as-1')?.primary.className).toBe('UARPGSaveGame');
  });

  it('names with no expectation bind nothing (no bare-name ticks)', () => {
    for (const name of ['UPROPERTY', 'AUTOMATABLE', 'UAnimInstance', 'AWorldItem', 'AAIController']) {
      expect(resolveAffectedItems([{ name }]), name).toEqual([]);
    }
  });

  it('index integrity: every indexed item exists in its module checklist; unbound ids are reported', () => {
    const entries = verifyIndexEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const { moduleId, itemId } of entries) {
      const checklist = SUB_MODULE_MAP[moduleId]?.checklist ?? [];
      expect(checklist.some((i) => i.id === itemId), `${moduleId}::${itemId}`).toBe(true);
    }
    expect(unboundExpectationIds()).toEqual(['aa-commandlet']);
    expect(entries.some((e) => e.itemId === 'aa-commandlet')).toBe(false);
  });
});
