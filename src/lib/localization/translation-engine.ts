/* ------------------------------------------------------------------ */
/*  Localization Pipeline — LLM-Powered Translation Engine            */
/* ------------------------------------------------------------------ */

import type {
  LocalizableString,
  TranslationEntry,
  TranslationResult,
  GlossaryEntry,
  StringContext,
} from '@/types/localization-pipeline';
import { SUPPORTED_LOCALES, REVIEW_GATE } from './definitions';
import { lookupTranslation } from './fixtures';
import { isTranslatable } from './scan-engine';

/* ------------------------------------------------------------------ */
/*  Seeded RNG (mulberry32) for reproducible translations             */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Context-aware translation style guides                             */
/* ------------------------------------------------------------------ */

const STYLE_GUIDES: Record<StringContext, string> = {
  ability_name: 'Short, impactful, often 1-3 words. Keep the fantasy flavor. May keep English loanwords in CJK.',
  ability_description: 'Concise game mechanic description. Preserve numbers and mechanics terms. Active voice.',
  item_name: 'Evocative name. May keep proper nouns. 1-4 words typically.',
  item_tooltip: 'Descriptive, may include stats. Keep format tokens like {0}. Semi-formal tone.',
  ui_label: 'Ultra-concise. Must fit UI space. Abbreviate if needed.',
  ui_button: 'Single action verb or very short phrase. Must fit button width.',
  menu_title: 'Title case, 1-3 words. Formal.',
  quest_title: 'Evocative, intriguing. Like a book chapter title.',
  quest_description: 'Clear objective description. Second person ("Recover the..."). Medium length.',
  dialogue_line: 'Natural speech. Match character tone. May use contractions. Preserve personality.',
  stat_label: 'Single word or short compound. Game term — use established genre translations.',
  notification: 'Brief, attention-grabbing. Often includes exclamation. Celebratory or urgent tone.',
  tutorial: 'Clear instructional language. Simple vocabulary. Direct address.',
  unknown: 'General game text. Maintain original tone and register.',
};

/* ------------------------------------------------------------------ */
/*  Translation Engine                                                 */
/* ------------------------------------------------------------------ */

function generateBackTranslation(text: string, locale: string, rng: () => number): string {
  // Simulated back-translation with slight variance
  return text; // In production, call LLM for back-translation
}

function translateString(
  source: LocalizableString,
  locale: string,
  glossary: GlossaryEntry[],
  rng: () => number,
  autoApplyThreshold: number,
): TranslationEntry {
  const dbTranslation = lookupTranslation(source.sourceText, locale);
  const localeInfo = SUPPORTED_LOCALES.find((l) => l.code === locale);
  const expansion = localeInfo?.expansionFactor ?? 1.0;

  // Check glossary first
  const glossaryMatch = glossary.find(
    (g) => g.sourceTerm.toLowerCase() === source.sourceText.toLowerCase() && g.translations[locale],
  );

  let translatedText: string;
  let confidence: number;
  let notes: string;

  if (glossaryMatch) {
    if (glossaryMatch.doNotTranslate) {
      translatedText = source.sourceText;
      confidence = 1.0;
      notes = 'Do-not-translate term per glossary.';
    } else {
      translatedText = glossaryMatch.translations[locale];
      confidence = 0.98;
      notes = 'Translated via project glossary. Consistent with established terminology.';
    }
  } else if (dbTranslation) {
    translatedText = dbTranslation;
    confidence = 0.85 + rng() * 0.1;
    notes = `${STYLE_GUIDES[source.context]} Context-aware translation applied.`;
  } else {
    // Simulate an AI-generated translation for strings not in DB
    translatedText = `[${locale.toUpperCase()}] ${source.sourceText}`;
    confidence = 0.6 + rng() * 0.2;
    notes = `Auto-generated translation. Needs human review for ${source.context} context.`;
  }

  const charDelta = translatedText.length - source.sourceText.length;
  const expansionWarning =
    charDelta > 0 &&
    translatedText.length > source.sourceText.length * expansion * 1.1 &&
    (source.context === 'ui_button' || source.context === 'ui_label' || source.context === 'stat_label');

  return {
    stringId: source.id,
    locale,
    translatedText,
    status: confidence >= autoApplyThreshold ? 'translated' : 'needs_review',
    translatorNotes: notes,
    backTranslation: generateBackTranslation(translatedText, locale, rng),
    confidence,
    expansionWarning,
    charDelta,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Translation                                                  */
/* ------------------------------------------------------------------ */

export function translateBatch(
  strings: LocalizableString[],
  targetLocales: string[],
  glossary: GlossaryEntry[],
  seed = 42,
  autoApplyThreshold = REVIEW_GATE,
): TranslationResult {
  const rng = mulberry32(seed);
  const entries: TranslationEntry[] = [];
  const reviewRequired: TranslationEntry[] = [];
  const expansionIssues: Record<string, number> = {};

  for (const locale of targetLocales) {
    expansionIssues[locale] = 0;
  }

  // Only translate strings that aren't already localized. The route already
  // hands us a pre-filtered set; this guard is idempotent and keeps the engine
  // safe to call with a raw scan result, sharing the single isTranslatable rule.
  const translatable = strings.filter(isTranslatable);

  for (const str of translatable) {
    for (const locale of targetLocales) {
      const entry = translateString(str, locale, glossary, rng, autoApplyThreshold);
      entries.push(entry);

      if (entry.status === 'needs_review') {
        reviewRequired.push(entry);
      }
      if (entry.expansionWarning) {
        expansionIssues[locale]++;
      }
    }
  }

  // Quality score based on confidence distribution
  const avgConfidence = entries.length > 0
    ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
    : 0;
  const qualityScore = Math.round(avgConfidence * 100);

  return {
    entries,
    qualityScore,
    reviewRequired,
    expansionIssues,
  };
}

/* ------------------------------------------------------------------ */
/*  Translation Progress Calculator                                    */
/* ------------------------------------------------------------------ */

export function computeTranslationProgress(
  entries: TranslationEntry[],
  totalStrings: number,
  targetLocales: string[],
): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const locale of targetLocales) {
    const localeEntries = entries.filter((e) => e.locale === locale);
    const translated = localeEntries.filter(
      (e) => e.status === 'translated' || e.status === 'reviewed' || e.status === 'approved',
    );
    progress[locale] = totalStrings > 0 ? Math.round((translated.length / totalStrings) * 100) : 0;
  }
  return progress;
}
