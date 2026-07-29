import { describe, it, expect } from 'vitest';
import { classifyForgeError, isValidForgedAbility, missingForgedAbilityFields } from '@/lib/forge-errors';

describe('classifyForgeError', () => {
  it('classifies the API-key-missing 503 message', () => {
    const c = classifyForgeError(new Error('Gemini API key not configured. Set GEMINI_API_KEY in .env.local.'));
    expect(c.kind).toBe('api-key-missing');
    expect(c.iconName).toBe('KeyRound');
    expect(c.actions).toContain('configure');
    expect(c.title).toMatch(/AI key/i);
  });

  it('classifies HTTP 429 / rate limit messages', () => {
    expect(classifyForgeError(new Error('429 Too Many Requests')).kind).toBe('rate-limit');
    expect(classifyForgeError(new Error('quota exceeded')).kind).toBe('rate-limit');
    expect(classifyForgeError(new Error('rate limit hit')).kind).toBe('rate-limit');
  });

  it('classifies timeouts', () => {
    expect(classifyForgeError(new Error('Request timed out')).kind).toBe('timeout');
    expect(classifyForgeError(new Error('ETIMEDOUT 127.0.0.1:443')).kind).toBe('timeout');
  });

  it('classifies network failures (TypeError + fetch text)', () => {
    expect(classifyForgeError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(classifyForgeError(new Error('NetworkError when attempting to fetch resource')).kind).toBe('network');
    expect(classifyForgeError(new Error('ECONNREFUSED')).kind).toBe('network');
  });

  it('classifies JSON parse failures', () => {
    expect(classifyForgeError(new Error('Failed to parse Gemini response as JSON')).kind).toBe('json-parse');
    expect(classifyForgeError(new Error('Unexpected token < in JSON at position 0')).kind).toBe('json-parse');
  });

  it('classifies schema mismatches (incomplete ability)', () => {
    const c = classifyForgeError(new Error('Incomplete ability generated — missing className, headerCode, or cppCode'));
    expect(c.kind).toBe('schema-mismatch');
    expect(c.actions).toEqual(expect.arrayContaining(['retry', 'edit-description']));
  });

  it('classifies bad-request validation errors', () => {
    expect(classifyForgeError(new Error('Missing "prompt" field')).kind).toBe('validation');
    expect(classifyForgeError(new Error('Invalid JSON body')).kind).toBe('validation');
  });

  it('classifies upstream 5xx + empty responses as server-error', () => {
    expect(classifyForgeError(new Error('Empty response from Gemini')).kind).toBe('server-error');
    expect(classifyForgeError(new Error('502 Bad Gateway')).kind).toBe('server-error');
    expect(classifyForgeError(new Error('Gemini API call failed')).kind).toBe('server-error');
  });

  it('falls back to "unknown" with the raw message preserved', () => {
    const c = classifyForgeError(new Error('something weird happened'));
    expect(c.kind).toBe('unknown');
    expect(c.rawMessage).toBe('something weird happened');
    expect(c.actions).toContain('retry');
  });

  it('preserves raw message even for non-Error inputs', () => {
    expect(classifyForgeError('boom').rawMessage).toBe('boom');
    expect(classifyForgeError({ code: 42 }).rawMessage).toContain('42');
  });

  it('classifies a dead/unknown model as config, not json-parse', () => {
    const c = classifyForgeError(new Error('[404 Not Found] models/gemini-2.0-flash is not found for API version v1beta'));
    expect(c.kind).toBe('config');
    expect(c.actions).toEqual(['configure']);
    expect(classifyForgeError(new Error('model was decommissioned')).kind).toBe('config');
  });

  it('classifies a cut-off generation as truncated, not gibberish', () => {
    const c = classifyForgeError(new Error('Generation was truncated — the model hit the 32768-token output limit'));
    expect(c.kind).toBe('truncated');
    expect(c.actions).toContain('retry');
    expect(classifyForgeError(new Error('finishReason MAX_TOKENS')).kind).toBe('truncated');
  });
});

describe('isValidForgedAbility / missingForgedAbilityFields', () => {
  const valid = {
    className: 'GA_X', displayName: 'X', description: 'd',
    headerCode: 'h', cppCode: 'c',
    tags: { abilityTag: 'Ability_X', cooldownTag: 'Cooldown_X', ownedTags: [], blockedTags: [] },
    stats: { baseDamage: 1, manaCost: 2, cooldownSec: 3, damageType: 'Fire' },
    comboEntry: { animDuration: 1, damageWindow: [0.1, 0.2], recovery: 0.1, comboMultiplier: 1 },
    radarValues: [0, 0, 0, 0, 0],
  };

  it('accepts a complete ability', () => {
    expect(isValidForgedAbility(valid)).toBe(true);
    expect(missingForgedAbilityFields(valid)).toEqual([]);
  });

  it('rejects and names every missing/malformed field', () => {
    const bad = { ...valid, cppCode: '', stats: { baseDamage: 1 }, radarValues: [1, 2] };
    expect(isValidForgedAbility(bad)).toBe(false);
    const missing = missingForgedAbilityFields(bad);
    expect(missing).toContain('cppCode');
    expect(missing).toContain('stats.manaCost');
    expect(missing).toContain('stats.damageType');
    expect(missing).toContain('radarValues');
  });

  it('rejects non-objects without throwing', () => {
    expect(isValidForgedAbility(null)).toBe(false);
    expect(isValidForgedAbility('nope')).toBe(false);
    expect(missingForgedAbilityFields(undefined)).toHaveLength(1);
  });
});
