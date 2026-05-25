import { describe, it, expect } from 'vitest';
import {
  lookupTerm,
  termTooltip,
  isRawEngineToken,
} from '@/lib/blueprint-glossary';

describe('blueprint-glossary', () => {
  describe('lookupTerm', () => {
    it('resolves transpiler-specific CPF_ property flags', () => {
      const entry = lookupTerm('CPF_Edit');
      expect(entry).toBeDefined();
      expect(entry?.plain).toMatch(/details panel/i);
    });

    it('resolves EGPD_ pin directions', () => {
      expect(lookupTerm('EGPD_Output')?.plain).toMatch(/output pin/i);
      expect(lookupTerm('EGPD_Input')?.plain).toMatch(/input pin/i);
    });

    it('resolves the three-letter diff change codes', () => {
      for (const code of ['ADD', 'DEL', 'MOD', 'MOV', 'REN']) {
        expect(lookupTerm(code), `expected "${code}" to be known`).toBeDefined();
      }
    });

    it('resolves diff scope tokens', () => {
      for (const scope of ['variable', 'function', 'event', 'logic', 'binding']) {
        expect(lookupTerm(scope), `expected scope "${scope}" to be known`).toBeDefined();
      }
    });

    it('falls back to the base UE5 jargon dictionary', () => {
      // These live in blueprint-jargon.ts, not in the glossary's own tokens.
      expect(lookupTerm('K2Node_CallFunction')?.plain).toMatch(/function call/i);
      expect(lookupTerm('UPROPERTY')).toBeDefined();
      expect(lookupTerm('UFUNCTION')).toBeDefined();
    });

    it('returns undefined for unknown terms (fail-soft)', () => {
      expect(lookupTerm('TotallyMadeUpToken')).toBeUndefined();
    });

    it('matches case-sensitively', () => {
      expect(lookupTerm('cpf_edit')).toBeUndefined();
    });
  });

  describe('termTooltip', () => {
    it('appends the "why it matters" hook when present', () => {
      const entry = lookupTerm('CPF_RepNotify')!;
      expect(entry.whyItMatters).toBeTruthy();
      expect(termTooltip(entry)).toBe(`${entry.plain} — ${entry.whyItMatters}`);
    });

    it('returns just the plain text when there is no hook', () => {
      const entry = lookupTerm('MOD')!;
      expect(entry.whyItMatters).toBeUndefined();
      expect(termTooltip(entry)).toBe(entry.plain);
    });
  });

  describe('isRawEngineToken', () => {
    it('treats underscore identifiers and all-caps macros as raw tokens', () => {
      expect(isRawEngineToken('CPF_Edit')).toBe(true);
      expect(isRawEngineToken('K2Node_Timeline')).toBe(true);
      expect(isRawEngineToken('UPROPERTY')).toBe(true);
      expect(isRawEngineToken('GENERATED_BODY')).toBe(true);
    });

    it('treats everyday words as prose (not raw tokens)', () => {
      expect(isRawEngineToken('function')).toBe(false);
      expect(isRawEngineToken('event')).toBe(false);
      expect(isRawEngineToken('Node')).toBe(false);
      expect(isRawEngineToken('manual')).toBe(false);
    });
  });
});
