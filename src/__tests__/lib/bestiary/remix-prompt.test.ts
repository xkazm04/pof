import { describe, it, expect } from 'vitest';
import { buildRemixPrompt } from '@/lib/bestiary/remix-prompt';

describe('buildRemixPrompt', () => {
  it('names the source entity + the instruction', () => {
    const p = buildRemixPrompt('Brute', 'bestiary', 'make a fire-themed elite variant');
    expect(p).toContain('Brute');
    expect(p).toContain('make a fire-themed elite variant');
  });

  it('instructs reuse of AARPGEnemyCharacter + existing systems', () => {
    const p = buildRemixPrompt('Brute', 'bestiary', 'give it a charge attack');
    expect(p).toContain('AARPGEnemyCharacter');
  });

  it('trims the instruction', () => {
    const p = buildRemixPrompt('Brute', 'bestiary', '   add a shield  ');
    expect(p).toContain('add a shield');
    expect(p).not.toContain('   add a shield  ');
  });
});
