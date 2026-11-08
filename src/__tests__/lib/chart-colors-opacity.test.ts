import { describe, it, expect } from 'vitest';
import {
  withOpacity,
  statusBg,
  statusBorder,
  STATUS_ERROR,
  OPACITY_20,
  OPACITY_10,
} from '@/lib/chart-colors';

// The opacity helpers append a hex suffix, which is only a colour when the input
// is `#rrggbb`. Tonight 8+ rounds repaired call sites that fed them `var(--x)`;
// these pin the primitive so a caller cannot produce invalid CSS at all.
describe('opacity helpers accept any CSS colour', () => {
  it('keeps the byte-identical suffix form for #rrggbb', () => {
    expect(withOpacity(STATUS_ERROR, OPACITY_20)).toBe(`${STATUS_ERROR}33`);
    expect(statusBg(STATUS_ERROR)).toBe(`${STATUS_ERROR}14`);
    expect(statusBorder(STATUS_ERROR)).toBe(`${STATUS_ERROR}33`);
  });

  it('turns a var() input into color-mix, never var()33', () => {
    expect(withOpacity('var(--text-muted)', OPACITY_20)).toBe(
      'color-mix(in srgb, var(--text-muted) 20%, transparent)',
    );
    expect(statusBg('var(--text-muted)')).toBe(
      'color-mix(in srgb, var(--text-muted) 7.8%, transparent)',
    );
    expect(statusBorder('var(--text-muted)')).toBe(
      'color-mix(in srgb, var(--text-muted) 20%, transparent)',
    );
  });

  it('rounds the percentage to one decimal', () => {
    expect(withOpacity('var(--x)', OPACITY_10)).toBe('color-mix(in srgb, var(--x) 10.2%, transparent)');
  });

  it('handles the other forms a suffix would corrupt', () => {
    expect(withOpacity('#abc', OPACITY_20)).toBe('#aabbcc33');
    expect(withOpacity('rgb(1, 2, 3)', OPACITY_20)).toBe('color-mix(in srgb, rgb(1, 2, 3) 20%, transparent)');
    expect(withOpacity('#11223344', OPACITY_20)).toBe('color-mix(in srgb, #11223344 20%, transparent)');
    expect(withOpacity('currentColor', OPACITY_20)).toBe('color-mix(in srgb, currentColor 20%, transparent)');
  });

  it('reads a missing colour as transparent rather than a bare suffix', () => {
    expect(withOpacity('', OPACITY_20)).toBe('transparent');
  });
});
