import { describe, it, expect } from 'vitest';
import {
  PLATFORM_IDS,
  PLATFORM_LABELS,
  SUPPORTED_PLATFORMS,
  normalizePlatformId,
  platformLabel,
  type PlatformId,
} from '@/lib/packaging/build-profiles';

describe('canonical platform identifiers', () => {
  it('exposes one canonical id per supported platform', () => {
    expect(PLATFORM_IDS).toEqual(['Win64', 'Linux', 'Mac', 'Android', 'IOS']);
    for (const id of PLATFORM_IDS) {
      expect(typeof PLATFORM_LABELS[id]).toBe('string');
    }
  });

  it('keeps SUPPORTED_PLATFORMS in lockstep with the label map (single source)', () => {
    expect(SUPPORTED_PLATFORMS.map((p) => p.id)).toEqual(PLATFORM_IDS);
    for (const p of SUPPORTED_PLATFORMS) {
      expect(p.label).toBe(PLATFORM_LABELS[p.id]);
    }
  });
});

describe('normalizePlatformId', () => {
  it('collapses friendly names to the canonical UE token', () => {
    expect(normalizePlatformId('Windows')).toBe('Win64');
    expect(normalizePlatformId('iOS')).toBe('IOS');
    expect(normalizePlatformId('macOS')).toBe('Mac');
    expect(normalizePlatformId('Mac')).toBe('Mac');
  });

  it('is idempotent on canonical tokens', () => {
    for (const id of PLATFORM_IDS) {
      expect(normalizePlatformId(id)).toBe(id);
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(normalizePlatformId('  win64 ')).toBe('Win64');
    expect(normalizePlatformId('WINDOWS')).toBe('Win64');
    expect(normalizePlatformId('ios')).toBe('IOS');
  });

  it('passes unknown / custom platforms through unchanged', () => {
    expect(normalizePlatformId('Switch')).toBe('Switch');
    expect(normalizePlatformId('')).toBe('');
  });
});

describe('platformLabel', () => {
  it('maps any spelling (token or friendly) to a single display label', () => {
    expect(platformLabel('Win64')).toBe('Windows');
    expect(platformLabel('Windows')).toBe('Windows');
    expect(platformLabel('IOS')).toBe('iOS');
    expect(platformLabel('iOS')).toBe('iOS');
  });

  it('echoes unknown platforms so nothing is dropped from the UI', () => {
    expect(platformLabel('Switch')).toBe('Switch');
  });

  it('agrees with the label map for every canonical id', () => {
    for (const id of PLATFORM_IDS as PlatformId[]) {
      expect(platformLabel(id)).toBe(PLATFORM_LABELS[id]);
    }
  });
});
