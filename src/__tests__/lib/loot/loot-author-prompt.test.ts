import { describe, it, expect } from 'vitest';
import { buildLootPrompt } from '@/lib/loot/loot-author-prompt';

describe('buildLootPrompt', () => {
  it('names the table, the owning archetype, and the trimmed instruction', () => {
    const p = buildLootPrompt('LT_Brute', 'Stone Brute', '  more crafting mats, fewer potions  ');
    expect(p).toContain('LT_Brute');
    expect(p).toContain('Stone Brute');
    expect(p).toContain('more crafting mats, fewer potions');
    expect(p).not.toContain('  more crafting'); // trimmed
  });

  it('instructs reuse of UARPGLootTable / FLootEntry rather than inventing a system', () => {
    const p = buildLootPrompt('LT_Boss', 'Boss', 'legendary-heavy');
    expect(p).toContain('UARPGLootTable');
    expect(p).toContain('FLootEntry');
  });

  it('works with an empty instruction', () => {
    const p = buildLootPrompt('LT_X', 'X', '');
    expect(p.length).toBeGreaterThan(0);
    expect(p).toContain('LT_X');
  });
});
