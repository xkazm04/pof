import { describe, it, expect } from 'vitest';
import {
  CHANGE_TYPE_META,
  CHANGE_TYPE_LABELS,
  UPROPERTY_SPECIFIERS,
  CORE_MACROS,
  K2NODE_LABELS,
  CONFLICT_LEVEL_LABELS,
  findJargonInText,
  type ChangeTypeMeta,
  type JargonEntry,
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

describe('findJargonInText (regex sweep matches the old includes loop)', () => {
  // Oracle = the original O(terms × textLen) implementation: iterate every key
  // in the same merged dictionary and keep it if text.includes(key). The new
  // regex-based findJargonInText must return a bit-for-bit identical array.
  const ALL_JARGON: Record<string, JargonEntry> = {
    ...UPROPERTY_SPECIFIERS,
    ...CORE_MACROS,
    ...K2NODE_LABELS,
    ...CONFLICT_LEVEL_LABELS,
    ...CHANGE_TYPE_LABELS,
  };
  const oracle = (text: string): JargonEntry[] => {
    const hits: JargonEntry[] = [];
    const seen = new Set<string>();
    for (const term of Object.keys(ALL_JARGON)) {
      if (text.includes(term) && !seen.has(term)) {
        hits.push(ALL_JARGON[term]);
        seen.add(term);
      }
    }
    return hits;
  };

  const cases: string[] = [
    '',
    'no jargon here at all',
    'UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Stats")',
    'UFUNCTION(BlueprintCallable, Server, Reliable)',
    // substring traps: ReplicatedUsing ⊃ Replicated, remove ⊃ move
    'ReplicatedUsing=OnRep_Health',
    'Replicated only',
    'the diff shows a remove and a move',
    'rename then modify then add',
    // regex-special key: ".generated.h" stored under the `generated_h` key
    '#include "MyActor.generated.h" // last include',
    'K2Node_CommutativeAssociativeBinaryOperator feeds K2Node_Self',
    'DOREPLIFETIME(AMyActor, Health); GENERATED_BODY()',
    'none compatible conflict',
    // every key concatenated, plus regex metachars in the surrounding text
    Object.keys(ALL_JARGON).join(' .*+?^${}()|[]\\ '),
    'EditAnywhereEditDefaultsOnly mashed Replicated|remove',
  ];

  it('returns identical entries (and order) for representative inputs', () => {
    for (const text of cases) {
      expect(findJargonInText(text), JSON.stringify(text)).toEqual(oracle(text));
    }
  });

  it('matches the oracle across randomized key concatenations', () => {
    const keys = Object.keys(ALL_JARGON);
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 500; i++) {
      const parts: string[] = [];
      const n = Math.floor(rand() * 6);
      for (let j = 0; j < n; j++) {
        parts.push(keys[Math.floor(rand() * keys.length)]);
        if (rand() < 0.5) parts.push(' x '); // sometimes separate, sometimes mash
      }
      const text = parts.join('');
      expect(findJargonInText(text), JSON.stringify(text)).toEqual(oracle(text));
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
