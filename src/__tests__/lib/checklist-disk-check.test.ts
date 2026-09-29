/**
 * "Check against disk" — the pure half. Which items a module can verify on demand is
 * owner-scoped (ai-behavior never borrows arpg-inventory's ai-1), and the reconcile plan
 * diffs each verdict against the tick: built (proposes tick), confirmed (nothing),
 * partial (proposes finishing the named members), regressed (proposes untick).
 */
import { describe, it, expect } from 'vitest';
import {
  buildFinishPrompt,
  diskVerifiableItems,
  finishTargetFor,
  planDiskReconcile,
  type DiskResult,
} from '@/lib/checklist-disk-check';
import { getModuleChecklist } from '@/lib/module-registry';

const r = (itemId: string, status: DiskResult['status'], missingMembers: string[] = [], moduleId = 'arpg-character'): DiskResult => ({
  moduleId,
  itemId,
  status,
  completeness: status === 'full' ? 1 : status === 'partial' ? 0.6 : 0,
  missingMembers,
});

describe('diskVerifiableItems — owner-scoped', () => {
  it('lists only the items this module owns an expectation for', () => {
    expect(diskVerifiableItems('arpg-inventory', getModuleChecklist('arpg-inventory'))).toEqual(['ai-1', 'ai-3']);
    expect(diskVerifiableItems('ai-behavior', getModuleChecklist('ai-behavior'))).toEqual([]);
    expect(diskVerifiableItems('arpg-character', getModuleChecklist('arpg-character'))).toEqual(['ac-1', 'ac-2', 'ac-3', 'ac-4']);
  });
});

describe('planDiskReconcile — verdict x tick', () => {
  it('built / confirmed / partial / regressed rows with one proposed action each', () => {
    const plan = planDiskReconcile(
      [r('ac-1', 'full'), r('ac-2', 'full'), r('ac-3', 'partial', ['MaxWalkSpeed']), r('ac-4', 'missing', ['DefaultPawnClass'])],
      { 'ac-2': true, 'ac-4': true },
    );
    const byId = Object.fromEntries(plan.rows.map((row) => [row.itemId, row]));
    expect(byId['ac-1']).toMatchObject({ kind: 'built', checked: false, action: 'tick' });
    expect(byId['ac-2']).toMatchObject({ kind: 'confirmed', checked: true, action: null });
    expect(byId['ac-3']).toMatchObject({ kind: 'partial', checked: false, action: 'finish', missingMembers: ['MaxWalkSpeed'] });
    expect(byId['ac-3'].finish).toEqual({ className: 'AARPGCharacterBase', missingMembers: ['MaxWalkSpeed'] });
    expect(byId['ac-4']).toMatchObject({ kind: 'regressed', checked: true, action: 'untick' });
    expect(plan.built).toEqual(['ac-1']);
    expect(plan.unverifiable).toBe(0);
  });

  it('[guard] never proposes an action for an item with no expectations: counted, no row', () => {
    const plan = planDiskReconcile(
      [
        r('ac-1', 'full'),
        r('ac-5', 'no-expectations'),
        // an id another module owns, even if a verdict came back for it
        r('ai-1', 'full', [], 'ai-behavior'),
        // a result that names no owner cannot be owner-checked
        { itemId: 'ac-2', status: 'full', completeness: 1, missingMembers: [] },
      ],
      { 'ac-5': true },
    );
    expect(plan.rows.map((row) => row.itemId)).toEqual(['ac-1']);
    expect(plan.unverifiable).toBe(3);
    expect(plan.built).toEqual(['ac-1']);
  });
});

describe('buildFinishPrompt — add the missing members only', () => {
  it('names the class and every member, is add-only, and is not a review prompt', () => {
    const item = getModuleChecklist('arpg-character').find((i) => i.id === 'ac-3')!;
    const prompt = buildFinishPrompt(item, {
      className: 'AARPGCharacterBase',
      missingMembers: ['MaxWalkSpeed', 'USpringArmComponent'],
    });
    expect(prompt).toContain('AARPGCharacterBase');
    expect(prompt).toContain('MaxWalkSpeed');
    expect(prompt).toContain('USpringArmComponent');
    expect(prompt).toContain('Do NOT use TodoWrite');
    expect(prompt).toMatch(/add only the missing members/i);
    expect(prompt).not.toContain('Verify my implementation');
  });
});

describe('finishTargetFor — one class per Finish run', () => {
  it('sends each missing member to the expected class that lists it, never the wrong class', () => {
    // ac-1: InputMappingContext is expected on the secondary AARPGPlayerController
    expect(finishTargetFor('arpg-character', 'ac-1', ['InputMappingContext', 'MaxWalkSpeed'])).toEqual({
      className: 'AARPGPlayerController',
      missingMembers: ['InputMappingContext'],
    });
    expect(finishTargetFor('arpg-character', 'ac-1', ['MaxWalkSpeed', 'InputMappingContext', 'USpringArmComponent'])).toEqual({
      className: 'AARPGCharacterBase',
      missingMembers: ['MaxWalkSpeed', 'USpringArmComponent'],
    });
  });
});
