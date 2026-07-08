'use client';

import {
  Globe, Play, CheckCircle2, Table2, RefreshCw, XCircle,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ACCENT_EMERALD, ACCENT_INDIGO, STATUS_WARNING, STATUS_ERROR, SEVERITY_TOKENS } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { focusRingStyle } from '@/lib/ui/focus-ring';
import { useLocalizationPipelineView } from './useLocalizationPipelineView';
import { MiniStat } from './MiniStat';
import { SubTab } from './SubTab';
import { OverviewTab } from './OverviewTab';
import { StringsTab } from './StringsTab';
import { TranslationsTab } from './TranslationsTab';
import { QATab } from './QATab';
import { HazardCard } from './HazardCard';
import { StringTableCard } from './StringTableCard';

// ── Main Component ──────────────────────────────────────────────────────────

export function LocalizationPipelineView() {
  const {
    config, scanResult, strings, hazards, entries, reviewRequired, progress,
    expansionIssues, qaFindings, qaByLocale, replacements, stringTables,
    isLoading, error,
    viewTab, setViewTab,
    searchQuery, setSearchQuery,
    contextFilter, setContextFilter,
    localeFilter, setLocaleFilter,
    stringPresets, setStringPresets,
    translationPresets, setTranslationPresets,
    handleRunPipeline,
    stringsById, filteredStrings, filteredEntries,
    totalStrings, hardcoded, ftextCount, localizedCount, locReadiness,
    criticalHazards, avgProgress,
  } = useLocalizationPipelineView();

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
        <OverviewTab
          scanResult={scanResult}
          locReadiness={locReadiness}
          localizedCount={localizedCount}
          totalStrings={totalStrings}
          hardcoded={hardcoded}
          ftextCount={ftextCount}
          progress={progress}
          expansionIssues={expansionIssues}
          qaByLocale={qaByLocale}
          replacements={replacements}
        />
      )}

      {/* ── Strings Tab ──────────────────────────────────────────────── */}
      {scanResult && viewTab === 'strings' && (
        <StringsTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          contextFilter={contextFilter}
          setContextFilter={setContextFilter}
          stringPresets={stringPresets}
          setStringPresets={setStringPresets}
          filteredStrings={filteredStrings}
          strings={strings}
        />
      )}

      {/* ── Translations Tab ─────────────────────────────────────────── */}
      {scanResult && viewTab === 'translations' && (
        <TranslationsTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          localeFilter={localeFilter}
          setLocaleFilter={setLocaleFilter}
          translationPresets={translationPresets}
          setTranslationPresets={setTranslationPresets}
          filteredEntries={filteredEntries}
          entries={entries}
          config={config}
          reviewRequired={reviewRequired}
          stringsById={stringsById}
        />
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
