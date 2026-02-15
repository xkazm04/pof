'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  BookOpen, Search, Filter, ChevronDown, ChevronRight,
  Sparkles, TrendingUp, Users, Clock, AlertTriangle,
  RefreshCw, Code, Tag, Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import type { ImplementationPattern, PatternCategory, PatternConfidence } from '@/types/pattern-library';

// ── Constants for stable Zustand selectors ──────────────────────────────────

const EMPTY_PATTERNS: ImplementationPattern[] = [];
const EMPTY_MODULES: { moduleId: string; patternCount: number }[] = [];
const EMPTY_CATEGORIES: { category: PatternCategory; count: number }[] = [];

// ── Styling maps ────────────────────────────────────────────────────────────

const CONFIDENCE_STYLE: Record<PatternConfidence, { bg: string; text: string; label: string }> = {
  proven: { bg: 'bg-green-400/10', text: 'text-green-400', label: 'Proven' },
  promising: { bg: 'bg-amber-400/10', text: 'text-amber-400', label: 'Promising' },
  experimental: { bg: 'bg-purple-400/10', text: 'text-purple-400', label: 'Experimental' },
};

const CATEGORY_LABELS: Record<PatternCategory, string> = {
  'class-hierarchy': 'Class Hierarchy',
  'component-design': 'Component Design',
  'state-machine': 'State Machine',
  'data-flow': 'Data Flow',
  'gas-integration': 'GAS Integration',
  'animation-setup': 'Animation Setup',
  'ai-behavior': 'AI Behavior',
  'ui-architecture': 'UI Architecture',
  'save-system': 'Save System',
  optimization: 'Optimization',
  general: 'General',
};

const SORT_LABELS: Record<string, string> = {
  'success-rate': 'Success Rate',
  usage: 'Most Used',
  recent: 'Most Recent',
  duration: 'Fastest',
};

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

  // Fetch on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Debounced search
  useEffect(() => {
    if (searchQuery || moduleFilter || categoryFilter) {
      const timer = setTimeout(() => searchPatterns(), 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, moduleFilter, categoryFilter, sortBy, searchPatterns]);

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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text">Pattern Library</h1>
            <p className="text-xs text-text-muted">
              Implementation patterns learned from successful CLI sessions
            </p>
          </div>
          <button
            onClick={handleExtract}
            disabled={isExtracting}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/10 border border-violet-500/25 rounded-lg text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
            {isExtracting ? 'Extracting...' : 'Extract Patterns'}
          </button>
        </div>

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
              onChange={(e) => setModuleFilter(e.target.value || null)}
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-text-muted">Loading patterns...</span>
          </div>
        )}

        {error && (
          <SurfaceCard className="p-4 mb-4 border-status-red-strong">
            <p className="text-sm text-red-400">{error}</p>
          </SurfaceCard>
        )}

        {!isLoading && patterns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4" style={{ backgroundColor: '#8b5cf610' }}>
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

        {!isLoading && patterns.length > 0 && (
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
      {icon}
      <div>
        <div className={`text-sm font-semibold ${color}`}>{value}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </div>
    </SurfaceCard>
  );
}

// ── Pattern Card ────────────────────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: ImplementationPattern }) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_STYLE[pattern.confidence];
  const successPercent = Math.round(pattern.successRate * 100);
  const successColor = successPercent >= 70 ? '#10b981' : successPercent >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <SurfaceCard className="overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/50 transition-colors"
      >
        {/* Success rate ring */}
        <ProgressRing value={successPercent} size={40} strokeWidth={3} color={successColor} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            }
            <span className="text-sm font-medium text-text truncate">{pattern.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-5">
            <span className="text-2xs text-text-muted">{pattern.moduleId}</span>
            <span className="text-2xs text-text-muted/50">|</span>
            <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${conf.bg} ${conf.text}`}>
              {conf.label}
            </span>
            <span className="text-2xs text-text-muted/50">|</span>
            <Badge>{CATEGORY_LABELS[pattern.category]}</Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-center">
            <div className="text-xs font-medium text-text">{pattern.sessionCount}</div>
            <div className="text-2xs text-text-muted">sessions</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-text">{pattern.projectCount}</div>
            <div className="text-2xs text-text-muted">projects</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-text">{formatDuration(pattern.avgDurationMs)}</div>
            <div className="text-2xs text-text-muted">avg time</div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-3 space-y-3">
              {/* Approach */}
              <div>
                <div className="text-2xs text-text-muted font-medium mb-1">Approach</div>
                <span className="px-2 py-0.5 bg-blue-400/10 border border-blue-400/15 rounded text-2xs text-blue-400">
                  {pattern.approach}
                </span>
              </div>

              {/* Description */}
              <div>
                <div className="text-2xs text-text-muted font-medium mb-1">Description</div>
                <p className="text-xs text-text/80 leading-relaxed whitespace-pre-wrap">{pattern.description}</p>
              </div>

              {/* Tags */}
              {pattern.tags.length > 0 && (
                <div>
                  <div className="text-2xs text-text-muted font-medium mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {pattern.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-surface-hover border border-border rounded text-2xs text-text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Involved classes */}
              {pattern.involvedClasses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-2xs text-text-muted font-medium mb-1">
                    <Code className="w-3 h-3" />
                    Key Classes
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pattern.involvedClasses.map((cls) => (
                      <span key={cls} className="px-1.5 py-0.5 bg-cyan-400/5 border border-cyan-400/15 rounded text-2xs text-cyan-400 font-mono">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pitfalls */}
              {pattern.pitfalls.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-2xs text-text-muted font-medium mb-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Common Pitfalls
                  </div>
                  <div className="space-y-1">
                    {pattern.pitfalls.map((pitfall, i) => (
                      <div key={i} className="flex items-start gap-2 px-2 py-1.5 bg-amber-400/5 border border-amber-400/10 rounded">
                        <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-2xs text-amber-400/80">{pitfall}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Example prompt */}
              {pattern.examplePrompt && (
                <div>
                  <div className="text-2xs text-text-muted font-medium mb-1">Example Prompt</div>
                  <pre className="px-3 py-2 bg-surface-deep border border-border rounded text-2xs text-text/80 font-mono overflow-x-auto whitespace-pre-wrap">
                    {pattern.examplePrompt}
                  </pre>
                </div>
              )}

              {/* Timeline */}
              <div className="flex items-center gap-4 text-2xs text-text-muted pt-1 border-t border-border/50">
                <span>First seen: {new Date(pattern.firstSeenAt).toLocaleDateString()}</span>
                <span>Last success: {new Date(pattern.lastSuccessAt).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
