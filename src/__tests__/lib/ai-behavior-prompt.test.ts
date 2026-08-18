import { describe, it, expect } from 'vitest';
import { SUB_MODULES } from '@/lib/module-registry';

/** The group-AI checklist item (ai-5) should carry the full melee reservation
 * pattern (T. Cain / WildStar) — not just an attack-token count. */
describe('ai-5 group AI coordination prompt — melee reservation system', () => {
  // NOTE: checklist ids are only unique per sub-module — arpg-inventory also
  // uses the 'ai-' prefix, so scope the lookup to the ai-behavior module.
  const item = SUB_MODULES.find((m) => m.id === 'ai-behavior')
    ?.checklist?.find((c) => c.id === 'ai-5');

  it('exists', () => {
    expect(item).toBeDefined();
  });

  it('describes sized positional slots with a confirm-or-timeout lifecycle', () => {
    const p = item!.prompt;
    expect(p).toMatch(/reservation/i);
    expect(p).toMatch(/slot/i);
    expect(p).toMatch(/confirm/i);
  });

  it('covers large attackers (adjoining slots) and mass-cancel events', () => {
    const p = item!.prompt;
    expect(p).toMatch(/adjoining/i);
    expect(p).toMatch(/cancel/i);
    expect(p).toMatch(/teleport|jump|dies|death/i);
  });
});
