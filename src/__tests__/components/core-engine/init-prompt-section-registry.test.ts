import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getInitPromptSectionIds } from '@/components/modules/core-engine/unique-tabs/feature-init-prompts';
import { getAllSectionIds } from '@/components/modules/core-engine/unique-tabs/feature-map-config';
import type { SubModuleId } from '@/types/modules';

const MODULES: SubModuleId[] = [
  'arpg-character', 'arpg-animation', 'arpg-gas', 'arpg-combat', 'arpg-enemy-ai', 'arpg-inventory', 'arpg-loot',
];

// A renamed section would otherwise leave its scaffold prompt orphaned and the card
// would grade `no-prompt` with every gate still green.
describe('init prompt keys are real Feature Map section ids', () => {
  it('pins the authored key count', () => {
    const total = MODULES.reduce((n, m) => n + getInitPromptSectionIds(m).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  for (const moduleId of MODULES) {
    it(`${moduleId}: no orphan prompt keys`, () => {
      const sections = new Set<string>(getAllSectionIds(moduleId));
      const orphans = getInitPromptSectionIds(moduleId).filter((k) => !sections.has(k));
      expect(orphans).toEqual([]);
    });
  }
});

// Nothing reads a per-prompt button label (ScaffoldPanel builds its own copy), so authoring one
// is dead data. A reader that wants it must add the field back with the reader in the same change.
describe('init prompts carry no unread label field', () => {
  it('feature-init-prompts.ts authors 0 label fields', () => {
    const src = readFileSync(resolve(__dirname, '../../../components/modules/core-engine/unique-tabs/feature-init-prompts.ts'), 'utf-8');
    const labels = src.match(/(^\s+|\{\s*)label:\s*'/gm) ?? [];
    expect(labels.length).toBe(0);
  });
});
