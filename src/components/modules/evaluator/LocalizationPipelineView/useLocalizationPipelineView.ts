import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import type { StringContext } from '@/types/localization-pipeline';
import { LOW_CONFIDENCE } from '@/lib/localization/definitions';
import type { ViewTab, StringPreset, TranslationPreset } from './types';

export function useLocalizationPipelineView() {
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

  return {
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
  };
}
