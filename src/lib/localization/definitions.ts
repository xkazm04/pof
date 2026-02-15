/* ------------------------------------------------------------------ */
/*  Localization Pipeline — Definitions & Defaults                    */
/* ------------------------------------------------------------------ */

import type {
  TargetLocale,
  GlossaryEntry,
  LocalizationConfig,
  StringContext,
} from '@/types/localization-pipeline';

/* ---- Supported Locales ------------------------------------------- */

export const SUPPORTED_LOCALES: TargetLocale[] = [
  { code: 'en',    name: 'English',             nativeName: 'English',    expansionFactor: 1.0,  direction: 'ltr', complexPlurals: false },
  { code: 'de',    name: 'German',              nativeName: 'Deutsch',    expansionFactor: 1.35, direction: 'ltr', complexPlurals: false },
  { code: 'fr',    name: 'French',              nativeName: 'Français',   expansionFactor: 1.25, direction: 'ltr', complexPlurals: false },
  { code: 'es',    name: 'Spanish',             nativeName: 'Español',    expansionFactor: 1.25, direction: 'ltr', complexPlurals: false },
  { code: 'pt-BR', name: 'Brazilian Portuguese', nativeName: 'Português', expansionFactor: 1.2,  direction: 'ltr', complexPlurals: false },
  { code: 'it',    name: 'Italian',             nativeName: 'Italiano',   expansionFactor: 1.2,  direction: 'ltr', complexPlurals: false },
  { code: 'ja',    name: 'Japanese',            nativeName: '日本語',      expansionFactor: 0.6,  direction: 'ltr', complexPlurals: false },
  { code: 'ko',    name: 'Korean',              nativeName: '한국어',      expansionFactor: 0.7,  direction: 'ltr', complexPlurals: false },
  { code: 'zh-Hans', name: 'Simplified Chinese', nativeName: '简体中文',   expansionFactor: 0.5,  direction: 'ltr', complexPlurals: false },
  { code: 'ru',    name: 'Russian',             nativeName: 'Русский',    expansionFactor: 1.3,  direction: 'ltr', complexPlurals: true  },
  { code: 'pl',    name: 'Polish',              nativeName: 'Polski',     expansionFactor: 1.3,  direction: 'ltr', complexPlurals: true  },
  { code: 'ar',    name: 'Arabic',              nativeName: 'العربية',    expansionFactor: 1.2,  direction: 'rtl', complexPlurals: true  },
  { code: 'tr',    name: 'Turkish',             nativeName: 'Türkçe',     expansionFactor: 1.2,  direction: 'ltr', complexPlurals: false },
];

/* ---- Context display labels -------------------------------------- */

export const CONTEXT_LABELS: Record<StringContext, string> = {
  ability_name: 'Ability Name',
  ability_description: 'Ability Description',
  item_name: 'Item Name',
  item_tooltip: 'Item Tooltip',
  ui_label: 'UI Label',
  ui_button: 'UI Button',
  menu_title: 'Menu Title',
  quest_title: 'Quest Title',
  quest_description: 'Quest Description',
  dialogue_line: 'Dialogue Line',
  stat_label: 'Stat Label',
  notification: 'Notification',
  tutorial: 'Tutorial',
  unknown: 'Unknown',
};

/* ---- Context → Namespace mapping --------------------------------- */

export const CONTEXT_NAMESPACES: Record<StringContext, string> = {
  ability_name: 'Abilities',
  ability_description: 'Abilities',
  item_name: 'Items',
  item_tooltip: 'Items',
  ui_label: 'UI',
  ui_button: 'UI',
  menu_title: 'Menu',
  quest_title: 'Quests',
  quest_description: 'Quests',
  dialogue_line: 'Dialogue',
  stat_label: 'Stats',
  notification: 'Notifications',
  tutorial: 'Tutorial',
  unknown: 'Misc',
};

/* ---- Default aRPG Glossary --------------------------------------- */

export const DEFAULT_GLOSSARY: GlossaryEntry[] = [
  { sourceTerm: 'Health',       context: 'stat_label',          translations: { de: 'Gesundheit', fr: 'Santé', ja: '体力', es: 'Salud' }, doNotTranslate: false },
  { sourceTerm: 'Mana',         context: 'stat_label',          translations: { de: 'Mana', fr: 'Mana', ja: 'マナ', es: 'Maná' }, doNotTranslate: false },
  { sourceTerm: 'Stamina',      context: 'stat_label',          translations: { de: 'Ausdauer', fr: 'Endurance', ja: 'スタミナ', es: 'Aguante' }, doNotTranslate: false },
  { sourceTerm: 'Strength',     context: 'stat_label',          translations: { de: 'Stärke', fr: 'Force', ja: '筋力', es: 'Fuerza' }, doNotTranslate: false },
  { sourceTerm: 'Dexterity',    context: 'stat_label',          translations: { de: 'Geschick', fr: 'Dextérité', ja: '器用さ', es: 'Destreza' }, doNotTranslate: false },
  { sourceTerm: 'Intelligence', context: 'stat_label',          translations: { de: 'Intelligenz', fr: 'Intelligence', ja: '知力', es: 'Inteligencia' }, doNotTranslate: false },
  { sourceTerm: 'Armor',        context: 'stat_label',          translations: { de: 'Rüstung', fr: 'Armure', ja: '防御力', es: 'Armadura' }, doNotTranslate: false },
  { sourceTerm: 'Critical Hit', context: 'stat_label',          translations: { de: 'Kritischer Treffer', fr: 'Coup Critique', ja: 'クリティカル', es: 'Golpe Crítico' }, doNotTranslate: false },
  { sourceTerm: 'Fireball',     context: 'ability_name',        translations: { de: 'Feuerball', fr: 'Boule de Feu', ja: 'ファイアボール', es: 'Bola de Fuego' }, doNotTranslate: false },
  { sourceTerm: 'Inventory',    context: 'menu_title',          translations: { de: 'Inventar', fr: 'Inventaire', ja: 'インベントリ', es: 'Inventario' }, doNotTranslate: false },
  { sourceTerm: 'Quest Log',    context: 'menu_title',          translations: { de: 'Questlog', fr: 'Journal de Quêtes', ja: 'クエストログ', es: 'Registro de Misiones' }, doNotTranslate: false },
  { sourceTerm: 'Equip',        context: 'ui_button',           translations: { de: 'Ausrüsten', fr: 'Équiper', ja: '装備', es: 'Equipar' }, doNotTranslate: false },
  { sourceTerm: 'Unequip',      context: 'ui_button',           translations: { de: 'Ablegen', fr: 'Déséquiper', ja: '外す', es: 'Desequipar' }, doNotTranslate: false },
  { sourceTerm: 'Level Up',     context: 'notification',        translations: { de: 'Aufstieg!', fr: 'Niveau Supérieur!', ja: 'レベルアップ！', es: '¡Subida de Nivel!' }, doNotTranslate: false },
  { sourceTerm: 'GAS',          context: 'unknown',             translations: {}, doNotTranslate: true },
  { sourceTerm: 'GameplayAbility', context: 'unknown',          translations: {}, doNotTranslate: true },
  { sourceTerm: 'AttributeSet',    context: 'unknown',          translations: {}, doNotTranslate: true },
];

/* ---- Default Config ---------------------------------------------- */

export const DEFAULT_CONFIG: LocalizationConfig = {
  rootNamespace: 'Game',
  targetLocales: ['de', 'fr', 'es', 'ja', 'zh-Hans'],
  scanModules: [
    'arpg-character',
    'arpg-abilities',
    'arpg-inventory',
    'arpg-menu-flow',
    'arpg-dialogue-quests',
    'arpg-combat',
    'arpg-loot',
    'arpg-ai',
    'arpg-save-load',
    'arpg-ui-hud',
    'arpg-audio',
    'arpg-polish',
  ],
  glossary: DEFAULT_GLOSSARY,
  autoApplyThreshold: 0.85,
};

/* ---- Hazard descriptions ----------------------------------------- */

export const HAZARD_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  text_concatenation:  { label: 'String Concatenation',   description: 'Strings built with + or FString::Printf with embedded sub-strings break word order in other languages' },
  text_expansion:      { label: 'Text Expansion Risk',    description: 'UI element may overflow when translated to languages with longer text (German ~35%, Russian ~30%)' },
  idiom:               { label: 'Idiomatic Expression',   description: 'English idiom or cultural reference that may not translate meaningfully' },
  placeholder_order:   { label: 'Placeholder Order',      description: 'Numbered placeholders ({0}, {1}) may need reordering in other languages' },
  gender_agreement:    { label: 'Gender Agreement',       description: 'String requires grammatical gender that varies by language (French, German, Spanish, etc.)' },
  plural_form:         { label: 'Plural Form',            description: 'Simple singular/plural logic breaks in languages with complex plural rules (Russian, Polish, Arabic)' },
  number_format:       { label: 'Number Formatting',      description: 'Hardcoded decimal separator or thousands separator (1,000.00 vs 1.000,00)' },
  date_format:         { label: 'Date Formatting',        description: 'Hardcoded date format (MM/DD vs DD/MM)' },
  text_in_texture:     { label: 'Text in Texture',        description: 'Text baked into image/texture assets cannot be localized through string tables' },
  hardcoded_layout:    { label: 'Hardcoded Layout',       description: 'Fixed-width UI element may not accommodate RTL text or longer translations' },
};

/* ---- Sample code patterns for scanning --------------------------- */

export const HARDCODED_PATTERNS = [
  /FText::FromString\(\s*TEXT\(\s*"([^"]+)"\s*\)\s*\)/,
  /FText::FromString\(\s*"([^"]+)"\s*\)/,
  /SetText\(\s*FText::FromString\(\s*"([^"]+)"\s*\)\s*\)/,
  /->SetText\(\s*FText::FromString\(\s*"([^"]+)"\s*\)\s*\)/,
  /FString\(\s*TEXT\(\s*"([^"]+)"\s*\)\s*\)/,
  /UE_LOG\([^,]+,\s*[^,]+,\s*TEXT\(\s*"([^"]+)"\s*\)\s*\)/,
];

export const LOCALIZED_PATTERNS = [
  /NSLOCTEXT\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/,
  /LOCTEXT\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/,
  /FText::FromStringTable\(/,
];
