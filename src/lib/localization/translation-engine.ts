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
import { SUPPORTED_LOCALES } from './definitions';

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

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
/*  Simulated Translation Database                                     */
/*  (In production, this calls an LLM API)                            */
/* ------------------------------------------------------------------ */

const TRANSLATION_DB: Record<string, string> = {
  // German (de)
  'Fireball:de': 'Feuerball',
  'Hurl a blazing orb that deals fire damage on impact:de': 'Schleuder eine lodernde Kugel, die bei Einschlag Feuerschaden verursacht',
  'Ground Slam:de': 'Erderschütterung',
  'Slam the ground dealing AoE damage and stunning enemies:de': 'Schlage auf den Boden und verursache Flächenschaden, der Feinde betäubt',
  'Dash Strike:de': 'Sturmangriff',
  'War Cry:de': 'Kriegsruf',
  'Let out a mighty war cry, buffing nearby allies:de': 'Stoße einen mächtigen Kriegsruf aus, der nahe Verbündete stärkt',
  'Dodge Roll:de': 'Ausweichrolle',
  'Iron Sword:de': 'Eisenschwert',
  'A sturdy blade forged from iron. Reliable but unremarkable.:de': 'Eine robuste, aus Eisen geschmiedete Klinge. Zuverlässig, aber unscheinbar.',
  'Health Potion:de': 'Heiltrank',
  'Restores 50 Health over 5 seconds:de': 'Stellt 50 Gesundheit über 5 Sekunden wieder her',
  'Enchanted Amulet of the Phoenix:de': 'Verzaubertes Amulett des Phönix',
  'Grants a second chance upon death, reviving with 30% HP:de': 'Gewährt beim Tod eine zweite Chance und belebt mit 30% LP wieder',
  'Inventory:de': 'Inventar',
  'Character Stats:de': 'Charakterwerte',
  'Equip:de': 'Ausrüsten',
  'Drop:de': 'Ablegen',
  'Use:de': 'Benutzen',
  'Confirm:de': 'Bestätigen',
  'Cancel:de': 'Abbrechen',
  'The Lost Relic:de': 'Das verlorene Relikt',
  'Recover the ancient artifact from the depths of the Sunken Temple:de': 'Berge das antike Artefakt aus den Tiefen des Versunkenen Tempels',
  'A New Beginning:de': 'Ein neuer Anfang',
  'Greetings, adventurer. What brings you to this forsaken land?:de': 'Seid gegrüßt, Abenteurer. Was führt Euch in dieses verwunschene Land?',
  'The darkness grows stronger each day. We need a hero.:de': 'Die Dunkelheit wird jeden Tag stärker. Wir brauchen einen Helden.',
  'Health:de': 'Gesundheit',
  'Mana:de': 'Mana',
  'Strength:de': 'Stärke',
  'Dexterity:de': 'Geschick',
  'Intelligence:de': 'Intelligenz',
  'Critical Hit Chance:de': 'Kritische Trefferchance',
  'Level Up!:de': 'Aufstieg!',
  'Quest Complete!:de': 'Quest abgeschlossen!',
  'New Item Acquired:de': 'Neuer Gegenstand erhalten',
  'Not enough mana!:de': 'Nicht genug Mana!',

  // French (fr)
  'Fireball:fr': 'Boule de Feu',
  'Hurl a blazing orb that deals fire damage on impact:fr': 'Lance un orbe ardent qui inflige des dégâts de feu à l\'impact',
  'Ground Slam:fr': 'Fracas du Sol',
  'Dash Strike:fr': 'Frappe Éclair',
  'War Cry:fr': 'Cri de Guerre',
  'Dodge Roll:fr': 'Roulade d\'Esquive',
  'Iron Sword:fr': 'Épée de Fer',
  'Health Potion:fr': 'Potion de Soin',
  'Inventory:fr': 'Inventaire',
  'Character Stats:fr': 'Statistiques du Personnage',
  'Equip:fr': 'Équiper',
  'Drop:fr': 'Jeter',
  'Use:fr': 'Utiliser',
  'Confirm:fr': 'Confirmer',
  'Cancel:fr': 'Annuler',
  'The Lost Relic:fr': 'La Relique Perdue',
  'A New Beginning:fr': 'Un Nouveau Départ',
  'Health:fr': 'Santé',
  'Mana:fr': 'Mana',
  'Strength:fr': 'Force',
  'Dexterity:fr': 'Dextérité',
  'Intelligence:fr': 'Intelligence',
  'Level Up!:fr': 'Niveau Supérieur !',
  'Quest Complete!:fr': 'Quête Terminée !',
  'Not enough mana!:fr': 'Pas assez de mana !',

  // Spanish (es)
  'Fireball:es': 'Bola de Fuego',
  'Ground Slam:es': 'Golpe Sísmico',
  'Dash Strike:es': 'Embestida Veloz',
  'War Cry:es': 'Grito de Guerra',
  'Dodge Roll:es': 'Rodada Evasiva',
  'Iron Sword:es': 'Espada de Hierro',
  'Health Potion:es': 'Poción de Salud',
  'Inventory:es': 'Inventario',
  'Equip:es': 'Equipar',
  'Drop:es': 'Soltar',
  'Use:es': 'Usar',
  'Confirm:es': 'Confirmar',
  'Cancel:es': 'Cancelar',
  'Health:es': 'Salud',
  'Mana:es': 'Maná',
  'Strength:es': 'Fuerza',
  'Level Up!:es': '¡Subida de Nivel!',
  'Not enough mana!:es': '¡No hay suficiente maná!',

  // Japanese (ja)
  'Fireball:ja': 'ファイアボール',
  'Ground Slam:ja': 'グランドスラム',
  'Dash Strike:ja': 'ダッシュストライク',
  'War Cry:ja': '鬨の声',
  'Dodge Roll:ja': '回避ロール',
  'Iron Sword:ja': '鉄の剣',
  'Health Potion:ja': '回復薬',
  'Inventory:ja': 'インベントリ',
  'Equip:ja': '装備',
  'Drop:ja': '捨てる',
  'Use:ja': '使用',
  'Confirm:ja': '確認',
  'Cancel:ja': 'キャンセル',
  'Health:ja': '体力',
  'Mana:ja': 'マナ',
  'Strength:ja': '筋力',
  'Dexterity:ja': '器用さ',
  'Intelligence:ja': '知力',
  'Level Up!:ja': 'レベルアップ！',
  'Not enough mana!:ja': 'マナが足りない！',

  // Simplified Chinese (zh-Hans)
  'Fireball:zh-Hans': '火球术',
  'Ground Slam:zh-Hans': '地裂斩',
  'War Cry:zh-Hans': '战吼',
  'Iron Sword:zh-Hans': '铁剑',
  'Health Potion:zh-Hans': '生命药水',
  'Inventory:zh-Hans': '背包',
  'Equip:zh-Hans': '装备',
  'Health:zh-Hans': '生命值',
  'Mana:zh-Hans': '魔力',
  'Strength:zh-Hans': '力量',
  'Level Up!:zh-Hans': '升级！',
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
): TranslationEntry {
  const dbKey = `${source.sourceText}:${locale}`;
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
  } else if (TRANSLATION_DB[dbKey]) {
    translatedText = TRANSLATION_DB[dbKey];
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
    status: confidence >= 0.85 ? 'translated' : 'needs_review',
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
): TranslationResult {
  const rng = mulberry32(seed);
  const entries: TranslationEntry[] = [];
  const reviewRequired: TranslationEntry[] = [];
  const expansionIssues: Record<string, number> = {};

  for (const locale of targetLocales) {
    expansionIssues[locale] = 0;
  }

  // Only translate strings that aren't already localized
  const translatable = strings.filter(
    (s) => s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext',
  );

  for (const str of translatable) {
    for (const locale of targetLocales) {
      const entry = translateString(str, locale, glossary, rng);
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
