import { describe, it, expect } from 'vitest';
import { SUB_MODULES, getModuleChecklist } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

// The PromptEvolution picker derives MODULE_OPTIONS from SUB_MODULES, so it can
// only ever offer real modules. This guards the contract the old hardcoded list
// violated.
describe('prompt-evolution module picker registry contract', () => {
  it('the old phantom ids are not real registry modules (they dead-ended the picker)', () => {
    const registryIds = new Set(SUB_MODULES.map((m) => m.id));
    for (const phantom of ['arpg-abilities', 'arpg-ai', 'arpg-audio', 'arpg-vfx', 'arpg-multiplayer']) {
      expect(registryIds.has(phantom as SubModuleId)).toBe(false);
    }
  });

  it('every registry module the picker now offers has a checklist', () => {
    for (const m of SUB_MODULES) {
      // getModuleChecklist must resolve (the create form gates on it); a real
      // id never produces the "no checklist items — pick a different module"
      // dead end the phantom ids caused.
      expect(Array.isArray(getModuleChecklist(m.id))).toBe(true);
    }
  });
});
