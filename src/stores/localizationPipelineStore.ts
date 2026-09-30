import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  ScanResult,
  TranslationResult,
  LocalizationConfig,
  TargetLocale,
  LocalizableString,
  LocalizationHazard,
  LOCTEXTReplacementSuggestion,
  TranslationEntry,
  StringTable,
  TranslationQAResult,
  TranslationQAFinding,
  LocaleQAStatus,
  ScanProvenance,
} from '@/types/localization-pipeline';

/* ---- Stable empty constants (Zustand selector safety) ------------ */

const EMPTY_STRINGS: LocalizableString[] = [];
const EMPTY_HAZARDS: LocalizationHazard[] = [];
const EMPTY_ENTRIES: TranslationEntry[] = [];
const EMPTY_REVIEW: TranslationEntry[] = [];
const EMPTY_LOCALES: TargetLocale[] = [];
const EMPTY_TABLES: StringTable[] = [];
const EMPTY_REPLACEMENTS: LOCTEXTReplacementSuggestion[] = [];
const EMPTY_PROGRESS: Record<string, number> = {};
const EMPTY_EXPANSION: Record<string, number> = {};
const EMPTY_MODULE_BREAKDOWN: Record<string, { total: number; hardcoded: number; localized: number }> = {};
const EMPTY_QA_FINDINGS: TranslationQAFinding[] = [];
const EMPTY_QA_BY_LOCALE: Record<string, LocaleQAStatus> = {};

/**
 * The POST body every action sends. `projectPath` (the configured UE project) makes the
 * route scan `<projectPath>/Source` read-only; without it the route answers the demo corpus.
 */
function requestBody(action: string, config: LocalizationConfig, projectPath?: string): string {
  return JSON.stringify(projectPath ? { action, config, projectPath } : { action, config });
}

/* ---- State interface --------------------------------------------- */

interface LocalizationPipelineState {
  // Defaults
  config: LocalizationConfig | null;
  supportedLocales: TargetLocale[];

  // Scan results
  scanResult: ScanResult | null;
  /** What the last scan read: the project's Source/ or the labelled demo corpus. */
  scanProvenance: ScanProvenance | null;
  strings: LocalizableString[];
  hazards: LocalizationHazard[];
  moduleBreakdown: Record<string, { total: number; hardcoded: number; localized: number }>;

  // Translation results
  translationResult: TranslationResult | null;
  entries: TranslationEntry[];
  reviewRequired: TranslationEntry[];
  progress: Record<string, number>;
  expansionIssues: Record<string, number>;

  // Translation QA (validates the translated output)
  qaResult: TranslationQAResult | null;
  qaFindings: TranslationQAFinding[];
  qaByLocale: Record<string, LocaleQAStatus>;

  // Replacements & tables
  replacements: LOCTEXTReplacementSuggestion[];
  stringTables: StringTable[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDefaults: () => Promise<void>;
  runScan: (config?: LocalizationConfig, projectPath?: string) => Promise<ScanResult | null>;
  runTranslation: (config?: LocalizationConfig, projectPath?: string) => Promise<TranslationResult | null>;
  runFullPipeline: (config?: LocalizationConfig, projectPath?: string) => Promise<void>;
  updateConfig: (partial: Partial<LocalizationConfig>) => void;
}

/* ---- Store ------------------------------------------------------- */

export const useLocalizationPipelineStore = create<LocalizationPipelineState>((set, get) => ({
  // Defaults
  config: null,
  supportedLocales: EMPTY_LOCALES,

  // Scan
  scanResult: null,
  scanProvenance: null,
  strings: EMPTY_STRINGS,
  hazards: EMPTY_HAZARDS,
  moduleBreakdown: EMPTY_MODULE_BREAKDOWN,

  // Translation
  translationResult: null,
  entries: EMPTY_ENTRIES,
  reviewRequired: EMPTY_REVIEW,
  progress: EMPTY_PROGRESS,
  expansionIssues: EMPTY_EXPANSION,

  // Translation QA
  qaResult: null,
  qaFindings: EMPTY_QA_FINDINGS,
  qaByLocale: EMPTY_QA_BY_LOCALE,

  // Replacements
  replacements: EMPTY_REPLACEMENTS,
  stringTables: EMPTY_TABLES,

  // UI
  isLoading: false,
  error: null,

  /* ---- Fetch defaults -------------------------------------------- */
  fetchDefaults: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{
        config: LocalizationConfig;
        supportedLocales: TargetLocale[];
      }>('/api/localization-pipeline');
      set({
        config: data.config,
        supportedLocales: data.supportedLocales,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  /* ---- Run scan -------------------------------------------------- */
  runScan: async (configOverride, projectPath) => {
    const config = configOverride ?? get().config;
    if (!config) return null;

    set({ isLoading: true, error: null });
    try {
      const { provenance, ...result } = await apiFetch<ScanResult & { provenance: ScanProvenance }>('/api/localization-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody('scan', config, projectPath),
      });
      set({
        scanResult: result,
        scanProvenance: provenance,
        strings: result.strings,
        hazards: result.hazards,
        moduleBreakdown: result.moduleBreakdown,
        isLoading: false,
      });
      return result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
      return null;
    }
  },

  /* ---- Run translation ------------------------------------------- */
  runTranslation: async (configOverride, projectPath) => {
    const config = configOverride ?? get().config;
    if (!config) return null;

    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{
        translation: TranslationResult;
        progress: Record<string, number>;
        qa: TranslationQAResult;
      }>('/api/localization-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody('translate', config, projectPath),
      });
      set({
        translationResult: data.translation,
        entries: data.translation.entries,
        reviewRequired: data.translation.reviewRequired,
        progress: data.progress,
        expansionIssues: data.translation.expansionIssues,
        qaResult: data.qa,
        qaFindings: data.qa.findings,
        qaByLocale: data.qa.byLocale,
        isLoading: false,
      });
      return data.translation;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
      return null;
    }
  },

  /* ---- Run full pipeline ----------------------------------------- */
  runFullPipeline: async (configOverride, projectPath) => {
    const config = configOverride ?? get().config;
    if (!config) return;

    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{
        scan: ScanResult;
        provenance: ScanProvenance;
        replacements: LOCTEXTReplacementSuggestion[];
        tables: StringTable[];
        translation: TranslationResult;
        progress: Record<string, number>;
        qa: TranslationQAResult;
      }>('/api/localization-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody('full-pipeline', config, projectPath),
      });
      set({
        scanResult: data.scan,
        scanProvenance: data.provenance,
        strings: data.scan.strings,
        hazards: data.scan.hazards,
        moduleBreakdown: data.scan.moduleBreakdown,
        replacements: data.replacements,
        stringTables: data.tables,
        translationResult: data.translation,
        entries: data.translation.entries,
        reviewRequired: data.translation.reviewRequired,
        progress: data.progress,
        expansionIssues: data.translation.expansionIssues,
        qaResult: data.qa,
        qaFindings: data.qa.findings,
        qaByLocale: data.qa.byLocale,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  /* ---- Update config --------------------------------------------- */
  updateConfig: (partial) => {
    const current = get().config;
    if (current) {
      set({ config: { ...current, ...partial } });
    }
  },
}));
