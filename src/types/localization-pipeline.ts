/* ------------------------------------------------------------------ */
/*  Localization Pipeline Types                                       */
/* ------------------------------------------------------------------ */

/** Context category affects translation style */
export type StringContext =
  | 'ability_name'
  | 'ability_description'
  | 'item_name'
  | 'item_tooltip'
  | 'ui_label'
  | 'ui_button'
  | 'menu_title'
  | 'quest_title'
  | 'quest_description'
  | 'dialogue_line'
  | 'stat_label'
  | 'notification'
  | 'tutorial'
  | 'unknown';

/** Where a hardcoded string was found */
export interface StringLocation {
  filePath: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  /** The raw code snippet around the string */
  codeSnippet: string;
}

/** A localizable string extracted from generated code */
export interface LocalizableString {
  id: string;
  /** The original English text */
  sourceText: string;
  /** Auto-detected or manually assigned context */
  context: StringContext;
  /** How the string is currently used in code */
  currentUsage: 'hardcoded' | 'ftext_fromstring' | 'nsloctext' | 'loctext' | 'string_table';
  /** Suggested LOCTEXT namespace */
  locNamespace: string;
  /** Suggested LOCTEXT key */
  locKey: string;
  /** Where this string was found */
  locations: StringLocation[];
  /** Which POF module generated this string */
  sourceModule: string;
  /** Confidence of auto-detection (0-1) */
  detectionConfidence: number;
}

/** Localization hazard types */
export type HazardType =
  | 'text_concatenation'
  | 'text_expansion'
  | 'idiom'
  | 'placeholder_order'
  | 'gender_agreement'
  | 'plural_form'
  | 'number_format'
  | 'date_format'
  | 'text_in_texture'
  | 'hardcoded_layout';

export type HazardSeverity = 'critical' | 'warning' | 'info';

/** A detected localization hazard */
export interface LocalizationHazard {
  id: string;
  type: HazardType;
  severity: HazardSeverity;
  description: string;
  /** The problematic code or string */
  evidence: string;
  location: StringLocation;
  /** Suggested fix */
  suggestion: string;
  /** CLI prompt to fix this hazard */
  fixPrompt: string;
}

/** Supported target locale */
export interface TargetLocale {
  code: string;
  name: string;
  nativeName: string;
  /** Average text expansion factor relative to English */
  expansionFactor: number;
  /** Script direction */
  direction: 'ltr' | 'rtl';
  /** Has complex plural rules */
  complexPlurals: boolean;
}

/** Translation status for a single string */
export type TranslationStatus = 'pending' | 'translated' | 'reviewed' | 'approved' | 'needs_review';

/** A translation entry for one string in one locale */
export interface TranslationEntry {
  stringId: string;
  locale: string;
  translatedText: string;
  status: TranslationStatus;
  /** Context-aware translation notes from LLM */
  translatorNotes: string;
  /** Back-translation to English for quality check */
  backTranslation: string;
  /** Quality confidence (0-1) */
  confidence: number;
  /** Flagged expansion issues */
  expansionWarning: boolean;
  /** Character count delta from source */
  charDelta: number;
}

/** UE5 String Table row */
export interface StringTableRow {
  key: string;
  sourceString: string;
  comment: string;
}

/** A UE5 String Table (.csv format) */
export interface StringTable {
  tableId: string;
  namespace: string;
  rows: StringTableRow[];
}

/** Scan results from analyzing generated code */
export interface ScanResult {
  totalFilesScanned: number;
  totalStringsFound: number;
  hardcodedCount: number;
  ftextFromStringCount: number;
  alreadyLocalizedCount: number;
  strings: LocalizableString[];
  hazards: LocalizationHazard[];
  /** Per-module breakdown */
  moduleBreakdown: Record<string, { total: number; hardcoded: number; localized: number }>;
}

/** Translation batch request */
export interface TranslationRequest {
  strings: LocalizableString[];
  targetLocales: string[];
  /** Provide game-specific terminology */
  glossary: GlossaryEntry[];
}

/** Game-specific term that should be translated consistently */
export interface GlossaryEntry {
  sourceTerm: string;
  context: StringContext;
  translations: Record<string, string>;
  /** Should this term remain untranslated? (e.g., proper nouns) */
  doNotTranslate: boolean;
}

/** Full translation result for a batch */
export interface TranslationResult {
  entries: TranslationEntry[];
  /** Overall quality score 0-100 */
  qualityScore: number;
  /** Strings that need human review */
  reviewRequired: TranslationEntry[];
  /** Expansion warnings per locale */
  expansionIssues: Record<string, number>;
}

/** LOCTEXT replacement suggestion */
export interface LOCTEXTReplacement {
  stringId: string;
  originalCode: string;
  suggestedCode: string;
  location: StringLocation;
}

/** Pipeline configuration */
export interface LocalizationConfig {
  /** Root namespace for NSLOCTEXT macros */
  rootNamespace: string;
  /** Target locales to generate */
  targetLocales: string[];
  /** Module IDs to scan */
  scanModules: string[];
  /** Glossary terms */
  glossary: GlossaryEntry[];
  /** Minimum confidence threshold for auto-applying translations */
  autoApplyThreshold: number;
}

/** Pipeline summary stats */
export interface LocalizationSummary {
  totalStrings: number;
  localizedStrings: number;
  hardcodedStrings: number;
  hazardCount: number;
  criticalHazards: number;
  localesConfigured: number;
  translationProgress: Record<string, number>;
  /** Estimated work remaining (string count × locale count) */
  estimatedWorkRemaining: number;
}
