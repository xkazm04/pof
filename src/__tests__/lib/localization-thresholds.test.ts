import { describe, it, expect } from 'vitest';
import { LOW_CONFIDENCE, REVIEW_GATE, DEFAULT_CONFIG } from '@/lib/localization/definitions';
import { scanForLocalizableStrings } from '@/lib/localization/scan-engine';
import { translateBatch } from '@/lib/localization/translation-engine';

/** Translatable subset of the demo corpus (excludes already-localized macros). */
function translatableStrings() {
  const scan = scanForLocalizableStrings();
  return scan.strings.filter(
    (s) => s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext',
  );
}

describe('localization confidence thresholds', () => {
  describe('named constants', () => {
    it('expose the canonical default values', () => {
      expect(LOW_CONFIDENCE).toBe(0.7);
      expect(REVIEW_GATE).toBe(0.85);
    });

    it('single-source the config auto-apply threshold off REVIEW_GATE', () => {
      expect(DEFAULT_CONFIG.autoApplyThreshold).toBe(REVIEW_GATE);
    });
  });

  describe('scan engine floors detection confidence at LOW_CONFIDENCE', () => {
    it('never reports a string below the floor', () => {
      const scan = scanForLocalizableStrings();
      expect(scan.strings.length).toBeGreaterThan(0);
      for (const s of scan.strings) {
        expect(s.detectionConfidence).toBeGreaterThanOrEqual(LOW_CONFIDENCE);
      }
    });
  });

  describe('translateBatch honors the (threaded) review gate', () => {
    it('defaults to REVIEW_GATE when no threshold is passed', () => {
      const strings = translatableStrings();
      const implicit = translateBatch(strings, ['de'], [], 42);
      const explicit = translateBatch(strings, ['de'], [], 42, REVIEW_GATE);
      expect(implicit.entries.map((e) => e.status)).toEqual(
        explicit.entries.map((e) => e.status),
      );
    });

    it('flags everything for review when the gate is unreachable', () => {
      const strings = translatableStrings();
      const { entries, reviewRequired } = translateBatch(strings, ['de'], [], 42, 1.01);
      expect(entries.length).toBeGreaterThan(0);
      expect(reviewRequired.length).toBe(entries.length);
      expect(entries.every((e) => e.status === 'needs_review')).toBe(true);
    });

    it('auto-applies everything when the gate is trivially low', () => {
      const strings = translatableStrings();
      const { entries, reviewRequired } = translateBatch(strings, ['de'], [], 42, 0);
      expect(entries.length).toBeGreaterThan(0);
      expect(reviewRequired.length).toBe(0);
      expect(entries.every((e) => e.status === 'translated')).toBe(true);
    });

    it('raising the gate strictly increases the review backlog', () => {
      const strings = translatableStrings();
      const atDefault = translateBatch(strings, ['de'], [], 42, REVIEW_GATE);
      const stricter = translateBatch(strings, ['de'], [], 42, 0.99);
      expect(stricter.reviewRequired.length).toBeGreaterThan(atDefault.reviewRequired.length);
    });
  });
});
