import { describe, it, expect } from 'vitest';
import { namesExcludedScenery } from '@/lib/visual-gen/generators/scene-decompose';

describe('namesExcludedScenery reads words, not spellings that merely begin alike', () => {
  for (const name of ['leather wallet', 'archery target', 'watering can', 'bushel basket', 'vinegar bottle', 'stepladder', 'archive box', 'waterskin']) {
    it(`keeps "${name}" as a prop`, () => expect(namesExcludedScenery(name)).toBe(false));
  }
  for (const name of ['stone stairs', 'staircase', 'arches', 'archway', 'bushes', 'vines', 'stone wall', 'trees', 'steps', 'water']) {
    it(`still excludes "${name}"`, () => expect(namesExcludedScenery(name)).toBe(true));
  }
});
