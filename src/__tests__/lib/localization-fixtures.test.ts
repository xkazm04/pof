import { describe, it, expect } from 'vitest';
import { getSampleStrings, lookupTranslation } from '@/lib/localization/fixtures';
import { scanForLocalizableStrings } from '@/lib/localization/scan-engine';
import { translateBatch } from '@/lib/localization/translation-engine';

describe('localization fixtures accessors', () => {
  describe('getSampleStrings', () => {
    it('returns the demo corpus (golden count)', () => {
      expect(getSampleStrings()).toHaveLength(39);
    });

    it('includes a known sample with its full shape', () => {
      const fireball = getSampleStrings().find((s) => s.text === 'Fireball');
      expect(fireball).toEqual({
        text: 'Fireball',
        usage: 'ftext_fromstring',
        codeTemplate: 'AbilityName = FText::FromString(TEXT("{0}"));',
        fileHint: 'Source/Abilities/GA_Fireball.cpp',
        contextHint: 'ability_name',
      });
    });

    it('carries the three already-localized (nsloctext) examples', () => {
      const localized = getSampleStrings().filter((s) => s.usage === 'nsloctext');
      expect(localized.map((s) => s.text).sort()).toEqual(['Options', 'Play', 'Quit']);
    });
  });

  describe('lookupTranslation', () => {
    it('returns the canned translation for a known source + locale', () => {
      expect(lookupTranslation('Fireball', 'de')).toBe('Feuerball');
      expect(lookupTranslation('Inventory', 'ja')).toBe('インベントリ');
    });

    it('returns undefined for an unknown source or locale', () => {
      expect(lookupTranslation('Fireball', 'xx')).toBeUndefined();
      expect(lookupTranslation('Not A Real String', 'de')).toBeUndefined();
    });
  });

  // The relocation must be behaviour-preserving: the engines read their data
  // exclusively through the accessors above.
  describe('engines still consume the fixtures', () => {
    it('scans every sample string', () => {
      const result = scanForLocalizableStrings();
      expect(result.totalStringsFound).toBe(getSampleStrings().length);
      expect(result.alreadyLocalizedCount).toBe(3);
    });

    it('uses the canned translation database when translating', () => {
      const scan = scanForLocalizableStrings();
      const translatable = scan.strings.filter(
        (s) => s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext',
      );
      const { entries } = translateBatch(translatable, ['de'], []);
      const fireball = scan.strings.find((s) => s.sourceText === 'Fireball');
      const entry = entries.find((e) => e.stringId === fireball?.id && e.locale === 'de');
      expect(entry?.translatedText).toBe('Feuerball');
    });
  });
});
