import { describe, it, expect } from 'vitest';
import {
  encodeBuildCode,
  decodeBuildCode,
  peekBuildCodeKind,
  looksLikeBuildCode,
} from '@/lib/genome/build-code';

const sampleCharacter = {
  id: 'abc123',
  name: 'Berserker',
  description: 'Reckless melee bruiser',
  author: 'Tester',
  version: '1.0.0',
  color: 'accent-red',
  movement: { maxWalkSpeed: 420, maxSprintSpeed: 800 },
  combat: { baseDamage: 40, critChance: 0.12 },
  tags: ['melee', 'berserk'],
};

describe('genome build-code', () => {
  it('round-trips a character genome', async () => {
    const code = await encodeBuildCode('character', sampleCharacter);
    expect(code.startsWith('pofc1.')).toBe(true);

    const decoded = await decodeBuildCode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.data.kind).toBe('character');
      expect(decoded.data.data).toEqual(sampleCharacter);
    }
  });

  it('round-trips an item genome with a different tag', async () => {
    const item = { id: 'i1', name: 'Warrior Blade', traits: [{ axis: 'offensive', weight: 0.8 }] };
    const code = await encodeBuildCode('item', item);
    expect(code.startsWith('pofi1.')).toBe(true);

    const decoded = await decodeBuildCode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.data.kind).toBe('item');
      expect(decoded.data.data).toEqual(item);
    }
  });

  it('produces a url-safe payload (no +, /, or = characters)', async () => {
    // Encode a large, varied object to increase odds of +/ in std base64.
    const big = { name: 'x', blob: Array.from({ length: 200 }, (_, i) => i * 31).join(',') };
    const code = await encodeBuildCode('character', big);
    const payload = code.slice(code.indexOf('.') + 1);
    expect(payload).not.toMatch(/[+/=]/);
  });

  it('tolerates surrounding whitespace on decode', async () => {
    const code = await encodeBuildCode('character', sampleCharacter);
    const decoded = await decodeBuildCode(`\n  ${code}  \n`);
    expect(decoded.ok).toBe(true);
  });

  it('rejects an unknown tag', async () => {
    const decoded = await decodeBuildCode('nope1.AAAA');
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toMatch(/unknown build code type/i);
  });

  it('rejects a string with no tag prefix', async () => {
    const decoded = await decodeBuildCode('just-some-random-text');
    expect(decoded.ok).toBe(false);
  });

  it('rejects corrupt payloads instead of throwing', async () => {
    const decoded = await decodeBuildCode('pofc1.@@@not-base64@@@');
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toMatch(/corrupt|incompletely/i);
  });

  it('rejects an empty code', async () => {
    const decoded = await decodeBuildCode('   ');
    expect(decoded.ok).toBe(false);
  });

  it('peekBuildCodeKind detects kind without decoding', () => {
    expect(peekBuildCodeKind('pofc1.whatever')).toBe('character');
    expect(peekBuildCodeKind('pofi1.whatever')).toBe('item');
    expect(peekBuildCodeKind('garbage')).toBeNull();
  });

  it('looksLikeBuildCode distinguishes codes from raw JSON', async () => {
    const code = await encodeBuildCode('character', sampleCharacter);
    expect(looksLikeBuildCode(code)).toBe(true);
    expect(looksLikeBuildCode(JSON.stringify(sampleCharacter))).toBe(false);
  });
});
