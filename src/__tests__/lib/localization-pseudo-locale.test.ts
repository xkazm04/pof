/**
 * Acceptance for localization-pipeline/B (scan-sweep --challenge run challenge-2026-09-30a):
 * the engine-free pseudo-locale. Length is banded by SOURCE length (short strings grow most),
 * the three knobs are independent, and FText::Format tokens pass through byte-identical so the
 * pseudo text is placeholder-safe by the same checker translation QA uses.
 */
import { describe, it, expect } from 'vitest';
import {
  PSEUDO_LOCALE,
  expansionBand,
  pseudoLocalize,
} from '@/lib/localization/pseudo-locale';
import { validateTranslations } from '@/lib/localization/qa-engine';
import { SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import type { LocalizableString, TranslationEntry } from '@/types/localization-pipeline';

const ALL_ON = { length: true, markers: true, accents: true };

function stripMarkers(s: string): string {
  return s.replace(/^\[/, '').replace(/\]$/, '');
}

describe('expansionBand — banded by source length, never one flat factor', () => {
  it('case 1: 5→2.0, 10→2.0, 11→1.8, 25→1.6, 80→1.3', () => {
    expect(expansionBand(5)).toBe(2.0);
    expect(expansionBand(10)).toBe(2.0);
    expect(expansionBand(11)).toBe(1.8);
    expect(expansionBand(25)).toBe(1.6);
    expect(expansionBand(80)).toBe(1.3);
  });
});

describe('pseudoLocalize', () => {
  it('case 2: Equip with every knob on is bracketed, has no ASCII letter, and pads to the band', () => {
    const out = pseudoLocalize('Equip', ALL_ON);
    expect(out).toMatch(/^\[.*\]$/);
    expect(out).not.toMatch(/[A-Za-z]/);
    expect(stripMarkers(out).length).toBe(Math.ceil(5 * expansionBand(5)));
    expect(stripMarkers(out).length).toBe(10);
  });

  it('case 3: FText::Format tokens survive byte-identical and pass QA placeholder parity', () => {
    const source = 'Deal {0} damage over {Duration}s';
    const pseudo = pseudoLocalize(source, ALL_ON);
    expect(pseudo).toContain('{0}');
    expect(pseudo).toContain('{Duration}');

    const s: LocalizableString = {
      id: 'str_deal',
      sourceText: source,
      context: 'ability_description',
      currentUsage: 'nsloctext',
      locNamespace: 'Abilities',
      locKey: 'DealDamage',
      locations: [{ filePath: 'Source/Abilities/GA.cpp', lineNumber: 3, columnStart: 1, columnEnd: 40, codeSnippet: '' }],
      sourceModule: 'abilities',
      detectionConfidence: 0.9,
    };
    const entry: TranslationEntry = {
      stringId: s.id,
      locale: 'de',
      translatedText: pseudo,
      status: 'translated',
      translatorNotes: '',
      backTranslation: '',
      confidence: 1,
      expansionWarning: false,
      charDelta: pseudo.length - source.length,
    };
    const { findings } = validateTranslations([entry], [s], [], ['de']);
    expect(findings.filter((f) => f.check === 'placeholder_parity')).toHaveLength(0);
  });

  it('case 4: the three knobs are independent', () => {
    expect(pseudoLocalize('Drop', { length: false, markers: true, accents: false })).toBe('[Drop]');
    const accentsOnly = pseudoLocalize('Drop', { length: false, markers: false, accents: true });
    expect(accentsOnly).toHaveLength(4);
    expect(accentsOnly).not.toMatch(/[A-Za-z]/);
  });

  it('[guard] the pseudo locale is never an offered target locale', () => {
    expect(SUPPORTED_LOCALES.map((l) => l.code)).not.toContain(PSEUDO_LOCALE);
  });
});
