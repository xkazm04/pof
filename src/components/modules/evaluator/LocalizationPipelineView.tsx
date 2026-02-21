'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Globe, Play, AlertTriangle, CheckCircle2, FileText,
  ChevronDown, ChevronRight, Search, Copy, Check,
  Languages, ShieldAlert, BookOpen, Table2, RefreshCw,
  ArrowRight, XCircle, Info, Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import type {
  LocalizableString,
  LocalizationHazard,
  TranslationEntry,
  StringContext,
  HazardSeverity,
  TranslationStatus,
  StringTable,
} from '@/types/localization-pipeline';
import { CONTEXT_LABELS, SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

const EMPTY_STRINGS: LocalizableString[] = [];
const EMPTY_HAZARDS: LocalizationHazard[] = [];
const EMPTY_ENTRIES: TranslationEntry[] = [];
const EMPTY_TABLES: StringTable[] = [];
const EMPTY_REPLACEMENTS: { stringId: string; originalCode: string; suggestedCode: string }[] = [];
const EMPTY_PROGRESS: Record<string, number> = {};

const SEVERITY_STYLE: Record<HazardSeverity, { bg: string; border: string; text: string; badge: 'error' | 'warning' | 'default' }> = {
  critical: { bg: 'bg-status-red-subtle', border: 'border-status-red-medium', text: 'text-red-400', badge: 'error' },
  warning:  { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'warning' },
  info:     { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'default' },
};

const STATUS_STYLE: Record<TranslationStatus, { color: string; label: string }> = {
  pending:      { color: 'text-text-muted', label: 'Pending' },
  translated:   { color: 'text-emerald-400', label: 'Translated' },
  reviewed:     { color: 'text-blue-400', label: 'Reviewed' },
  approved:     { color: 'text-green-400', label: 'Approved' },
  needs_review: { color: 'text-amber-400', label: 'Needs Review' },
};

type ViewTab = 'overview' | 'strings' | 'translations' | 'hazards' | 'tables';

// ── Main Component ──────────────────────────────────────────────────────────

export function LocalizationPipelineView() {
  const config = useLocalizationPipelineStore((s) => s.config);
  const supportedLocales = useLocalizationPipelineStore((s) => s.supportedLocales) ?? EMPTY_STRINGS;
  const scanResult = useLocalizationPipelineStore((s) => s.scanResult);
  const strings = useLocalizationPipelineStore((s) => s.strings) ?? EMPTY_STRINGS;
  const hazards = useLocalizationPipelineStore((s) => s.hazards) ?? EMPTY_HAZARDS;
  const entries = useLocalizationPipelineStore((s) => s.entries) ?? EMPTY_ENTRIES;
  const reviewRequired = useLocalizationPipelineStore((s) => s.reviewRequired) ?? EMPTY_ENTRIES;
  const progress = useLocalizationPipelineStore((s) => s.progress) ?? EMPTY_PROGRESS;
  const expansionIssues = useLocalizationPipelineStore((s) => s.expansionIssues) ?? EMPTY_PROGRESS;
  const replacements = useLocalizationPipelineStore((s) => s.replacements) ?? EMPTY_REPLACEMENTS;
  const stringTables = useLocalizationPipelineStore((s) => s.stringTables) ?? EMPTY_TABLES;
  const isLoading = useLocalizationPipelineStore((s) => s.isLoading);
  const error = useLocalizationPipelineStore((s) => s.error);
  const fetchDefaults = useLocalizationPipelineStore((s) => s.fetchDefaults);
  const runFullPipeline = useLocalizationPipelineStore((s) => s.runFullPipeline);

  const [viewTab, setViewTab] = useState<ViewTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextFilter, setContextFilter] = useState<StringContext | 'all'>('all');
  const [localeFilter, setLocaleFilter] = useState<string>('all');

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const handleRunPipeline = useCallback(async () => {
    await runFullPipeline();
  }, [runFullPipeline]);

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
    return result;
  }, [strings, searchQuery, contextFilter]);

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
    return result;
  }, [entries, localeFilter, searchQuery, strings]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">Localization Pipeline</h2>
            <p className="text-2xs text-text-muted mt-0.5">
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
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        </SurfaceCard>
      )}

      {/* Stats bar */}
      {scanResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <MiniStat label="Total Strings" value={totalStrings} />
          <MiniStat label="Hardcoded" value={hardcoded + ftextCount} accent="text-red-400" />
          <MiniStat label="Localized" value={localizedCount} accent="text-emerald-400" />
          <MiniStat label="Hazards" value={hazards.length} accent={criticalHazards > 0 ? 'text-amber-400' : undefined} />
          <MiniStat label="Locales" value={config?.targetLocales.length ?? 0} />
          <MiniStat label="Translation" value={`${avgProgress}%`} accent="text-indigo-400" />
        </div>
      )}

      {/* Sub-tab navigation */}
      {scanResult && (
        <div className="flex items-center gap-1 border-b border-border">
          <SubTab label="Overview" active={viewTab === 'overview'} onClick={() => setViewTab('overview')} />
          <SubTab label="Strings" active={viewTab === 'strings'} onClick={() => setViewTab('strings')} count={totalStrings} />
          <SubTab label="Translations" active={viewTab === 'translations'} onClick={() => setViewTab('translations')} count={entries.length} />
          <SubTab label="Hazards" active={viewTab === 'hazards'} onClick={() => setViewTab('hazards')} count={hazards.length} />
          <SubTab label="String Tables" active={viewTab === 'tables'} onClick={() => setViewTab('tables')} count={stringTables.length} />
        </div>
      )}

      {/* Empty state */}
      {!scanResult && !isLoading && (
        <SurfaceCard>
          <div className="text-center py-12">
            <Globe className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-text-muted mb-1">No scan results yet</p>
            <p className="text-2xs text-text-muted">
              Click &quot;Run Full Pipeline&quot; to scan your generated code for hardcoded strings,
              detect localization hazards, and generate translations.
            </p>
          </div>
        </SurfaceCard>
      )}

      {/* Loading */}
      {isLoading && !scanResult && (
        <SurfaceCard>
          <div className="text-center py-12">
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
              <ProgressRing value={locReadiness} size={72} strokeWidth={6} color="#818cf8" />
              <div>
                <p className="text-sm font-semibold text-text">Localization Readiness</p>
                <p className="text-2xs text-text-muted mt-0.5">
                  {localizedCount} of {totalStrings} strings use NSLOCTEXT/LOCTEXT macros
                </p>
                {hardcoded > 0 && (
                  <p className="text-2xs text-red-400 mt-1">
                    {hardcoded} hardcoded + {ftextCount} FText::FromString need conversion
                  </p>
                )}
              </div>
            </div>
          </SurfaceCard>

          {/* Translation progress per locale */}
          {Object.keys(progress).length > 0 && (
            <SurfaceCard>
              <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
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
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? ACCENT_EMERALD : pct >= 50 ? STATUS_WARNING : STATUS_ERROR }}
                        />
                      </div>
                      <span className="text-2xs text-text-muted w-10 text-right">{pct}%</span>
                      {expIssues > 0 && (
                        <Badge variant="warning">{expIssues} exp</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          )}

          {/* Module breakdown */}
          <SurfaceCard>
            <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Module Breakdown
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(scanResult.moduleBreakdown).map(([mod, data]) => (
                <div key={mod} className="rounded-lg border border-border p-2.5">
                  <p className="text-2xs font-medium text-text truncate">{mod}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xs text-text-muted">{data.total} strings</span>
                    {data.hardcoded > 0 && (
                      <span className="text-2xs text-red-400">{data.hardcoded} hardcoded</span>
                    )}
                    {data.localized > 0 && (
                      <span className="text-2xs text-emerald-400">{data.localized} loc</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {/* LOCTEXT replacements preview */}
          {replacements.length > 0 && (
            <SurfaceCard>
              <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
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
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search strings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            <select
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value as StringContext | 'all')}
              className="px-2 py-1.5 rounded-md border border-border bg-surface text-xs text-text focus:outline-none"
            >
              <option value="all">All Contexts</option>
              {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
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
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search source text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            <select
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
              const source = strings.find((s) => s.id === e.stringId);
              return (
                <TranslationCard key={`${e.stringId}-${e.locale}-${i}`} entry={e} sourceText={source?.sourceText ?? '?'} />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hazards Tab ──────────────────────────────────────────────── */}
      {scanResult && viewTab === 'hazards' && (
        <div className="space-y-3">
          {hazards.length === 0 ? (
            <SurfaceCard>
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
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

      {/* ── String Tables Tab ────────────────────────────────────────── */}
      {scanResult && viewTab === 'tables' && (
        <div className="space-y-3">
          {stringTables.length === 0 ? (
            <SurfaceCard>
              <div className="text-center py-8">
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
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {count !== undefined && <span className="text-2xs text-text-muted">({count})</span>}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-400" />}
    </button>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <SurfaceCard level={2}>
      <p className="text-2xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold ${accent ?? 'text-text'}`}>{value}</p>
    </SurfaceCard>
  );
}

function StringCard({ str }: { str: LocalizableString }) {
  const [expanded, setExpanded] = useState(false);
  const usageColor =
    str.currentUsage === 'nsloctext' || str.currentUsage === 'loctext'
      ? 'text-emerald-400'
      : str.currentUsage === 'hardcoded'
        ? 'text-red-400'
        : 'text-amber-400';

  return (
    <SurfaceCard level={2}>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text truncate">&quot;{str.sourceText}&quot;</span>
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
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-border">
              {str.locations.map((loc, i) => (
                <div key={i} className="text-2xs">
                  <span className="text-text-muted">{loc.filePath}:{loc.lineNumber}</span>
                  <pre className="mt-1 p-2 rounded bg-surface text-text-muted overflow-x-auto text-[10px] leading-relaxed">
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

  return (
    <SurfaceCard level={2}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-medium text-text-muted">{locInfo?.nativeName ?? entry.locale}</span>
            <span className={`text-2xs ${style.color}`}>{style.label}</span>
            {entry.expansionWarning && (
              <Badge variant="warning">expansion</Badge>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">&quot;{sourceText}&quot;</p>
          <p className="text-xs text-text font-medium mt-0.5">→ &quot;{entry.translatedText}&quot;</p>
          {entry.translatorNotes && (
            <p className="text-2xs text-text-muted mt-1 italic">{entry.translatorNotes}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ProgressRing value={Math.round(entry.confidence * 100)} size={28} strokeWidth={3} color={entry.confidence >= 0.85 ? ACCENT_EMERALD : STATUS_WARNING} />
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
  const style = SEVERITY_STYLE[hazard.severity];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(hazard.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [hazard.fixPrompt]);

  return (
    <SurfaceCard level={2}>
      <div className={`rounded-md border ${style.border} ${style.bg} p-3`}>
        <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {hazard.severity === 'critical' ? (
            <ShieldAlert className={`w-4 h-4 ${style.text} shrink-0 mt-0.5`} />
          ) : hazard.severity === 'warning' ? (
            <AlertTriangle className={`w-4 h-4 ${style.text} shrink-0 mt-0.5`} />
          ) : (
            <Info className={`w-4 h-4 ${style.text} shrink-0 mt-0.5`} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text">{hazard.type.replace(/_/g, ' ')}</span>
              <Badge variant={style.badge}>{hazard.severity}</Badge>
            </div>
            <p className="text-2xs text-text-muted mt-0.5">{hazard.description}</p>
          </div>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
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
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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

function ReplacementCard({ replacement }: { replacement: { stringId: string; originalCode: string; suggestedCode: string } }) {
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
        <span className="text-2xs font-medium text-text">LOCTEXT Replacement</span>
      </div>
      <pre className="text-[10px] leading-relaxed p-1.5 rounded bg-status-red-subtle text-red-300 overflow-x-auto mb-1">
        - {replacement.originalCode}
      </pre>
      <pre className="text-[10px] leading-relaxed p-1.5 rounded bg-emerald-500/5 text-emerald-300 overflow-x-auto mb-1">
        + {replacement.suggestedCode}
      </pre>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied!' : 'Copy suggested'}
      </button>
    </div>
  );
}

function StringTableCard({ table }: { table: StringTable }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

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
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-indigo-400" />
          <div>
            <p className="text-xs font-medium text-text">{table.tableId}</p>
            <p className="text-2xs text-text-muted">{table.namespace} — {table.rows.length} entries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs bg-surface-2 hover:bg-surface text-text-muted transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy CSV'}
          </button>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
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
