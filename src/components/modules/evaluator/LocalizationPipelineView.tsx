'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Globe, Play, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Search, Copy, Check,
  Languages, ShieldAlert, ShieldCheck, BookOpen, Table2, RefreshCw,
  ArrowRight, ArrowLeft, XCircle, Info, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import type {
  LocalizableString,
  LocalizationHazard,
  LOCTEXTReplacementSuggestion,
  TranslationEntry,
  StringContext,
  HazardSeverity,
  TranslationStatus,
  StringTable,
  TranslationQAFinding,
  LocaleQAStatus,
} from '@/types/localization-pipeline';
import { CONTEXT_LABELS, SUPPORTED_LOCALES, LOW_CONFIDENCE, REVIEW_GATE, QA_CHECKS } from '@/lib/localization/definitions';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD, ACCENT_INDIGO, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, SEVERITY_TOKENS } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { FOCUS_RING_CLASS, focusRingStyle } from '@/lib/ui/focus-ring';

// ── Constants ───────────────────────────────────────────────────────────────

// Type scale — three tiers give this dense localization data a scannable
// hierarchy instead of a flat wall of muted text-2xs. Sizes compose the app-wide
// TEXT_SCALE floor (text-xs) so the view never dips below the readable minimum;
// this layer adds the weight + text tone that separates a section title from
// primary content from dense metadata.
const SCALE = {
  /** Card / section heading — anchors each panel (text-sm sits above the floor). */
  title: 'text-sm font-semibold text-text',
  /** Primary content — strings, translations, finding labels. */
  body: `${TEXT_SCALE.body} text-text`,
  /** Dense metadata — counts, paths, locale codes, units. */
  meta: `${TEXT_SCALE.meta} text-text-muted`,
} as const;

// Hazard severity and translation status colors are routed through SEVERITY_TOKENS
// (chart-colors) so they share one theme-aware source with the rest of the
// evaluator instead of drifting Tailwind palette classes. `HazardSeverity`
// (critical/warning/info) maps directly onto the matching token keys; the Badge
// variant is the only piece SEVERITY_TOKENS doesn't carry, so it stays a small map.
const SEVERITY_BADGE: Record<HazardSeverity, 'error' | 'warning' | 'default'> = {
  critical: 'error',
  warning:  'warning',
  info:     'default',
};

// Translation status → solid token color + label. `pending` has no severity
// (it's the "not started" neutral), so it keeps the theme-aware muted text var.
const STATUS_STYLE: Record<TranslationStatus, { color: string; label: string }> = {
  pending:      { color: 'var(--text-muted)',           label: 'Pending' },
  translated:   { color: SEVERITY_TOKENS.positive.color, label: 'Translated' },
  reviewed:     { color: SEVERITY_TOKENS.info.color,     label: 'Reviewed' },
  approved:     { color: SEVERITY_TOKENS.positive.color, label: 'Approved' },
  needs_review: { color: SEVERITY_TOKENS.warning.color,  label: 'Needs Review' },
};

type ViewTab = 'overview' | 'strings' | 'translations' | 'hazards' | 'qa' | 'tables';

type StringPreset = 'hardcoded' | 'low-confidence' | 'missing-translations' | 'critical-hazards';

const STRING_PRESET_LABELS: Record<StringPreset, string> = {
  'hardcoded': 'Hardcoded Only',
  'low-confidence': 'Low Confidence',
  'missing-translations': 'Missing Translations',
  'critical-hazards': 'Critical Hazards',
};

type TranslationPreset = 'low-confidence' | 'needs-review' | 'qa-failures' | 'missing-translations' | 'expansion-warnings';

const TRANSLATION_PRESET_LABELS: Record<TranslationPreset, string> = {
  'low-confidence': 'Low Confidence',
  'needs-review': 'Needs Review',
  'qa-failures': 'QA',
  'missing-translations': 'Missing Translations',
  'expansion-warnings': 'Expansion Warnings',
};

// ── Main Component ──────────────────────────────────────────────────────────

export function LocalizationPipelineView() {
  const config = useLocalizationPipelineStore((s) => s.config);
  const scanResult = useLocalizationPipelineStore((s) => s.scanResult);
  const strings = useLocalizationPipelineStore((s) => s.strings);
  const hazards = useLocalizationPipelineStore((s) => s.hazards);
  const entries = useLocalizationPipelineStore((s) => s.entries);
  const reviewRequired = useLocalizationPipelineStore((s) => s.reviewRequired);
  const progress = useLocalizationPipelineStore((s) => s.progress);
  const expansionIssues = useLocalizationPipelineStore((s) => s.expansionIssues);
  const qaFindings = useLocalizationPipelineStore((s) => s.qaFindings);
  const qaByLocale = useLocalizationPipelineStore((s) => s.qaByLocale);
  const replacements = useLocalizationPipelineStore((s) => s.replacements);
  const stringTables = useLocalizationPipelineStore((s) => s.stringTables);
  const isLoading = useLocalizationPipelineStore((s) => s.isLoading);
  const error = useLocalizationPipelineStore((s) => s.error);
  const fetchDefaults = useLocalizationPipelineStore((s) => s.fetchDefaults);
  const runFullPipeline = useLocalizationPipelineStore((s) => s.runFullPipeline);

  const [viewTab, setViewTab] = useState<ViewTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextFilter, setContextFilter] = useState<StringContext | 'all'>('all');
  const [localeFilter, setLocaleFilter] = useState<string>('all');
  const [stringPresets, setStringPresets] = useState<Set<StringPreset>>(new Set());
  const [translationPresets, setTranslationPresets] = useState<Set<TranslationPreset>>(new Set());

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const handleRunPipeline = useCallback(async () => {
    await runFullPipeline();
  }, [runFullPipeline]);

  // Hazard string IDs for preset filtering
  const criticalHazardStringIds = useMemo(() => {
    const ids = new Set<string>();
    for (const h of hazards) {
      if (h.severity === 'critical') ids.add(h.location.filePath + ':' + h.location.lineNumber);
    }
    return ids;
  }, [hazards]);

  // Lookup map (stringId -> string) so per-row source resolution is O(1) instead
  // of an O(n) `strings.find` per Translations row (avoids O(strings × entries)).
  const stringsById = useMemo(() => {
    const map = new Map<string, (typeof strings)[number]>();
    for (const s of strings) map.set(s.id, s);
    return map;
  }, [strings]);

  // Set of string IDs that have translations
  const translatedStringIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) {
      if (e.status !== 'pending') ids.add(e.stringId);
    }
    return ids;
  }, [entries]);

  // Keys (`stringId:locale`) of entries with at least one QA finding — powers the
  // "QA" preset chip on the Translations tab.
  const qaFailedEntryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of qaFindings) keys.add(`${f.stringId}:${f.locale}`);
    return keys;
  }, [qaFindings]);

  // Filtered strings
  const filteredStrings = useMemo(() => {
    let result = strings;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) => s.sourceText.toLowerCase().includes(q) || s.locKey.toLowerCase().includes(q),
      );
    }
    if (contextFilter !== 'all') {
      result = result.filter((s) => s.context === contextFilter);
    }
    if (stringPresets.has('hardcoded')) {
      result = result.filter((s) => s.currentUsage === 'hardcoded');
    }
    if (stringPresets.has('low-confidence')) {
      result = result.filter((s) => s.detectionConfidence < LOW_CONFIDENCE);
    }
    if (stringPresets.has('missing-translations')) {
      result = result.filter((s) => !translatedStringIds.has(s.id));
    }
    if (stringPresets.has('critical-hazards')) {
      result = result.filter((s) =>
        s.locations.some((loc) => criticalHazardStringIds.has(loc.filePath + ':' + loc.lineNumber)),
      );
    }
    return result;
  }, [strings, searchQuery, contextFilter, stringPresets, translatedStringIds, criticalHazardStringIds]);

  // Filtered translations
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (localeFilter !== 'all') {
      result = result.filter((e) => e.locale === localeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchIds = new Set(strings.filter((s) => s.sourceText.toLowerCase().includes(q)).map((s) => s.id));
      result = result.filter((e) => matchIds.has(e.stringId));
    }
    if (translationPresets.has('low-confidence')) {
      result = result.filter((e) => e.confidence < LOW_CONFIDENCE);
    }
    if (translationPresets.has('needs-review')) {
      result = result.filter((e) => e.status === 'needs_review');
    }
    if (translationPresets.has('qa-failures')) {
      result = result.filter((e) => qaFailedEntryKeys.has(`${e.stringId}:${e.locale}`));
    }
    if (translationPresets.has('missing-translations')) {
      result = result.filter((e) => e.status === 'pending');
    }
    if (translationPresets.has('expansion-warnings')) {
      result = result.filter((e) => e.expansionWarning);
    }
    return result;
  }, [entries, localeFilter, searchQuery, strings, translationPresets, qaFailedEntryKeys]);

  // Summary stats
  const totalStrings = scanResult?.totalStringsFound ?? 0;
  const hardcoded = scanResult?.hardcodedCount ?? 0;
  const ftextCount = scanResult?.ftextFromStringCount ?? 0;
  const localizedCount = scanResult?.alreadyLocalizedCount ?? 0;
  const locReadiness = totalStrings > 0 ? Math.round((localizedCount / totalStrings) * 100) : 0;
  const criticalHazards = hazards.filter((h) => h.severity === 'critical').length;

  // Average translation progress
  const progressValues = Object.values(progress);
  const avgProgress = progressValues.length > 0
    ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
    : 0;

  return (
    <div className="space-y-6" style={focusRingStyle(ACCENT_INDIGO)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">Localization Pipeline</h2>
            <p className={`${TEXT_SCALE.body} text-text-muted mt-0.5`}>
              Scan for hardcoded strings, generate LOCTEXT macros, and produce context-aware translations
            </p>
          </div>
        </div>
        <button
          onClick={handleRunPipeline}
          disabled={isLoading || !config}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-40"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {isLoading ? 'Running...' : 'Run Full Pipeline'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <SurfaceCard level={2}>
          <div className="flex items-center gap-2" style={{ color: SEVERITY_TOKENS.critical.color }}>
            <XCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        </SurfaceCard>
      )}

      {/* Stats bar */}
      {scanResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <MiniStat label="Total Strings" value={totalStrings} />
          <MiniStat label="Hardcoded" value={hardcoded + ftextCount} accentColor={STATUS_ERROR} />
          <MiniStat label="Localized" value={localizedCount} accentColor={ACCENT_EMERALD} />
          <MiniStat label="Hazards" value={hazards.length} accentColor={criticalHazards > 0 ? STATUS_WARNING : undefined} />
          <MiniStat label="Locales" value={config?.targetLocales.length ?? 0} />
          <MiniStat label="Translation" value={`${avgProgress}%`} accentColor={ACCENT_INDIGO} />
        </div>
      )}

      {/* Sub-tab navigation */}
      {scanResult && (
        <div role="tablist" aria-label="Localization views" className="flex items-center gap-1 border-b border-border">
          <SubTab label="Overview" active={viewTab === 'overview'} onClick={() => setViewTab('overview')} />
          <SubTab label="Strings" active={viewTab === 'strings'} onClick={() => setViewTab('strings')} count={totalStrings} />
          <SubTab label="Translations" active={viewTab === 'translations'} onClick={() => setViewTab('translations')} count={entries.length} />
          <SubTab label="Hazards" active={viewTab === 'hazards'} onClick={() => setViewTab('hazards')} count={hazards.length} />
          <SubTab label="QA" active={viewTab === 'qa'} onClick={() => setViewTab('qa')} count={qaFindings.length} />
          <SubTab label="String Tables" active={viewTab === 'tables'} onClick={() => setViewTab('tables')} count={stringTables.length} />
        </div>
      )}

      {/* Empty state */}
      {!scanResult && !isLoading && (
        <SurfaceCard>
          <div className="text-center py-10">
            <Globe className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-text-muted mb-1">No scan results yet</p>
            <p className={`${TEXT_SCALE.body} text-text-muted`}>
              Click &quot;Run Full Pipeline&quot; to scan your generated code for hardcoded strings,
              detect localization hazards, and generate translations.
            </p>
          </div>
        </SurfaceCard>
      )}

      {/* Loading */}
      {isLoading && !scanResult && (
        <SurfaceCard>
          <div className="text-center py-10">
            <RefreshCw className="w-8 h-8 text-indigo-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-text-muted">Running localization pipeline...</p>
          </div>
        </SurfaceCard>
      )}

      {/* ── Overview Tab ─────────────────────────────────────────────── */}
      {scanResult && viewTab === 'overview' && (
        <div className="space-y-4">
          {/* Readiness gauge */}
          <SurfaceCard>
            <div className="flex items-center gap-6">
              <ProgressRing value={locReadiness} size={72} strokeWidth={6} color={ACCENT_INDIGO} />
              <div>
                <p className={SCALE.title}>Localization Readiness</p>
                <p className={`${TEXT_SCALE.body} text-text-muted mt-0.5`}>
                  {localizedCount} of {totalStrings} strings use NSLOCTEXT/LOCTEXT macros
                </p>
                {hardcoded > 0 && (
                  <p className={`${TEXT_SCALE.meta} mt-1`} style={{ color: STATUS_ERROR }}>
                    {hardcoded} hardcoded + {ftextCount} FText::FromString need conversion
                  </p>
                )}
              </div>
            </div>
          </SurfaceCard>

          {/* Translation progress per locale */}
          {Object.keys(progress).length > 0 && (
            <SurfaceCard>
              <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
                <Languages className="w-3.5 h-3.5 text-indigo-400" />
                Translation Progress by Locale
              </h3>
              <div className="space-y-2">
                {Object.entries(progress).map(([locale, pct]) => {
                  const locInfo = SUPPORTED_LOCALES.find((l) => l.code === locale);
                  const expIssues = expansionIssues[locale] ?? 0;
                  return (
                    <div key={locale} className="flex items-center gap-3">
                      <span className="text-2xs text-text-muted w-24 shrink-0">
                        {locInfo?.nativeName ?? locale}
                      </span>
                      <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${locInfo?.nativeName ?? locale} translation progress`}
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? ACCENT_EMERALD : pct >= 50 ? STATUS_WARNING : STATUS_ERROR }}
                        />
                      </div>
                      <span className="text-2xs text-text-muted w-10 text-right">{pct}%</span>
                      {expIssues > 0 && (
                        <Badge variant="warning">{expIssues} exp</Badge>
                      )}
                      {qaByLocale[locale] && <ReadyToShipBadge status={qaByLocale[locale]} />}
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          )}

          {/* Expansion factor comparison */}
          <SurfaceCard>
            <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              Text Expansion by Locale
            </h3>
            <p className={`${TEXT_SCALE.body} text-text-muted mb-3`}>
              How much longer (or shorter) translated text is compared to English. Higher values risk UI overflow.
            </p>
            <ExpansionFactorBars />
          </SurfaceCard>

          {/* Module breakdown */}
          <SurfaceCard>
            <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Module Breakdown
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(scanResult.moduleBreakdown).map(([mod, data]) => (
                <div key={mod} className="rounded-lg border border-border p-2.5">
                  <p className={`${TEXT_SCALE.meta} font-medium text-text truncate`}>{mod}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={SCALE.meta}>{data.total} strings</span>
                    {data.hardcoded > 0 && (
                      <span className={TEXT_SCALE.meta} style={{ color: STATUS_ERROR }}>{data.hardcoded} hardcoded</span>
                    )}
                    {data.localized > 0 && (
                      <span className={TEXT_SCALE.meta} style={{ color: ACCENT_EMERALD }}>{data.localized} loc</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {/* LOCTEXT replacements preview */}
          {replacements.length > 0 && (
            <SurfaceCard>
              <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                LOCTEXT Replacement Suggestions ({replacements.length})
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {replacements.slice(0, 10).map((r) => (
                  <ReplacementCard key={r.stringId} replacement={r} />
                ))}
                {replacements.length > 10 && (
                  <p className="text-2xs text-text-muted text-center py-1">
                    +{replacements.length - 10} more — switch to Strings tab for full list
                  </p>
                )}
              </div>
            </SurfaceCard>
          )}
        </div>
      )}

      {/* ── Strings Tab ──────────────────────────────────────────────── */}
      {scanResult && viewTab === 'strings' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <label htmlFor="loc-strings-search" className="sr-only">Search strings by source text or key</label>
              <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                id="loc-strings-search"
                type="text"
                placeholder="Search strings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
              {(searchQuery || stringPresets.size > 0 || contextFilter !== 'all') && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-indigo-400 font-medium tabular-nums pointer-events-none">
                  {filteredStrings.length} of {strings.length}
                </span>
              )}
            </div>
            <label htmlFor="loc-strings-context" className="sr-only">Filter strings by context</label>
            <select
              id="loc-strings-context"
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value as StringContext | 'all')}
              className="px-2 py-1.5 rounded-md border border-border bg-surface text-xs text-text focus:outline-none"
            >
              <option value="all">All Contexts</option>
              <optgroup label="Gameplay">
                <option value="ability_name">{CONTEXT_LABELS.ability_name}</option>
                <option value="ability_description">{CONTEXT_LABELS.ability_description}</option>
                <option value="item_name">{CONTEXT_LABELS.item_name}</option>
                <option value="item_tooltip">{CONTEXT_LABELS.item_tooltip}</option>
                <option value="stat_label">{CONTEXT_LABELS.stat_label}</option>
              </optgroup>
              <optgroup label="UI">
                <option value="ui_label">{CONTEXT_LABELS.ui_label}</option>
                <option value="ui_button">{CONTEXT_LABELS.ui_button}</option>
                <option value="menu_title">{CONTEXT_LABELS.menu_title}</option>
                <option value="notification">{CONTEXT_LABELS.notification}</option>
              </optgroup>
              <optgroup label="Narrative">
                <option value="quest_title">{CONTEXT_LABELS.quest_title}</option>
                <option value="quest_description">{CONTEXT_LABELS.quest_description}</option>
                <option value="dialogue_line">{CONTEXT_LABELS.dialogue_line}</option>
                <option value="tutorial">{CONTEXT_LABELS.tutorial}</option>
              </optgroup>
              <optgroup label="Other">
                <option value="unknown">{CONTEXT_LABELS.unknown}</option>
              </optgroup>
            </select>
          </div>

          {/* Preset filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(STRING_PRESET_LABELS) as StringPreset[]).map((preset) => (
              <PresetChip
                key={preset}
                label={STRING_PRESET_LABELS[preset]}
                active={stringPresets.has(preset)}
                onClick={() => {
                  setStringPresets((prev) => {
                    const next = new Set(prev);
                    if (next.has(preset)) next.delete(preset);
                    else next.add(preset);
                    return next;
                  });
                }}
              />
            ))}
          </div>

          <p className="text-2xs text-text-muted">{filteredStrings.length} strings</p>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filteredStrings.map((s) => (
              <StringCard key={s.id} str={s} />
            ))}
          </div>
        </div>
      )}

      {/* ── Translations Tab ─────────────────────────────────────────── */}
      {scanResult && viewTab === 'translations' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <label htmlFor="loc-translations-search" className="sr-only">Search translations by source text</label>
              <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                id="loc-translations-search"
                type="text"
                placeholder="Search source text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
              {(searchQuery || translationPresets.size > 0 || localeFilter !== 'all') && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-indigo-400 font-medium tabular-nums pointer-events-none">
                  {filteredEntries.length} of {entries.length}
                </span>
              )}
            </div>
            <label htmlFor="loc-translations-locale" className="sr-only">Filter translations by locale</label>
            <select
              id="loc-translations-locale"
              value={localeFilter}
              onChange={(e) => setLocaleFilter(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-surface text-xs text-text focus:outline-none"
            >
              <option value="all">All Locales</option>
              {(config?.targetLocales ?? []).map((code) => {
                const loc = SUPPORTED_LOCALES.find((l) => l.code === code);
                return <option key={code} value={code}>{loc?.name ?? code}</option>;
              })}
            </select>
          </div>

          {/* Preset filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(TRANSLATION_PRESET_LABELS) as TranslationPreset[]).map((preset) => (
              <PresetChip
                key={preset}
                label={TRANSLATION_PRESET_LABELS[preset]}
                active={translationPresets.has(preset)}
                onClick={() => {
                  setTranslationPresets((prev) => {
                    const next = new Set(prev);
                    if (next.has(preset)) next.delete(preset);
                    else next.add(preset);
                    return next;
                  });
                }}
              />
            ))}
          </div>

          {/* Quality score */}
          {entries.length > 0 && (
            <div className="flex items-center gap-4">
              <Badge variant={reviewRequired.length === 0 ? 'success' : 'warning'}>
                {reviewRequired.length} need review
              </Badge>
              <span className="text-2xs text-text-muted">{filteredEntries.length} translations shown</span>
            </div>
          )}

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filteredEntries.map((e, i) => {
              const source = stringsById.get(e.stringId);
              return (
                <TranslationCard key={`${e.stringId}-${e.locale}-${i}`} entry={e} sourceText={source?.sourceText ?? '?'} />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hazards Tab ──────────────────────────────────────────────── */}
      {scanResult && viewTab === 'hazards' && (
        <div className="space-y-4">
          {hazards.length === 0 ? (
            <SurfaceCard>
              <div className="text-center py-10">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: ACCENT_EMERALD }} />
                <p className="text-sm text-text">No localization hazards detected</p>
              </div>
            </SurfaceCard>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="error">{hazards.filter((h) => h.severity === 'critical').length} critical</Badge>
                <Badge variant="warning">{hazards.filter((h) => h.severity === 'warning').length} warnings</Badge>
                <Badge variant="default">{hazards.filter((h) => h.severity === 'info').length} info</Badge>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {hazards.map((h) => (
                  <HazardCard key={h.id} hazard={h} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QA Tab ───────────────────────────────────────────────────── */}
      {scanResult && viewTab === 'qa' && (
        <QATab
          findings={qaFindings}
          byLocale={qaByLocale}
          targetLocales={config?.targetLocales ?? []}
          hasTranslations={entries.length > 0}
        />
      )}

      {/* ── String Tables Tab ────────────────────────────────────────── */}
      {scanResult && viewTab === 'tables' && (
        <div className="space-y-4">
          {stringTables.length === 0 ? (
            <SurfaceCard>
              <div className="text-center py-10">
                <Table2 className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
                <p className="text-sm text-text-muted">No string tables generated</p>
              </div>
            </SurfaceCard>
          ) : (
            stringTables.map((table) => (
              <StringTableCard key={table.tableId} table={table} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SubTab({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative rounded-t ${FOCUS_RING_CLASS} ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-2xs font-semibold tabular-nums transition-colors ${
            active
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'bg-surface-2 text-text-muted'
          }`}
        >
          {count}
        </span>
      )}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-400" />}
    </button>
  );
}

function PresetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-medium transition-colors ${
        active
          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
          : 'bg-surface-2 text-text-muted border border-transparent hover:bg-surface hover:text-text'
      }`}
    >
      {label}
      {active && <X className="w-3 h-3" />}
    </button>
  );
}

function MiniStat({ label, value, accentColor }: { label: string; value: number | string; accentColor?: string }) {
  return (
    <SurfaceCard level={2} className="min-w-0">
      <p className={`${SCALE.meta} truncate`}>{label}</p>
      <p
        className={`text-lg font-bold truncate ${accentColor ? '' : 'text-text'}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </p>
    </SurfaceCard>
  );
}

function StringCard({ str }: { str: LocalizableString }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `loc-string-${str.id}`;

  return (
    <SurfaceCard level={2}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`flex items-start gap-2 w-full text-left rounded-md ${FOCUS_RING_CLASS}`}
      >
        {expanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`${SCALE.body} font-medium truncate`}>&quot;{str.sourceText}&quot;</span>
            <Badge variant={str.currentUsage === 'nsloctext' || str.currentUsage === 'loctext' ? 'success' : str.currentUsage === 'hardcoded' ? 'error' : 'warning'}>
              {str.currentUsage}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xs text-text-muted">{CONTEXT_LABELS[str.context]}</span>
            <span className="text-2xs text-text-muted">·</span>
            <span className="text-2xs text-text-muted">{str.sourceModule}</span>
            <span className="text-2xs text-text-muted">·</span>
            <span className="text-2xs text-text-muted">{str.locNamespace}/{str.locKey}</span>
          </div>
        </div>
        <span className="text-2xs text-text-muted shrink-0">{Math.round(str.detectionConfidence * 100)}%</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-border">
              {str.locations.map((loc, i) => (
                <div key={i} className="text-2xs">
                  <span className="text-text-muted">{loc.filePath}:{loc.lineNumber}</span>
                  <pre className="mt-1 p-2 rounded bg-surface text-text-muted overflow-x-auto text-xs leading-relaxed">
                    {loc.codeSnippet}
                  </pre>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

function TranslationCard({ entry, sourceText }: { entry: TranslationEntry; sourceText: string }) {
  const locInfo = SUPPORTED_LOCALES.find((l) => l.code === entry.locale);
  const style = STATUS_STYLE[entry.status];
  const targetDir = locInfo?.direction ?? 'ltr';
  const isRtl = targetDir === 'rtl';
  const DirectionArrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <SurfaceCard level={2}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-medium text-text-muted">{locInfo?.nativeName ?? entry.locale}</span>
            <span className="text-2xs" style={{ color: style.color }}>{style.label}</span>
            {entry.expansionWarning && (
              <Badge variant="warning">expansion</Badge>
            )}
          </div>
          <p dir="ltr" className="text-xs text-text-muted mt-0.5">&quot;{sourceText}&quot;</p>
          <p
            dir={targetDir}
            lang={entry.locale}
            className="text-xs text-text font-medium mt-0.5 flex items-center gap-1"
          >
            <DirectionArrow className="w-3 h-3 shrink-0 text-text-muted" aria-hidden="true" />
            <span>&quot;{entry.translatedText}&quot;</span>
          </p>
          {locInfo && locInfo.expansionFactor !== 1.0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden max-w-[120px]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min((locInfo.expansionFactor / 1.5) * 100, 100)}%`,
                    backgroundColor: expansionColor(locInfo.expansionFactor),
                  }}
                />
              </div>
              <span className="text-2xs text-text-muted">{formatExpansion(locInfo.expansionFactor)}</span>
            </div>
          )}
          {entry.translatorNotes && (
            <p className="text-2xs text-text-muted mt-1 italic">{entry.translatorNotes}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ProgressRing value={Math.round(entry.confidence * 100)} size={28} strokeWidth={3} color={entry.confidence >= REVIEW_GATE ? ACCENT_EMERALD : STATUS_WARNING} />
        </div>
      </div>
      {entry.charDelta !== 0 && (
        <p className="text-2xs text-text-muted mt-1">
          {entry.charDelta > 0 ? '+' : ''}{entry.charDelta} chars vs source
        </p>
      )}
    </SurfaceCard>
  );
}

function HazardCard({ hazard }: { hazard: LocalizationHazard }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = SEVERITY_TOKENS[hazard.severity];
  const panelId = `loc-hazard-${hazard.id}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(hazard.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [hazard.fixPrompt]);

  return (
    <SurfaceCard level={2}>
      <div className="rounded-md border p-3" style={{ backgroundColor: token.bg, borderColor: token.border }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`flex items-start gap-2 w-full text-left rounded ${FOCUS_RING_CLASS}`}
        >
          {hazard.severity === 'critical' ? (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : hazard.severity === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`${SCALE.body} font-medium`}>{hazard.type.replace(/_/g, ' ')}</span>
              <Badge variant={SEVERITY_BADGE[hazard.severity]}>{hazard.severity}</Badge>
            </div>
            <p className="text-2xs text-text-muted mt-0.5">{hazard.description}</p>
          </div>
          {expanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              id={panelId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Suggestion:</p>
                  <p className="text-2xs text-text-muted">{hazard.suggestion}</p>
                </div>
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Location:</p>
                  <p className="text-2xs text-text-muted">{hazard.location.filePath}:{hazard.location.lineNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy fix prompt'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SurfaceCard>
  );
}

/* ── Translation QA ─────────────────────────────────────────────────────── */

/**
 * Per-locale "ready to ship" gate. Green only when the locale has translations
 * and zero blocking (critical/warning) QA findings; amber with a fix count
 * otherwise. Mirrors the memoQ/Lokalise "clean QA run" ship gate.
 */
function ReadyToShipBadge({ status }: { status: LocaleQAStatus }) {
  if (status.totalEntries === 0) {
    return <Badge variant="default">no data</Badge>;
  }
  if (status.readyToShip) {
    return (
      <Badge variant="success">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck aria-hidden="true" className="w-3 h-3" />
          ready to ship
        </span>
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      {status.blockingCount} to fix
    </Badge>
  );
}

function QATab({
  findings,
  byLocale,
  targetLocales,
  hasTranslations,
}: {
  findings: TranslationQAFinding[];
  byLocale: Record<string, LocaleQAStatus>;
  targetLocales: string[];
  hasTranslations: boolean;
}) {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  if (!hasTranslations) {
    return (
      <SurfaceCard>
        <div className="text-center py-10">
          <ShieldCheck className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
          <p className="text-sm text-text-muted mb-1">No translations to validate yet</p>
          <p className={`${TEXT_SCALE.body} text-text-muted`}>
            Run the pipeline to translate strings — QA then checks each result for dropped
            placeholders, number drift, untranslated segments, and glossary compliance.
          </p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Per-locale ready-to-ship gate */}
      <SurfaceCard>
        <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Ready to Ship by Locale
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {targetLocales.map((code) => {
            const status = byLocale[code];
            const locInfo = SUPPORTED_LOCALES.find((l) => l.code === code);
            return (
              <div key={code} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <span className="text-2xs font-medium text-text truncate">{locInfo?.nativeName ?? code}</span>
                {status ? <ReadyToShipBadge status={status} /> : <Badge variant="default">no data</Badge>}
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Findings */}
      {findings.length === 0 ? (
        <SurfaceCard>
          <div className="text-center py-10">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: ACCENT_EMERALD }} />
            <p className="text-sm text-text">All translations passed QA</p>
            <p className="text-2xs text-text-muted mt-1">Every locale is clear to ship.</p>
          </div>
        </SurfaceCard>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="error">{criticalCount} critical</Badge>
            <Badge variant="warning">{warningCount} warnings</Badge>
            <Badge variant="default">{infoCount} info</Badge>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {findings.map((f) => (
              <QAFindingCard key={f.id} finding={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QAFindingCard({ finding }: { finding: TranslationQAFinding }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = SEVERITY_TOKENS[finding.severity];
  const meta = QA_CHECKS[finding.check];
  const locInfo = SUPPORTED_LOCALES.find((l) => l.code === finding.locale);
  const panelId = `loc-qa-${finding.id}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finding.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [finding.fixPrompt]);

  return (
    <SurfaceCard level={2}>
      <div className="rounded-md border p-3" style={{ backgroundColor: token.bg, borderColor: token.border }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`flex items-start gap-2 w-full text-left rounded ${FOCUS_RING_CLASS}`}
        >
          {finding.severity === 'critical' ? (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : finding.severity === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${SCALE.body} font-medium`}>{meta.label}</span>
              <Badge variant={SEVERITY_BADGE[finding.severity]}>{finding.severity}</Badge>
              <span className="text-2xs text-text-muted">{locInfo?.nativeName ?? finding.locale}</span>
            </div>
            <p className="text-2xs text-text-muted mt-0.5">{finding.message}</p>
          </div>
          {expanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              id={panelId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Source:</p>
                  <p dir="ltr" className="text-2xs text-text-muted">&quot;{finding.sourceText}&quot;</p>
                </div>
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Translation:</p>
                  <p dir={locInfo?.direction ?? 'ltr'} lang={finding.locale} className="text-2xs text-text-muted">
                    &quot;{finding.translatedText}&quot;
                  </p>
                </div>
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Suggestion:</p>
                  <p className="text-2xs text-text-muted">{finding.suggestion}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy fix prompt'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SurfaceCard>
  );
}

function ReplacementCard({ replacement }: { replacement: LOCTEXTReplacementSuggestion }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(replacement.suggestedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [replacement.suggestedCode]);

  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <ArrowRight className="w-3 h-3 text-indigo-400" />
        <span className={`${TEXT_SCALE.meta} font-medium text-text`}>LOCTEXT Replacement</span>
      </div>
      <pre className="text-xs leading-relaxed p-1.5 rounded bg-status-red-subtle overflow-x-auto mb-1" style={{ color: STATUS_ERROR }}>
        - {replacement.originalCode}
      </pre>
      <pre className="text-xs leading-relaxed p-1.5 rounded bg-status-green-subtle overflow-x-auto mb-1" style={{ color: ACCENT_EMERALD }}>
        + {replacement.suggestedCode}
      </pre>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
      >
        {copied ? <Check className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied!' : 'Copy suggested'}
      </button>
    </div>
  );
}

/* ── Expansion helpers ──────────────────────────────────────────────────── */

const MAX_EXPANSION = Math.max(...SUPPORTED_LOCALES.map((l) => l.expansionFactor));

/** Returns a color from green (compact) → amber (neutral) → red (high expansion). */
function expansionColor(factor: number): string {
  if (factor <= 0.7) return ACCENT_EMERALD;
  if (factor <= 1.0) return STATUS_INFO;
  if (factor <= 1.2) return STATUS_WARNING;
  return STATUS_ERROR;
}

function formatExpansion(factor: number): string {
  if (factor === 1.0) return 'baseline';
  const pct = Math.round((factor - 1) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function ExpansionFactorBars() {
  const sorted = useMemo(
    () => [...SUPPORTED_LOCALES].sort((a, b) => b.expansionFactor - a.expansionFactor),
    [],
  );

  return (
    <div className="space-y-1.5">
      {sorted.map((loc) => {
        const widthPct = (loc.expansionFactor / MAX_EXPANSION) * 100;
        const color = expansionColor(loc.expansionFactor);
        return (
          <div key={loc.code} className="flex items-center gap-3">
            <span className="text-2xs text-text-muted w-20 shrink-0 truncate" title={loc.name}>
              {loc.nativeName}
            </span>
            <div className="flex-1 h-2.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="text-2xs font-medium w-12 text-right shrink-0"
              style={{ color }}
            >
              {formatExpansion(loc.expansionFactor)}
            </span>
            <span className="text-2xs text-text-muted w-8 text-right shrink-0">
              ×{loc.expansionFactor.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StringTableCard({ table }: { table: StringTable }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = `loc-table-${table.tableId}`;

  const csvContent = useMemo(() => {
    const header = 'Key,SourceString,Comment';
    const rows = table.rows.map((r) => `"${r.key}","${r.sourceString}","${r.comment}"`);
    return [header, ...rows].join('\n');
  }, [table]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [csvContent]);

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`flex items-center gap-2 flex-1 min-w-0 text-left rounded ${FOCUS_RING_CLASS}`}
        >
          <Table2 aria-hidden="true" className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-text truncate">{table.tableId}</p>
            <p className="text-2xs text-text-muted truncate">{table.namespace} — {table.rows.length} entries</p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs bg-surface-2 hover:bg-surface text-text-muted transition-colors"
          >
            {copied ? <Check className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy CSV'}
          </button>
          {expanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-2xs">
                  <thead>
                    <tr className="text-left text-text-muted">
                      <th className="pb-1.5 pr-4 font-medium">Key</th>
                      <th className="pb-1.5 pr-4 font-medium">Source String</th>
                      <th className="pb-1.5 font-medium">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.key} className="border-t border-border/50">
                        <td className="py-1 pr-4 text-text-muted font-mono">{row.key}</td>
                        <td className="py-1 pr-4 text-text">{row.sourceString}</td>
                        <td className="py-1 text-text-muted">{row.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
