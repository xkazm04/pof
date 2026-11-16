import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ComparisonPanel } from '@/components/modules/core-engine/sub_character/ai-feel/ComparisonPanel';
import { FEEL_PRESETS, compareProfiles, type FeelProfile } from '@/lib/character-feel-optimizer';

afterEach(() => cleanup());

const A = FEEL_PRESETS[0];
const B = { ...FEEL_PRESETS[1], name: 'Bravo Test' };

function summary(profileB: FeelProfile): string {
  const comparison = compareProfiles(A.profile, profileB);
  const byCat = new Map<string, typeof comparison>();
  for (const c of comparison) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]);
  const { container } = render(
    <ComparisonPanel
      selectedPreset={A} comparePreset={B} comparison={comparison}
      comparisonByCategory={byCat} showComparison onToggle={() => {}}
    />,
  );
  return container.textContent ?? '';
}

function withMovement(patch: Partial<FeelProfile['movement']>): FeelProfile {
  return { ...A.profile, movement: { ...A.profile.movement, ...patch } };
}

/* "Faster"/"Slower" counted every Movement field that rose or fell, so a higher gravityScale
 * or airControl read as "faster", and the direction (B relative to A) was never named. */
describe('ComparisonPanel summary counts only speed fields and names the direction', () => {
  it('a rise in gravityScale alone is not "faster"', () => {
    const text = summary(withMovement({ gravityScale: A.profile.movement.gravityScale + 0.5 }));
    expect(text).toContain('Bravo Test faster on 0');
    expect(text).toContain('slower on 0');
  });

  it('a walk-speed rise counts once, attributed to the compared preset', () => {
    const text = summary(withMovement({ maxWalkSpeed: A.profile.movement.maxWalkSpeed + 50 }));
    expect(text).toContain('Bravo Test faster on 1');
    expect(text).toContain('slower on 0');
  });
});
