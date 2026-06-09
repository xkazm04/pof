'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  BookOpen, Search, Filter, ChevronDown, ChevronRight,
  Sparkles, TrendingUp, Users, AlertTriangle,
  RefreshCw, Code, Tag, Layers, ShieldAlert,
  CheckCircle2, Pin, Edit3, Plus, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import type {
  ImplementationPattern,
  PatternCategory,
  PatternAuthorInput,
} from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COLORS, OPACITY_10, ACCENT_EMERALD_DARK, CONFIDENCE_TOKENS, STATUS_ERROR } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { formatDuration } from '@/lib/format';
import { AntiPatternList } from './AntiPatternList';

type LibraryTab = 'patterns' | 'anti-patterns';

// ── Constants for stable Zustand selectors ──────────────────────────────────

const EMPTY_PATTERNS: ImplementationPattern[] = [];
const EMPTY_MODULES: { moduleId: SubModuleId; patternCount: number }[] = [];
const EMPTY_CATEGORIES: { category: PatternCategory; count: number }[] = [];

// ── Styling maps ────────────────────────────────────────────────────────────
// Confidence chip colors live in CONFIDENCE_TOKENS (chart-colors.ts) so they
// stay in lockstep with the rest of the evaluator's palette.

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
  const [authorOpen, setAuthorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LibraryTab>('patterns');
  const antiPatternCount = usePatternLibraryStore((s) => s.antiPatterns.length);

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
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-text-muted">Loading patterns...</span>
          </div>
        )}

        {activeTab === 'patterns' && error && (
          <SurfaceCard className="p-4 mb-4 border-status-red-strong">
            <p className="text-sm text-red-400">{error}</p>
          </SurfaceCard>
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

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <KPICard
      icon={icon}
      label={label}
      value={<span className={color}>{value}</span>}
    />
  );
}

// ── Pattern Card ────────────────────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: ImplementationPattern }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const verifyPattern = usePatternLibraryStore((s) => s.verifyPattern);
  const pinPattern = usePatternLibraryStore((s) => s.pinPattern);

  const conf = CONFIDENCE_TOKENS[pattern.confidence];
  const successPercent = Math.round(pattern.successRate * 100);
  const successColor = successPercent >= 70 ? ACCENT_EMERALD_DARK : successPercent >= 50 ? MODULE_COLORS.content : MODULE_COLORS.evaluator;

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
            {pattern.pinned && (
              <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" aria-label="Pinned" />
            )}
            {pattern.verified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-label="Verified" />
            )}
            <span className="text-sm font-medium text-text truncate">{pattern.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-5">
            <span className="text-2xs text-text-muted">{pattern.moduleId}</span>
            <span className="text-2xs text-text-muted/50">|</span>
            <span
              className="px-1.5 py-0.5 rounded text-2xs font-medium"
              style={{ backgroundColor: conf.bg, color: conf.color }}
            >
              {conf.label}
            </span>
            <span className="text-2xs text-text-muted/50">|</span>
            <Badge>{CATEGORY_LABELS[pattern.category]}</Badge>
            <span className="text-2xs text-text-muted/50">|</span>
            <SourceBadge source={pattern.source} />
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
            transition={{ duration: MOTION.base }}
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
                <p className="text-xs text-text/80 leading-relaxed whitespace-pre-wrap">
                  <DecoratedCrashText text={pattern.description} />
                </p>
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
                        <span className="text-2xs text-amber-400/80"><DecoratedCrashText text={pitfall} /></span>
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
                {pattern.verifiedBy && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Verified by {pattern.verifiedBy}
                  </span>
                )}
              </div>

              {/* Curation controls */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => verifyPattern(pattern.id, !pattern.verified)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors ${
                    pattern.verified
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-surface-hover border border-border text-text-muted hover:text-text hover:border-emerald-500/30'
                  }`}
                  aria-pressed={pattern.verified}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {pattern.verified ? 'Verified' : 'Mark Verified'}
                </button>
                <button
                  type="button"
                  onClick={() => pinPattern(pattern.id, !pattern.pinned)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors ${
                    pattern.pinned
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                      : 'bg-surface-hover border border-border text-text-muted hover:text-text hover:border-amber-500/30'
                  }`}
                  aria-pressed={pattern.pinned}
                >
                  <Pin className="w-3 h-3" />
                  {pattern.pinned ? 'Pinned' : 'Pin as Canonical'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium bg-surface-hover border border-border text-text-muted hover:text-text hover:border-blue-500/30 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                  {editing ? 'Cancel Edit' : 'Edit'}
                </button>
              </div>

              {editing && (
                <PatternEditor pattern={pattern} onDone={() => setEditing(false)} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Source Badge ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: ImplementationPattern['source'] }) {
  if (source === 'authored') {
    return (
      <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
        Authored
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20">
      Mined
    </span>
  );
}

// ── Pattern Editor (description + pitfalls patch) ───────────────────────────

function PatternEditor({ pattern, onDone }: { pattern: ImplementationPattern; onDone: () => void }) {
  const updatePattern = usePatternLibraryStore((s) => s.updatePattern);
  const [description, setDescription] = useState(pattern.description);
  const [pitfallsText, setPitfallsText] = useState(pattern.pitfalls.join('\n'));
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const pitfalls = pitfallsText.split('\n').map((s) => s.trim()).filter(Boolean);
    await updatePattern(pattern.id, { description, pitfalls });
    setSaving(false);
    onDone();
  }, [pattern.id, description, pitfallsText, updatePattern, onDone]);

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <div>
        <label className="text-2xs text-text-muted font-medium mb-1 block">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-blue-500/40 resize-y"
        />
      </div>
      <div>
        <label className="text-2xs text-text-muted font-medium mb-1 block">Pitfalls (one per line)</label>
        <textarea
          value={pitfallsText}
          onChange={(e) => setPitfallsText(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-blue-500/40 resize-y"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1 rounded text-2xs text-text-muted hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded text-2xs font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Author Pattern Modal ────────────────────────────────────────────────────

function AuthorPatternModal({
  open,
  onClose,
  moduleIds,
}: {
  open: boolean;
  onClose: () => void;
  moduleIds: SubModuleId[];
}) {
  const authorPattern = usePatternLibraryStore((s) => s.authorPattern);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PatternAuthorInput>(() => ({
    title: '',
    moduleId: (moduleIds[0] ?? 'arpg-character') as SubModuleId,
    category: 'general',
    description: '',
    approach: '',
    tags: [],
    pitfalls: [],
    involvedClasses: [],
  }));
  const [tagsText, setTagsText] = useState('');
  const [pitfallsText, setPitfallsText] = useState('');
  const [classesText, setClassesText] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset form when the modal re-opens
  useEffect(() => {
    if (!open) return;
    setForm({
      title: '',
      moduleId: (moduleIds[0] ?? 'arpg-character') as SubModuleId,
      category: 'general',
      description: '',
      approach: '',
      tags: [],
      pitfalls: [],
      involvedClasses: [],
    });
    setTagsText('');
    setPitfallsText('');
    setClassesText('');
  }, [open, moduleIds]);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    const input: PatternAuthorInput = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      approach: form.approach.trim() || 'general',
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      pitfalls: pitfallsText.split('\n').map((t) => t.trim()).filter(Boolean),
      involvedClasses: classesText.split(',').map((t) => t.trim()).filter(Boolean),
    };
    const created = await authorPattern(input);
    setSubmitting(false);
    if (created) onClose();
  }, [form, tagsText, pitfallsText, classesText, authorPattern, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Author a Pattern"
      icon={<Plus className="w-4 h-4 text-emerald-400" />}
      initialFocusRef={titleInputRef}
    >
        <p className="text-2xs text-text-muted mb-3 leading-relaxed">
          Hand-authored patterns are saved as <strong>verified</strong> and outrank mined entries in dispatch suggestions.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Title</label>
            <input
              ref={titleInputRef}
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="e.g. GAS Combo via Montage Sections"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs text-text-muted font-medium mb-1 block">Module</label>
              <select
                value={form.moduleId}
                onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value as SubModuleId }))}
                className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              >
                {moduleIds.length === 0 && <option value={form.moduleId}>{form.moduleId}</option>}
                {moduleIds.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-2xs text-text-muted font-medium mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PatternCategory }))}
                className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              >
                {(Object.keys(CATEGORY_LABELS) as PatternCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Approach</label>
            <input
              type="text"
              value={form.approach}
              onChange={(e) => setForm((f) => ({ ...f, approach: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="composition | inheritance | data-driven | event-driven | ..."
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40 resize-y"
              placeholder="Describe the pattern: when to use it, why it works, what to avoid…"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="gas, montage, combo"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Involved Classes (comma-separated)</label>
            <input
              type="text"
              value={classesText}
              onChange={(e) => setClassesText(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40 font-mono"
              placeholder="UGameplayAbility, UAnimMontage, AVCharacter"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Pitfalls (one per line)</label>
            <textarea
              value={pitfallsText}
              onChange={(e) => setPitfallsText(e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40 resize-y"
              placeholder="Don't replicate animation state directly&#10;Watch out for montage section ordering"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Authored By (optional)</label>
            <input
              type="text"
              value={form.authoredBy ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, authoredBy: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="your name or handle"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !form.title.trim() || !form.description.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {submitting ? 'Saving…' : 'Save Pattern'}
          </button>
        </div>
    </Modal>
  );
}
