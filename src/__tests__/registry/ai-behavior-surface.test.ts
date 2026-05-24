import { describe, it, expect } from 'vitest';
import { SUB_MODULE_MAP } from '@/lib/module-registry';

describe('ai-behavior module surfaces the BT wall + a pure-C++ controller', () => {
  const mod = SUB_MODULE_MAP['ai-behavior'];

  it('exists', () => {
    expect(mod).toBeDefined();
  });

  it('has a knowledge tip acknowledging the BT-graph wall', () => {
    const tips = (mod!.knowledgeTips ?? [])
      .map((t) => `${t.title} ${t.content}`)
      .join(' ');
    expect(tips).toContain('cannot be authored from Python');
  });

  it('has a pure-C++ AI controller checklist item that needs no Behaviour Tree', () => {
    const items = mod!.checklist ?? [];
    const hit = items.find((i) =>
      /pure-?c\+\+/i.test(i.label) ||
      /no behaviour tree|without a behaviour tree/i.test(`${i.label} ${i.prompt}`),
    );
    expect(hit, 'a pure-C++ AI controller checklist item').toBeTruthy();
    expect(hit!.prompt).toContain('AAIController');
  });
});
