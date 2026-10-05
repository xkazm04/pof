/**
 * "Download .h/.cpp" must produce the two files it names.
 *
 * The button used to build ONE blob containing the header code followed by
 * the cpp code, concatenated, and download it as a single file literally
 * named "<ClassName>.cpp" — losing the header entirely and mislabeling the
 * combined text as cpp source. It also revoked the blob URL synchronously
 * right after `.click()`, the exact race `@/lib/download`'s `downloadBlob`
 * exists to avoid (0-byte downloads in some browsers).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ForgeResult } from '@/components/modules/core-engine/sub_ability/forge/ForgeResult';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

vi.mock('@/lib/download', () => ({ downloadBlob: vi.fn() }));
import { downloadBlob } from '@/lib/download';

afterEach(cleanup);

const ability: ForgedAbility = {
  className: 'GA_Fireball',
  displayName: 'Fireball',
  description: 'A ball of fire.',
  headerCode: '// header content',
  cppCode: '// cpp content',
  tags: { abilityTag: 'Ability.Fireball', cooldownTag: 'Cooldown.Fireball', ownedTags: [], blockedTags: [] },
  stats: { baseDamage: 30, manaCost: 20, cooldownSec: 3, damageType: 'Fire' },
  comboEntry: { animDuration: 1, damageWindow: [0.2, 0.4], recovery: 0.3, comboMultiplier: 1 },
  radarValues: [0.5, 0.5, 0.5, 0.5, 0.5],
};

describe('ForgeResult download', () => {
  it('downloads the header and the cpp as two separately-named files', () => {
    const { getByText } = render(<ForgeResult ability={ability} existingRadar={[]} />);
    fireEvent.click(getByText(/download \.h\/\.cpp/i));

    expect(downloadBlob).toHaveBeenCalledTimes(2);
    const calls = (downloadBlob as unknown as ReturnType<typeof vi.fn>).mock.calls as [Blob, string][];
    const byName = new Map(calls.map(([blob, name]) => [name, blob]));

    expect(byName.has('GA_Fireball.h')).toBe(true);
    expect(byName.has('GA_Fireball.cpp')).toBe(true);
  });
});
