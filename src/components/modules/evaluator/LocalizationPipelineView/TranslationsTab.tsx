import type { Dispatch, SetStateAction } from 'react';
import { Search, SearchX } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { LocalizableString, TranslationEntry, LocalizationConfig } from '@/types/localization-pipeline';
import { SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';
import type { TranslationPreset } from './types';
import { TRANSLATION_PRESET_LABELS, SCALE } from './constants';
import { PresetChip } from './PresetChip';
import { TranslationCard } from './TranslationCard';

export function TranslationsTab({
  searchQuery,
  setSearchQuery,
  localeFilter,
  setLocaleFilter,
  translationPresets,
  setTranslationPresets,
  filteredEntries,
  entries,
  config,
  reviewRequired,
  stringsById,
}: {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  localeFilter: string;
  setLocaleFilter: Dispatch<SetStateAction<string>>;
  translationPresets: Set<TranslationPreset>;
  setTranslationPresets: Dispatch<SetStateAction<Set<TranslationPreset>>>;
  filteredEntries: TranslationEntry[];
  entries: TranslationEntry[];
  config: LocalizationConfig | null;
  reviewRequired: TranslationEntry[];
  stringsById: Map<string, LocalizableString>;
}) {
  const hasFilters = searchQuery.trim().length > 0 || localeFilter !== 'all' || translationPresets.size > 0;
  const clearFilters = () => {
    setSearchQuery('');
    setLocaleFilter('all');
    setTranslationPresets(new Set());
  };

  return (
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
          {/* role=status so the count is announced when a filter changes it. */}
          <span className={SCALE.meta} role="status">
            {filteredEntries.length} translations shown
          </span>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <SurfaceCard>
          <div className="text-center py-10">
            <SearchX aria-hidden="true" className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-sm text-text-muted mb-1">
              {hasFilters ? 'No translations match these filters' : 'No translations yet'}
            </p>
            <p className={`${TEXT_SCALE.body} text-text-muted`}>
              {hasFilters
                ? `All ${entries.length} translations were filtered out — widen the search, locale, or preset filters.`
                : 'Run the full pipeline to translate the scanned strings into your target locales.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={`mt-3 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors ${FOCUS_RING_CLASS}`}
              >
                Clear filters
              </button>
            )}
          </div>
        </SurfaceCard>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filteredEntries.map((e, i) => {
            const source = stringsById.get(e.stringId);
            return (
              <TranslationCard key={`${e.stringId}-${e.locale}-${i}`} entry={e} sourceText={source?.sourceText ?? '?'} />
            );
          })}
        </div>
      )}
    </div>
  );
}
