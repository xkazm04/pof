/**
 * Ship-loop Milestone 4 (UX adoption tail): the design system's floors (no hardcoded
 * hex; no sub-12px text) are enforced by ESLint `no-restricted-syntax` so drift is caught
 * at edit-time rather than sweeping hundreds of files after the fact. This guard makes the
 * enforcement itself non-removable — if someone drops a floor rule, this test fails.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const config = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf8');

describe('ESLint design-system floor enforcement', () => {
  it('enforces the no-hardcoded-hex floor (chart-colors / CSS vars)', () => {
    expect(config).toContain('#[0-9a-fA-F]{6,8}');
    expect(config).toMatch(/chart-colors|CSS variable/);
  });

  it('enforces the 12px legibility floor (no text-[<12px] arbitrary sizes)', () => {
    // The selector flags text-[8px] / [9px] / [10px] / [11px] in any className literal.
    expect(config).toContain('text-\\\\[(?:8|9|10|11)px\\\\]');
    expect(config).toMatch(/12px legibility floor/);
    expect(config).toMatch(/MicroLabel|TEXT_SCALE|text-xs/);
  });

  it('both floors live under no-restricted-syntax at warn severity', () => {
    expect(config).toMatch(/"no-restricted-syntax":\s*\[\s*"warn"/);
  });
});
