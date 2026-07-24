'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  BookOpen, Search, Filter, ChevronDown,
  Sparkles, TrendingUp, Users,
  RefreshCw, Tag, Layers, ShieldAlert,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import type { PatternCategory } from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COLORS, OPACITY_10, STATUS_ERROR } from '@/lib/chart-colors';
import { AntiPatternList } from '../AntiPatternList';
import {
  type LibraryTab,
  EMPTY_PATTERNS,
  EMPTY_MODULES,
  EMPTY_CATEGORIES,
  CATEGORY_LABELS,
  SORT_LABELS,
} from './constants';
import { FetchError } from '@/components/modules/shared/FetchError';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { StatCard } from './StatCard';
import { PatternCard } from './PatternCard';
import { AuthorPatternModal } from './AuthorPatternModal';

// ── Main Component ──────────────────────────────────────────────────────────

export function PatternLibraryView() {
  const patterns = usePatternLibraryStore((s) => s.patterns) ?? EMPTY_PATTERNS;
  const totalPatterns = usePatternLibraryStore((s) => s.totalPatterns);
  const totalSessions = usePatternLibraryStore((s) => s.totalSessions);
  const avgSuccessRate = usePatternLibraryStore((s) => s.avgSuccessRate);
  const topModules = usePatternLibraryStore((s) => s.topModules) ?? EMPTY_MODULES;
  const categories = usePatternLibraryStore((s) => s.categories) ?? EMPTY_CATEGORIES;
  const isLoading = usePatternLibraryStore((s) => s.isLoading);
  const isExtracting = usePatternLibraryStore((s) => s.isExtracting);
  const error = usePatternLibraryStore((s) => s.error);

  const searchQuery = usePatternLibraryStore((s) => s.searchQuery);
  const moduleFilter = usePatternLibraryStore((s) => s.moduleFilter);
  const categoryFilter = usePatternLibraryStore((s) => s.categoryFilter);
  const sortBy = usePatternLibraryStore((s) => s.sortBy);

  const fetchDashboard = usePatternLibraryStore((s) => s.fetchDashboard);
  const searchPatterns = usePatternLibraryStore((s) => s.searchPatterns);
  const extractPatterns = usePatternLibraryStore((s) => s.extractPatterns);
  const setSearchQuery = usePatternLibraryStore((s) => s.setSearchQuery);
  const setModuleFilter = usePatternLibraryStore((s) => s.setModuleFilter);
  const setCategoryFilter = usePatternLibraryStore((s) => s.setCategoryFilter);
  const setSortBy = usePatternLibraryStore((s) => s.setSortBy);

  const [extractResult, setExtractResult] = useState<{ extracted: number; updated: number } | null>(null);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LibraryTab>('patterns');
  const antiPatternCount = usePatternLibraryStore((s) => s.antiPatterns.length);

  // Fetch on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Debounced search — also restores the full list when every filter is cleared
  const filtersWereActiveRef = useRef(false);
  useEffect(() => {
    const hasFilters = Boolean(searchQuery || moduleFilter || categoryFilter);
    if (hasFilters) {
      filtersWereActiveRef.current = true;
      const timer = setTimeout(() => searchPatterns(), 300);
      return () => clearTimeout(timer);
    }
    // Filters just transitioned back to empty: re-fetch the unfiltered
    // dashboard list instead of leaving the last filtered results on screen.
    if (filtersWereActiveRef.current) {
      filtersWereActiveRef.current = false;
      const timer = setTimeout(() => fetchDashboard(), 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, moduleFilter, categoryFilter, sortBy, searchPatterns, fetchDashboard]);

  const handleExtract = useCallback(async () => {
    const result = await extractPatterns();
    setExtractResult(result);
    setTimeout(() => setExtractResult(null), 5000);
  }, [extractPatterns]);

  // Unique module IDs from top modules
  const moduleIds = useMemo(() => topModules.map((m) => m.moduleId), [topModules]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <DashboardHeader
          icon={BookOpen}
          title="Pattern Library"
          subtitle="Implementation patterns learned from successful CLI sessions"
          accent="violet"
          accentTo="blue"
          className="mb-4"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuthorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Author Pattern
              </button>
              <button
                onClick={handleExtract}
                disabled={isExtracting}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/10 border border-violet-500/25 rounded-lg text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
                {isExtracting ? 'Extracting...' : 'Extract Patterns'}
              </button>
            </div>
          }
        />

        {/* Extract result toast */}
        <AnimatePresence>
          {extractResult && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <SurfaceCard className="px-3 py-2 border-violet-500/20">
                <p className="text-xs text-violet-400">
                  Extracted <strong>{extractResult.extracted}</strong> new patterns, updated <strong>{extractResult.updated}</strong> existing
                </p>
              </SurfaceCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Patterns / Anti-Patterns tab switcher */}
        <UnderlineTabs
          ariaLabel="Pattern library tabs"
          className="mb-4"
          active={activeTab}
          onChange={(id) => setActiveTab(id)}
          tabs={[
            { id: 'patterns', label: 'Patterns', icon: BookOpen, count: totalPatterns, accent: MODULE_COLORS.systems },
            { id: 'anti-patterns', label: 'Anti-Patterns', icon: ShieldAlert, count: antiPatternCount, accent: STATUS_ERROR },
          ]}
        />

        {activeTab === 'patterns' && (
          <>
        {/* Stats bar */}
        <div className="flex gap-3 mb-4">
          <StatCard
            icon={<Layers className="w-4 h-4 text-violet-400" />}
            value={totalPatterns}
            label="Patterns"
            color="text-violet-400"
          />
          <StatCard
            icon={<Users className="w-4 h-4 text-blue-400" />}
            value={totalSessions}
            label="Sessions"
            color="text-blue-400"
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            value={`${Math.round(avgSuccessRate * 100)}%`}
            label="Avg Success"
            color="text-emerald-400"
          />
          <StatCard
            icon={<Sparkles className="w-4 h-4 text-amber-400" />}
            value={categories.length}
            label="Categories"
            color="text-amber-400"
          />
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search patterns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-violet-500/40"
            />
          </div>

          {/* Module filter */}
          <div className="relative">
            <select
              value={moduleFilter ?? ''}
              onChange={(e) => setModuleFilter((e.target.value || null) as SubModuleId | null)}
              className="appearance-none pl-7 pr-6 py-1.5 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-violet-500/40 cursor-pointer"
            >
              <option value="">All modules</option>
              {moduleIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>

          {/* Category filter */}
          <div className="relative">
            <select
              value={categoryFilter ?? ''}
              onChange={(e) => setCategoryFilter((e.target.value || null) as PatternCategory | null)}
              className="appearance-none pl-7 pr-6 py-1.5 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-violet-500/40 cursor-pointer"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {CATEGORY_LABELS[c.category]} ({c.count})
                </option>
              ))}
            </select>
            <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none pl-7 pr-6 py-1.5 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-violet-500/40 cursor-pointer"
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <TrendingUp className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
        </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === 'anti-patterns' && <AntiPatternList moduleId={moduleFilter} />}

        {activeTab === 'patterns' && isLoading && (
          <LoadingRow label="Loading patterns…" color={MODULE_COLORS.systems} />
        )}

        {activeTab === 'patterns' && error && !isLoading && (
          <FetchError message={error} onRetry={fetchDashboard} />
        )}

        {activeTab === 'patterns' && !isLoading && patterns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4" style={{ backgroundColor: `${MODULE_COLORS.systems}${OPACITY_10}` }}>
              <BookOpen className="w-6 h-6 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-text mb-1">No Patterns Yet</h3>
            <p className="text-xs text-text-muted max-w-xs leading-relaxed">
              Extract implementation patterns from your CLI session history to discover proven approaches, success rates, and reusable strategies.
            </p>
            <button
              onClick={handleExtract}
              disabled={isExtracting}
              className="flex items-center gap-1.5 mt-4 px-4 py-2 bg-violet-500/10 border border-violet-500/25 rounded-lg text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
            >
              {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Extract Patterns
            </button>
          </div>
        )}

        {activeTab === 'patterns' && !isLoading && patterns.length > 0 && (
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        )}
      </div>

      <AuthorPatternModal
        open={authorOpen}
        onClose={() => setAuthorOpen(false)}
        moduleIds={moduleIds}
      />
    </div>
  );
}
