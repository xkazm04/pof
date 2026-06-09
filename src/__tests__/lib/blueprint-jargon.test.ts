import { describe, it, expect } from 'vitest';
import {
  CHANGE_TYPE_META,
  CHANGE_TYPE_LABELS,
  type ChangeTypeMeta,
} from '@/lib/blueprint-jargon';
import { lookupTerm } from '@/lib/blueprint-glossary';
import type { DiffChangeType } from '@/types/blueprint';

// The five-value taxonomy used to live in three independent definitions
// (CHANGE_TYPE_LABELS, CHANGE_CODES, and an inline typeLabel map in the view).
// These tests lock the consolidation: one authoritative CHANGE_TYPE_META table
// that the others derive from, so the mapping can't silently drift.

const ALL_TYPES: DiffChangeType[] = ['add', 'remove', 'modify', 'move', 'rename'];

describe('CHANGE_TYPE_META', () => {
  it('has an exhaustive entry for every DiffChangeType', () => {
    expect(Object.keys(CHANGE_TYPE_META).sort()).toEqual([...ALL_TYPES].sort());
  });

  it('gives every entry a code, label, plain text, and color', () => {
    for (const type of ALL_TYPES) {
      const meta: ChangeTypeMeta = CHANGE_TYPE_META[type];
      expect(meta.code, `${type}.code`).toMatch(/^[A-Z]{3}$/);
      expect(meta.label, `${type}.label`).toBeTruthy();
      expect(meta.plain, `${type}.plain`).toBeTruthy();
      expect(meta.color, `${type}.color`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('uses a unique three-letter code per type', () => {
    const codes = ALL_TYPES.map((t) => CHANGE_TYPE_META[t].code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('CHANGE_TYPE_LABELS (derived from CHANGE_TYPE_META)', () => {
  it('mirrors the meta keys and labels', () => {
    expect(Object.keys(CHANGE_TYPE_LABELS).sort()).toEqual([...ALL_TYPES].sort());
    for (const type of ALL_TYPES) {
      expect(CHANGE_TYPE_LABELS[type].term).toBe(CHANGE_TYPE_META[type].label);
      expect(CHANGE_TYPE_LABELS[type].plain).toBe(CHANGE_TYPE_META[type].plain);
    }
  });
});

describe('diff change codes (derived from CHANGE_TYPE_META)', () => {
  it('resolves each meta code through the glossary and decodes its label', () => {
    for (const type of ALL_TYPES) {
      const meta = CHANGE_TYPE_META[type];
      const entry = lookupTerm(meta.code);
      expect(entry, `code "${meta.code}" should be known`).toBeDefined();
      expect(entry!.term).toBe(meta.code);
      // The code hover text leads with the plain-English label so a bare "MOD"
      // chip decodes to "Modified — …".
      expect(entry!.plain).toContain(meta.label);
      expect(entry!.plain).toContain(meta.plain);
    }
  });
});
