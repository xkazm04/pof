import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';

describe('PromptBuilder.withAssetSpec', () => {
  const built = new PromptBuilder()
    .withRawProjectContext('## Project Context\nPoF')
    .withAssetSpec({
      id: 'ga-fireball', name: 'Fireball',
      categoryPath: ['Offensive', 'Fire'], tags: ['basic'],
      data: { tag: 'Ability.Fire.Fireball', damage: 35 },
    })
    .withRawTask('## Task\nGenerate it')
    .build();

  it('includes an Asset Specification section with the entity fields', () => {
    expect(built).toContain('## Asset Specification');
    expect(built).toContain('Fireball');
    expect(built).toContain('Offensive ▸ Fire');
  });
  it('serializes the typed data payload as JSON', () => {
    expect(built).toContain('"tag": "Ability.Fire.Fireball"');
    expect(built).toContain('"damage": 35');
  });
  it('renders the spec after the task', () => {
    expect(built.indexOf('## Task')).toBeLessThan(built.indexOf('## Asset Specification'));
  });
});
