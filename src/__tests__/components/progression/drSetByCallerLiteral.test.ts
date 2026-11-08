import { describe, it, expect } from 'vitest';
import { generateGESource } from '@/components/modules/core-engine/sub_progression/_internals/DRCodeGenerator/helpers';
import { DR_CONFIGS } from '@/components/modules/core-engine/sub_progression/_shared/diminishingReturns';

/** UE 5.8 FSetByCallerFloat has only a default constructor (GameplayEffect.h:258). */
describe('generateGESource SetByCaller magnitude', () => {
  const cpp = generateGESource(DR_CONFIGS);

  it('never constructs FSetByCallerFloat from a tag', () => {
    expect(cpp).not.toContain('FSetByCallerFloat(ARPGGameplayTags');
  });

  it('assigns DataTag per attribute and passes the struct', () => {
    for (const c of DR_CONFIGS) {
      expect(cpp).toContain(`SetByCaller.DataTag = ARPGGameplayTags::Data_${c.attribute}_Bonus;`);
    }
    expect(cpp).toContain('FGameplayEffectModifierMagnitude(SetByCaller)');
  });
});
