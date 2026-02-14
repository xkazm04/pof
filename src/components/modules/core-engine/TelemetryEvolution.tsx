'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dna, Scan, Loader2, ChevronDown, ChevronRight, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp, Activity, Sparkles,
  Layers, Clock, Shield, Swords, Compass, Package,
  Skull, Crosshair, Zap,
} from 'lucide-react';
import { useGenreEvolution } from '@/hooks/useGenreEvolution';
import { useProjectStore } from '@/stores/projectStore';
import type { GenreEvolutionSuggestion, PatternDetection, SubGenreId } from '@/types/telemetry';

const ACCENT = '#3b82f6';

const SUB_GENRE_STYLES: Record<SubGenreId, { color: string; icon: typeof Swords }> = {
  'souls-like':       { color: '#f87171', icon: Skull },
  'character-action': { color: '#fbbf24', icon: Zap },
  'diablo-like':      { color: '#c084fc', icon: Package },
  'arpg-shooter':     { color: '#60a5fa', icon: Crosshair },
  'tactical-arpg':    { color: '#4ade80', icon: Shield },
  'open-world-arpg':  { color: '#f97316', icon: Compass },
  'roguelite-arpg':   { color: '#e879f9', icon: Layers },
  'survival-arpg':    { color: '#34d399', icon: Activity },
};

export function TelemetryEvolution() {
  const { stats, history, loading, scanning, scanProject, resolveSuggestion } = useGenreEvolution();
  const { projectPath, dynamicContext } = useProjectStore();
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const handleScan = async () => {
    if (!projectPath) return;
    await scanProject(projectPath, dynamicContext);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  const patterns = stats?.detectedPatterns ?? [];
  const suggestions = stats?.activeSuggestions ?? [];
  const accepted = stats?.acceptedSubGenres ?? [];

  return (
    <div className="space-y-5">
      {/* Header + Scan button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${ACCENT}12`, border: `1px solid ${ACCENT}20` }}
          >
            <Dna className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <div>
            <h2 className="text-sm font-medium text-text">Genre Evolution</h2>
            <p className="text-2xs text-text-muted">
              {stats?.totalScans ?? 0} scan{(stats?.totalScans ?? 0) !== 1 ? 's' : ''}
              {stats?.lastScanAt && (
                <> &middot; last {new Date(stats.lastScanAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning || !projectPath}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            backgroundColor: `${ACCENT}15`,
            color: ACCENT,
            border: `1px solid ${ACCENT}30`,
          }}
        >
          {scanning ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Scan className="w-3 h-3" />
          )}
          {scanning ? 'Scanning...' : 'Scan Project'}
        </button>
      </motion.div>

      {/* Empty state */}
      {patterns.length === 0 && suggestions.length === 0 && accepted.length === 0 && (
        <EmptyState onScan={handleScan} scanning={scanning} hasProject={!!projectPath} />
      )}

      {/* Detected patterns */}
      {patterns.length > 0 && (
        <PatternsList patterns={patterns} />
      )}

      {/* Active suggestions */}
      {suggestions.length > 0 && (
        <SuggestionsList
          suggestions={suggestions}
          expandedId={expandedSuggestion}
          onToggle={(id) => setExpandedSuggestion(prev => prev === id ? null : id)}
          onResolve={resolveSuggestion}
        />
      )}

      {/* Accepted sub-genres */}
      {accepted.length > 0 && (
        <AcceptedGenres genres={accepted} />
      )}

      {/* Scan history */}
      {history.length > 1 && (
        <ScanHistory history={history} />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onScan, scanning, hasProject }: { onScan: () => void; scanning: boolean; hasProject: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-14 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${ACCENT}08`, border: `1px solid ${ACCENT}15` }}
      >
        <Dna className="w-7 h-7 text-border-bright" />
      </div>
      <h3 className="text-sm font-medium text-text mb-1">No telemetry data yet</h3>
      <p className="text-xs text-text-muted max-w-xs mb-4">
        Scan your UE5 project to detect gameplay patterns and get sub-genre evolution suggestions based on your actual code.
      </p>
      {hasProject ? (
        <button
          onClick={onScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: `${ACCENT}15`,
            color: ACCENT,
            border: `1px solid ${ACCENT}30`,
          }}
        >
          <Scan className="w-3.5 h-3.5" />
          {scanning ? 'Scanning...' : 'Run First Scan'}
        </button>
      ) : (
        <p className="text-xs text-[#4a4e6a]">Set up your project path first in Project Setup.</p>
      )}
    </motion.div>
  );
}

function PatternsList({ patterns }: { patterns: PatternDetection[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Activity className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Detected Patterns
        </span>
        <span className="text-2xs text-[#4a4e6a]">{patterns.length} found</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {patterns.map((p, i) => (
          <motion.div
            key={p.pattern}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
            className="flex items-start gap-2.5 px-3 py-2.5 bg-surface-deep border border-border rounded-lg"
          >
            <ConfidenceRing value={p.confidence} size={28} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-text block">
                {formatPatternName(p.pattern)}
              </span>
              {p.evidence.length > 0 && (
                <span className="text-2xs text-text-muted line-clamp-2 block mt-0.5">
                  {p.evidence[0]}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SuggestionsList({
  suggestions,
  expandedId,
  onToggle,
  onResolve,
}: {
  suggestions: GenreEvolutionSuggestion[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onResolve: (id: string, action: 'accept' | 'dismiss') => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Evolution Suggestions
        </span>
      </div>
      <div className="space-y-2">
        {suggestions.map((sug, i) => {
          const style = SUB_GENRE_STYLES[sug.subGenre] ?? { color: 'var(--text-muted)', icon: Layers };
          const Icon = style.icon;
          const isExpanded = expandedId === sug.id;

          return (
            <motion.div
              key={sug.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="bg-surface-deep border rounded-xl overflow-hidden transition-colors"
              style={{ borderColor: isExpanded ? `${style.color}30` : 'var(--border)' }}
            >
              {/* Header */}
              <button
                onClick={() => onToggle(sug.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left group"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${style.color}10`, border: `1px solid ${style.color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color: style.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-text block">{sug.label}</span>
                  <span className="text-2xs text-text-muted">{sug.confidence}% confidence</span>
                </div>
                <ConfidenceRing value={sug.confidence} size={32} color={style.color} />
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#4a4e6a]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#4a4e6a] group-hover:text-text-muted transition-colors" />
                )}
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3.5 space-y-3 border-t border-border">
                      {/* Description */}
                      <p className="text-xs text-text-muted-hover pt-3 leading-relaxed">
                        {sug.description}
                      </p>

                      {/* Evidence */}
                      {sug.patterns.length > 0 && (
                        <div>
                          <span className="text-2xs text-text-muted font-semibold uppercase tracking-wider">Evidence</span>
                          <div className="mt-1 space-y-1">
                            {sug.patterns.flatMap(p => p.evidence).slice(0, 4).map((ev, j) => (
                              <div key={j} className="flex items-start gap-1.5">
                                <TrendingUp className="w-2.5 h-2.5 text-[#4a4e6a] mt-0.5 flex-shrink-0" />
                                <span className="text-2xs text-text-muted-hover">{ev}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Proposed changes */}
                      {sug.proposedChanges.add.length > 0 && (
                        <div>
                          <span className="text-2xs text-text-muted font-semibold uppercase tracking-wider">
                            New Checklist Items
                          </span>
                          <div className="mt-1 space-y-1">
                            {sug.proposedChanges.add.map(item => (
                              <div key={item.id} className="flex items-start gap-1.5">
                                <Sparkles className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" style={{ color: style.color }} />
                                <span className="text-2xs text-text-muted-hover">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onResolve(sug.id, 'accept'); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                          style={{
                            backgroundColor: `${style.color}15`,
                            color: style.color,
                            border: `1px solid ${style.color}30`,
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Accept Evolution
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onResolve(sug.id, 'dismiss'); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted bg-surface border border-border hover:border-border-bright transition-all"
                        >
                          <XCircle className="w-3 h-3" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AcceptedGenres({ genres }: { genres: SubGenreId[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.15 }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Active Sub-Genres
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {genres.map(g => {
          const style = SUB_GENRE_STYLES[g] ?? { color: 'var(--text-muted)', icon: Layers };
          const Icon = style.icon;
          return (
            <div
              key={g}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{
                backgroundColor: `${style.color}10`,
                color: style.color,
                border: `1px solid ${style.color}25`,
              }}
            >
              <Icon className="w-3 h-3" />
              {formatSubGenreName(g)}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ScanHistory({ history }: { history: { id: string; scannedAt: string; detectedPatterns: PatternDetection[] }[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Clock className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Scan History
        </span>
      </div>
      <div className="space-y-1">
        {history.slice(0, 5).map((snap, i) => (
          <motion.div
            key={snap.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: i * 0.03 }}
            className="flex items-center gap-3 px-3 py-2 bg-surface-deep border border-border rounded-lg"
          >
            <Scan className="w-3 h-3 text-[#4a4e6a] flex-shrink-0" />
            <span className="text-xs text-text-muted-hover flex-1">
              {new Date(snap.scannedAt).toLocaleString()}
            </span>
            <span className="text-2xs text-text-muted">
              {snap.detectedPatterns.length} pattern{snap.detectedPatterns.length !== 1 ? 's' : ''}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function ConfidenceRing({ value, size, color }: { value: number; size: number; color?: string }) {
  const r = (size / 2) - 3;
  const circumference = 2 * Math.PI * r;
  const fillColor = color ?? (value >= 70 ? '#4ade80' : value >= 50 ? '#fbbf24' : '#f87171');

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--border)" strokeWidth="2"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={fillColor} strokeWidth="2"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-text"
        style={{ fontSize: size < 30 ? '7px' : '9px' }}
      >
        {value}
      </span>
    </div>
  );
}

function formatPatternName(pattern: string): string {
  return pattern
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatSubGenreName(id: SubGenreId): string {
  const names: Record<SubGenreId, string> = {
    'souls-like': 'Souls-like',
    'character-action': 'Character Action',
    'diablo-like': 'Diablo-like',
    'arpg-shooter': 'ARPG Shooter',
    'tactical-arpg': 'Tactical ARPG',
    'open-world-arpg': 'Open World ARPG',
    'roguelite-arpg': 'Roguelite ARPG',
    'survival-arpg': 'Survival ARPG',
  };
  return names[id] ?? id;
}
