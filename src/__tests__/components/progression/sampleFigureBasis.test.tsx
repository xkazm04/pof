import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RestXpSystem } from '@/components/modules/core-engine/sub_progression/rewards/RestXpSystem';
import { AchievementBoard } from '@/components/modules/core-engine/sub_progression/rewards/AchievementBoard';
import { PrestigePreview } from '@/components/modules/core-engine/sub_progression/_internals/PrestigePreview';

afterEach(cleanup);

describe('sample-figure panels state their basis', () => {
  const panels: [string, () => React.ReactElement, string][] = [
    ['RestXpSystem', () => <RestXpSystem />, 'basis-rest-xp'],
    ['AchievementBoard', () => <AchievementBoard />, 'basis-achievements'],
    ['PrestigePreview', () => <PrestigePreview />, 'basis-prestige'],
  ];
  for (const [name, make, id] of panels) {
    it(`${name} carries an illustrative basis line`, () => {
      const { container } = render(make());
      const el = container.querySelector(`[data-testid="${id}"]`);
      expect(el).toBeTruthy();
      expect(/illustrative/i.test(el?.textContent ?? '')).toBe(true);
    });
  }
});
