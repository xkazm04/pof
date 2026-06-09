import { describe, it, expect } from 'vitest';
import { validateTranslations } from '@/lib/localization/qa-engine';
import { scanForLocalizableStrings } from '@/lib/localization/scan-engine';
import { translateBatch } from '@/lib/localization/translation-engine';
import { DEFAULT_GLOSSARY } from '@/lib/localization/definitions';
import type {
  LocalizableString,
  TranslationEntry,
  GlossaryEntry,
} from '@/types/localization-pipeline';

/* ---- Builders ----------------------------------------------------- */

function source(partial: Partial<LocalizableString> & { id: string; sourceText: string }): LocalizableString {
  return {
    context: 'ui_label',
    currentUsage: 'hardcoded',
    locNamespace: 'UI',
    locKey: 'Key',
    locations: [],
    sourceModule: 'arpg-ui',
    detectionConfidence: 0.9,
    ...partial,
  };
}

function entry(partial: Partial<TranslationEntry> & { stringId: string; locale: string; translatedText: string }): TranslationEntry {
  return {
    status: 'translated',
    translatorNotes: '',
    backTranslation: '',
    confidence: 0.9,
    expansionWarning: false,
    charDelta: 0,
    ...partial,
  };
}

/* ------------------------------------------------------------------- */

describe('validateTranslations — per-check detection', () => {
  it('flags a dropped {0} placeholder as critical (FText::Format crash)', () => {
    const strings = [source({ id: 's1', sourceText: 'Restores {0} health' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Stellt Gesundheit wieder her' })];
    const qa = validateTranslations(entries, strings);
    const f = qa.findings.find((x) => x.check === 'placeholder_parity');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.message).toContain('{0}');
  });

  it('flags an added placeholder not present in the source', () => {
    const strings = [source({ id: 's1', sourceText: 'Equip' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Ausrüsten {0}' })];
    const qa = validateTranslations(entries, strings);
    expect(qa.findings.some((x) => x.check === 'placeholder_parity')).toBe(true);
  });

  it('passes when placeholders match in any order', () => {
    const strings = [source({ id: 's1', sourceText: '{0} hits {1}' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: '{1} wird von {0} getroffen' })];
    const qa = validateTranslations(entries, strings);
    expect(qa.findings.some((x) => x.check === 'placeholder_parity')).toBe(false);
  });

  it('flags a missing number as number_parity (warning)', () => {
    const strings = [source({ id: 's1', sourceText: 'Restores 50 Health over 5 seconds' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Stellt Gesundheit über 5 Sekunden wieder her' })];
    const qa = validateTranslations(entries, strings);
    const f = qa.findings.find((x) => x.check === 'number_parity');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('warning');
    expect(f!.message).toContain('50');
  });

  it('treats locale-formatted numbers (1,000 vs 1.000) as equal', () => {
    const strings = [source({ id: 's1', sourceText: 'Deals 1,000 damage' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Verursacht 1.000 Schaden' })];
    const qa = validateTranslations(entries, strings);
    expect(qa.findings.some((x) => x.check === 'number_parity')).toBe(false);
  });

  it('flags an untranslated (identical-to-source) segment', () => {
    const strings = [source({ id: 's1', sourceText: 'Health Potion' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Health Potion' })];
    const qa = validateTranslations(entries, strings);
    const f = qa.findings.find((x) => x.check === 'untranslated');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('warning');
  });

  it('does NOT flag identical-to-source when the glossary maps the term to itself (Mana→Mana)', () => {
    const strings = [source({ id: 's1', sourceText: 'Mana' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Mana' })];
    const qa = validateTranslations(entries, strings, DEFAULT_GLOSSARY);
    expect(qa.findings.some((x) => x.check === 'untranslated')).toBe(false);
  });

  it('does NOT flag identical-to-source for do-not-translate glossary terms (GAS)', () => {
    const strings = [source({ id: 's1', sourceText: 'GAS' })];
    const entries = [entry({ stringId: 's1', locale: 'fr', translatedText: 'GAS' })];
    const qa = validateTranslations(entries, strings, DEFAULT_GLOSSARY);
    expect(qa.findings.some((x) => x.check === 'untranslated')).toBe(false);
  });

  it('does NOT flag a pure-symbol / single-char source as untranslated', () => {
    const strings = [source({ id: 's1', sourceText: '...' }), source({ id: 's2', sourceText: 'X' })];
    const entries = [
      entry({ stringId: 's1', locale: 'de', translatedText: '...' }),
      entry({ stringId: 's2', locale: 'de', translatedText: 'X' }),
    ];
    const qa = validateTranslations(entries, strings);
    expect(qa.findings.some((x) => x.check === 'untranslated')).toBe(false);
  });

  it('flags an empty translation as critical and skips other checks', () => {
    const strings = [source({ id: 's1', sourceText: 'Restores {0} health' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: '   ' })];
    const qa = validateTranslations(entries, strings);
    const localeFindings = qa.findings.filter((x) => x.locale === 'de');
    expect(localeFindings).toHaveLength(1);
    expect(localeFindings[0].check).toBe('empty');
    expect(localeFindings[0].severity).toBe('critical');
  });

  it('flags leading/trailing and doubled whitespace as info', () => {
    const strings = [source({ id: 's1', sourceText: 'Inventory' }), source({ id: 's2', sourceText: 'Quest Log' })];
    const entries = [
      entry({ stringId: 's1', locale: 'de', translatedText: 'Inventar ' }),
      entry({ stringId: 's2', locale: 'de', translatedText: 'Quest  Log' }),
    ];
    const qa = validateTranslations(entries, strings);
    const ws = qa.findings.filter((x) => x.check === 'whitespace');
    expect(ws).toHaveLength(2);
    expect(ws.every((x) => x.severity === 'info')).toBe(true);
  });

  it('flags a glossary term not rendered with its approved translation', () => {
    const glossary: GlossaryEntry[] = [
      { sourceTerm: 'Health', context: 'stat_label', translations: { de: 'Gesundheit' }, doNotTranslate: false },
    ];
    const strings = [source({ id: 's1', sourceText: 'Health' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Leben' })];
    const qa = validateTranslations(entries, strings, glossary);
    const f = qa.findings.find((x) => x.check === 'glossary');
    expect(f).toBeDefined();
    expect(f!.message).toContain('Gesundheit');
  });

  it('passes a glossary term rendered with its approved translation', () => {
    const glossary: GlossaryEntry[] = [
      { sourceTerm: 'Health', context: 'stat_label', translations: { de: 'Gesundheit' }, doNotTranslate: false },
    ];
    const strings = [source({ id: 's1', sourceText: 'Health' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Gesundheit' })];
    const qa = validateTranslations(entries, strings, glossary);
    expect(qa.findings.some((x) => x.check === 'glossary')).toBe(false);
  });

  it('attaches a one-click fixPrompt to every finding', () => {
    const strings = [source({ id: 's1', sourceText: 'Restores {0} health' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Stellt Gesundheit wieder her' })];
    const qa = validateTranslations(entries, strings);
    expect(qa.findings.length).toBeGreaterThan(0);
    for (const f of qa.findings) {
      expect(f.fixPrompt.length).toBeGreaterThan(10);
      expect(f.fixPrompt).toContain('de');
    }
  });

  it('produces deterministic finding ids across runs', () => {
    const strings = [source({ id: 's1', sourceText: 'Restores {0} health' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Stellt Gesundheit wieder her' })];
    const a = validateTranslations(entries, strings);
    const b = validateTranslations(entries, strings);
    expect(a.findings.map((f) => f.id)).toEqual(b.findings.map((f) => f.id));
  });
});

describe('validateTranslations — per-locale roll-up & ready-to-ship gate', () => {
  it('marks a locale ready to ship only with translations and zero blocking findings', () => {
    const strings = [source({ id: 's1', sourceText: 'Inventory' })];
    const entries = [
      entry({ stringId: 's1', locale: 'de', translatedText: 'Inventar' }), // clean
      entry({ stringId: 's1', locale: 'fr', translatedText: 'Inventory' }), // untranslated → blocking
    ];
    const qa = validateTranslations(entries, strings, [], ['de', 'fr']);
    expect(qa.byLocale.de.readyToShip).toBe(true);
    expect(qa.byLocale.fr.readyToShip).toBe(false);
    expect(qa.byLocale.fr.blockingCount).toBeGreaterThan(0);
  });

  it('does not mark an info-only locale as blocked (ready to ship with advisory whitespace)', () => {
    const strings = [source({ id: 's1', sourceText: 'Inventory' })];
    const entries = [entry({ stringId: 's1', locale: 'de', translatedText: 'Inventar ' })]; // trailing space → info
    const qa = validateTranslations(entries, strings, [], ['de']);
    expect(qa.byLocale.de.findingCount).toBe(1);
    expect(qa.byLocale.de.blockingCount).toBe(0);
    expect(qa.byLocale.de.readyToShip).toBe(true);
  });

  it('includes a requested locale with no entries as not-ready (no data)', () => {
    const qa = validateTranslations([], [], [], ['ja']);
    expect(qa.byLocale.ja.totalEntries).toBe(0);
    expect(qa.byLocale.ja.readyToShip).toBe(false);
  });

  it('reports a clean run on the default demo corpus (engine output is QA-clean)', () => {
    const scan = scanForLocalizableStrings();
    const translatable = scan.strings.filter(
      (s) => s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext',
    );
    const result = translateBatch(translatable, ['de', 'fr', 'es', 'ja', 'zh-Hans'], DEFAULT_GLOSSARY);
    const qa = validateTranslations(result.entries, translatable, DEFAULT_GLOSSARY, ['de', 'fr', 'es', 'ja', 'zh-Hans']);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(qa.clean).toBe(true);
    expect(qa.criticalCount).toBe(0);
  });
});
