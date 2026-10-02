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

/* ------------------------------------------------------------------ */
/*  Translation QA (validates the translated OUTPUT, not the source)   */
/* ------------------------------------------------------------------ */

/**
 * Automated QA checks run against each {@link TranslationEntry}, mirroring the
 * target-side validators in memoQ QA / Xbench / Verifika / Lokalise. The scan
 * engine only flags source-side hazards; these catch the failures most likely
 * to ship a broken build (a dropped `{0}` crashes UE5's FText::Format).
 */
export type TranslationQACheck =
  | 'placeholder_parity'
  | 'number_parity'
  | 'untranslated'
  | 'empty'
  | 'whitespace'
  | 'glossary';

export type TranslationQASeverity = 'critical' | 'warning' | 'info';

/** A single translation-QA finding for one entry in one locale. */
export interface TranslationQAFinding {
  id: string;
  stringId: string;
  locale: string;
  check: TranslationQACheck;
  severity: TranslationQASeverity;
  /** Human-readable description of the problem. */
  message: string;
  /** The English source text the translation was checked against. */
  sourceText: string;
  /** The translated text that failed the check. */
  translatedText: string;
  /** Suggested fix. */
  suggestion: string;
  /** CLI prompt to fix this finding (mirrors {@link LocalizationHazard.fixPrompt}). */
  fixPrompt: string;
}

/** Per-locale QA roll-up gating the "ready to ship" badge. */
export interface LocaleQAStatus {
  locale: string;
  totalEntries: number;
  findingCount: number;
  criticalCount: number;
  /** Findings that block ship (critical + warning; info is advisory). */
  blockingCount: number;
  /** True when the locale has translations and zero blocking findings. */
  readyToShip: boolean;
}

/** Full translation-QA result for a batch of entries. */
export interface TranslationQAResult {
  findings: TranslationQAFinding[];
  byLocale: Record<string, LocaleQAStatus>;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  /** True when there are zero critical/warning findings across all locales. */
  clean: boolean;
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

/** How a string literal is used in C++ source (the extractor's classification). */
export type StringUsage = 'hardcoded' | 'ftext_fromstring' | 'nsloctext' | 'loctext';

/**
 * One user-facing string literal found in C++ text, with its real location. The single
 * input shape of the scanner and its hazard rules - real project files and the demo
 * corpus both arrive as units.
 */
export interface RawStringUnit {
  text: string;
  usage: StringUsage;
  /** POSIX path relative to the project root, e.g. `Source/Game/UI/WBP_Menu.cpp`. */
  filePath: string;
  /** 1-based line of the literal. */
  line: number;
  /** 1-based column of the literal's opening quote. */
  column: number;
  /** The trimmed source line holding the literal. */
  snippet: string;
  /** Code left of the literal on its line (LHS / setter call) - what the context detector reads. */
  identifierHint: string;
  /** LOCTEXT / NSLOCTEXT namespace and key, when the literal is already localized. */
  namespace?: string;
  key?: string;
  /** A declared context (demo corpus only); real units derive theirs from identifierHint. */
  declaredContext?: StringContext;
}

/** Why a literal the extractor saw is not a localizable unit. */
export type ExcludedLiteralClass = 'log' | 'loc-key' | 'include' | 'metadata' | 'fragment' | 'unclassified';

/** Where the scanned strings came from - a scan reports what it read, never claims it. */
export interface ScanProvenance {
  kind: 'project' | 'fixture';
  /** The project root whose Source/ was read; null for the demo corpus. */
  root: string | null;
  filesScanned: number;
  literalsSeen: number;
  excluded: Partial<Record<ExcludedLiteralClass, number>>;
  /** True when a file/byte cap stopped the walk early. */
  truncated: boolean;
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

/** A LOCTEXT replacement suggestion (original → suggested code diff for one string) */
export interface LOCTEXTReplacementSuggestion {
  stringId: string;
  originalCode: string;
  suggestedCode: string;
}

/** LOCTEXT replacement suggestion enriched with its source location */
export interface LOCTEXTReplacement extends LOCTEXTReplacementSuggestion {
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
