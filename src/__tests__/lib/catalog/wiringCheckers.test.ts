import { describe, it, expect } from 'vitest';
import { wiringContractSound, checkWiringContract, MIN_PROSE } from '@/lib/catalog/acceptance/wiringCheckers';

/**
 * The wiring-contract invariant (docs/catalog/WIRING-AND-ACCEPTANCE.md: "an artifact that
 * compiles but isn't granted/activated is NOT config-complete"). 137 contracts were authored
 * fleet-wide and nothing read them until this checker.
 */
const sound = {
  grantedBy: 'UARPGAchievementSubsystem::OnEnemyKilled() — registered on GameState in BeginPlay',
  activatedBy: 'AARPGEnemyCharacter::OnDeath → GameplayEvent delegate fires',
  verification: 'L2: subsystem declared in Source/PoF/; L3: VSAchievementTest kills one enemy in PIE',
  dependencies: ['bestiary (AARPGEnemyCharacter)'],
};

describe('wiringContractSound', () => {
  it('passes a complete contract under a named field', () => {
    const r = wiringContractSound('triggerProgress')({ triggerProgress: { wiringContract: sound } });
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L2');
  });

  it('passes a contract at the artifact root, and reads only that key', () => {
    expect(wiringContractSound()({ wiringContract: sound }).status).toBe('pass');
  });

  it('resolves a nested dot-path container', () => {
    expect(wiringContractSound('layers.bed')({ layers: { bed: { wiringContract: sound } } }).status).toBe('pass');
  });

  it('passes when no contract is declared (scope is "where present")', () => {
    expect(wiringContractSound('x')({}).status).toBe('pass');
    expect(wiringContractSound()({ other: 1 }).status).toBe('pass');
    expect(wiringContractSound('x')({ x: { other: 1 } }).status).toBe('pass');
  });

  it('fails a gray-box: a missing grant/trigger/verification', () => {
    for (const key of ['grantedBy', 'activatedBy', 'verification'] as const) {
      const wc = { ...sound, [key]: undefined };
      const r = wiringContractSound()({ wiringContract: wc });
      expect(r.status).toBe('fail');
      expect(r.reason).toContain(key);
    }
  });

  it('fails a placeholder claim (TBD/TODO/n a) and anything under the prose floor', () => {
    expect(wiringContractSound()({ wiringContract: { ...sound, grantedBy: 'TBD' } }).status).toBe('fail');
    expect(wiringContractSound()({ wiringContract: { ...sound, activatedBy: 'n/a' } }).status).toBe('fail');
    expect(wiringContractSound()({ wiringContract: { ...sound, grantedBy: 'x'.repeat(MIN_PROSE - 1) } }).status).toBe('fail');
  });

  it('fails a verification line that names no ladder tier', () => {
    const r = wiringContractSound()({ wiringContract: { ...sound, verification: 'it works in game, trust me' } });
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('L0–L4');
  });

  it('fails malformed dependencies but accepts an empty list', () => {
    expect(wiringContractSound()({ wiringContract: { ...sound, dependencies: 'bestiary' } }).status).toBe('fail');
    expect(wiringContractSound()({ wiringContract: { ...sound, dependencies: ['', 'x'] } }).status).toBe('fail');
    expect(wiringContractSound()({ wiringContract: { ...sound, dependencies: [] } }).status).toBe('pass');
  });

  it('fails a non-object contract with a precise reason', () => {
    const r = checkWiringContract('granted somewhere', 'Wiring', 'foo.wiringContract');
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('foo.wiringContract');
  });

  it('is context-free and deterministic (same data in, same verdict out)', () => {
    const data = { wiringContract: sound };
    expect(wiringContractSound()(data)).toEqual(wiringContractSound()(data, undefined));
  });
});
