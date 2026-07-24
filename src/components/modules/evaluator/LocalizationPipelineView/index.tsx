'use client';

import { useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Globe, Play, CheckCircle2, Table2, RefreshCw,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { ACCENT_EMERALD, ACCENT_INDIGO, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { focusRingStyle, FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';
import { useLocalizationPipelineView } from './useLocalizationPipelineView';
import { MiniStat } from './MiniStat';
import { SubTab } from './SubTab';
import { OverviewTab } from './OverviewTab';
import { StringsTab } from './StringsTab';
import { TranslationsTab } from './TranslationsTab';
import { QATab } from './QATab';
import { HazardCard } from './HazardCard';
import { StringTableCard } from './StringTableCard';
import type { ViewTab } from './types';

// ── Constants ───────────────────────────────────────────────────────────────

/** Sub-tab order — also drives the tablist's arrow-key navigation. */
const TABS: readonly { key: ViewTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'strings', label: 'Strings' },
  { key: 'translations', label: 'Translations' },
  { key: 'hazards', label: 'Hazards' },
  { key: 'qa', label: 'QA' },
  { key: 'tables', label: 'String Tables' },
];

const tabId = (key: ViewTab) => `loc-tab-${key}`;
const panelId = (key: ViewTab) => `loc-panel-${key}`;

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

  const tabCounts: Partial<Record<ViewTab, number>> = {
    strings: totalStrings,
    translations: entries.length,
    hazards: hazards.length,
    qa: qaFindings.length,
    tables: stringTables.length,
  };

  // APG tabs pattern: ←/→ move between tabs, Home/End jump to the ends, and the
  // newly selected tab takes focus (inactive tabs are `tabIndex -1`).
  const tablistRef = useRef<HTMLDivElement>(null);
  const handleTabKeys = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((t) => t.key === viewTab);
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    setViewTab(TABS[next].key);
    tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }, [viewTab, setViewTab]);

  const runDisabledReason = !config
    ? 'Waiting for localization defaults to load'
    : isLoading
      ? 'Pipeline is already running'
      : undefined;

  return (
    <div className="space-y-6" style={focusRingStyle(ACCENT_INDIGO)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Globe aria-hidden="true" className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">Localization Pipeline</h2>
            <p className={`${TEXT_SCALE.body} text-text-muted mt-0.5`}>
              Scan for hardcoded strings, generate LOCTEXT macros, and produce context-aware translations
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRunPipeline}
          disabled={isLoading || !config}
          aria-busy={isLoading}
          title={runDisabledReason}
          className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING_CLASS}`}
        >
          {isLoading ? <RefreshCw aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : <Play aria-hidden="true" className="w-3.5 h-3.5" />}
          {isLoading ? 'Running…' : 'Run Full Pipeline'}
        </button>
      </div>

      {/* Error — announced, and offers the failed run again instead of dead-ending. */}
      {error && <InlineErrorRetry message={error} onRetry={handleRunPipeline} />}

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
        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Localization views"
          onKeyDown={handleTabKeys}
          className="flex items-center gap-1 border-b border-border overflow-x-auto"
        >
          {TABS.map((t) => (
            <SubTab
              key={t.key}
              id={tabId(t.key)}
              controls={panelId(t.key)}
              label={t.label}
              active={viewTab === t.key}
              onClick={() => setViewTab(t.key)}
              count={tabCounts[t.key]}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!scanResult && !isLoading && (
        <SurfaceCard>
          <div className="text-center py-10">
            <Globe aria-hidden="true" className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
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
          <div className="text-center py-10" role="status">
            <RefreshCw aria-hidden="true" className="w-8 h-8 text-indigo-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-text-muted">Running localization pipeline…</p>
            <p className={`${TEXT_SCALE.body} text-text-muted mt-1`}>
              Scanning code, detecting hazards, and translating — this can take a minute.
            </p>
          </div>
        </SurfaceCard>
      )}

      {/* ── Active tab panel ─────────────────────────────────────────── */}
      {scanResult && (
        <div role="tabpanel" id={panelId(viewTab)} aria-labelledby={tabId(viewTab)}>
          {/* ── Overview Tab ───────────────────────────────────────── */}
          {viewTab === 'overview' && (
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

          {/* ── Strings Tab ────────────────────────────────────────── */}
          {viewTab === 'strings' && (
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

          {/* ── Translations Tab ───────────────────────────────────── */}
          {viewTab === 'translations' && (
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

          {/* ── Hazards Tab ────────────────────────────────────────── */}
          {viewTab === 'hazards' && (
            <div className="space-y-4">
              {hazards.length === 0 ? (
                <SurfaceCard>
                  <div className="text-center py-10">
                    <CheckCircle2 aria-hidden="true" className="w-8 h-8 mx-auto mb-2" style={{ color: ACCENT_EMERALD }} />
                    <p className="text-sm text-text">No localization hazards detected</p>
                    <p className={`${TEXT_SCALE.body} text-text-muted mt-1`}>
                      No concatenated strings, locale-unaware formatting, or other blockers were found in the scanned code.
                    </p>
                  </div>
                </SurfaceCard>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
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

          {/* ── QA Tab ─────────────────────────────────────────────── */}
          {viewTab === 'qa' && (
            <QATab
              findings={qaFindings}
              byLocale={qaByLocale}
              targetLocales={config?.targetLocales ?? []}
              hasTranslations={entries.length > 0}
            />
          )}

          {/* ── String Tables Tab ──────────────────────────────────── */}
          {viewTab === 'tables' && (
            <div className="space-y-4">
              {stringTables.length === 0 ? (
                <SurfaceCard>
                  <div className="text-center py-10">
                    <Table2 aria-hidden="true" className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-text-muted mb-1">No string tables generated</p>
                    <p className={`${TEXT_SCALE.body} text-text-muted`}>
                      String tables are produced from localized strings — run the full pipeline once strings have LOCTEXT keys.
                    </p>
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
      )}
    </div>
  );
}
