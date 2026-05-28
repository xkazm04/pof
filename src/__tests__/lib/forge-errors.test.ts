import { describe, it, expect } from 'vitest';
import { classifyForgeError } from '@/lib/forge-errors';

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
});
