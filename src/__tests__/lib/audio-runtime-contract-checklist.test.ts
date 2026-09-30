import { describe, it, expect } from 'vitest';
import { getModuleChecklist } from '@/lib/module-registry';
import { AUDIO_RUNTIME } from '@/lib/audio-runtime-contract';

/**
 * The audio checklist prompts write into the same `Source/<Module>/Audio/` folder
 * as the codegen and the scene/event prompts, so they must name the runtime
 * contract's ONE audio subsystem, never a second pool-owning subsystem.
 */
describe('audio checklist prompts follow the one UE audio runtime contract', () => {
  const items = getModuleChecklist('audio');

  it("aud-1 names the contract's manager and event router, never UAudioManagerSubsystem", () => {
    const aud1 = items.find((i) => i.id === 'aud-1');
    expect(aud1).toBeDefined();
    expect(aud1!.prompt).toContain(AUDIO_RUNTIME.manager.className);
    expect(aud1!.prompt).toContain(AUDIO_RUNTIME.eventRouter.className);
    expect(aud1!.prompt).not.toContain('UAudioManagerSubsystem');
  });

  it('no audio checklist prompt asks for a second audio subsystem (the pool/budget owner is the manager)', () => {
    for (const item of items) {
      const audioSubsystems = item.prompt.match(/\bU\w*Audio\w*Subsystem\b/g) ?? [];
      expect(audioSubsystems, item.id).toEqual([]);
    }
  });
});
