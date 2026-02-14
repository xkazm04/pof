'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Trash2, Loader2, AlertOctagon, AlertTriangle,
  Info, CheckCircle2, ChevronDown, ChevronRight, Clock, Target,
  Gamepad2, Camera, Wrench, BarChart3, Activity, Sparkles,
} from 'lucide-react';
import type { PlaytestSession, PlaytestFinding, DirectorEvent, FindingSeverity, FindingCategory } from '@/types/game-director';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

const ACCENT = '#f97316';

const SEVERITY_STYLES: Record<FindingSeverity, { icon: typeof AlertOctagon; color: string; bg: string; border: string }> = {
  critical: { icon: AlertOctagon, color: '#f87171', bg: '#f8717108', border: '#f8717120' },
  high: { icon: AlertTriangle, color: '#fb923c', bg: '#fb923c08', border: '#fb923c20' },
  medium: { icon: Info, color: '#fbbf24', bg: '#fbbf2408', border: '#fbbf2420' },
  low: { icon: Info, color: '#60a5fa', bg: '#60a5fa08', border: '#60a5fa20' },
  positive: { icon: CheckCircle2, color: '#4ade80', bg: '#4ade8008', border: '#4ade8020' },
};

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  'visual-glitch': 'Visual Glitch',
  'animation-issue': 'Animation',
  'gameplay-feel': 'Gameplay Feel',
  'ux-problem': 'UX Problem',
  'performance': 'Performance',
  'crash-bug': 'Crash/Bug',
  'level-pacing': 'Level Pacing',
  'audio-issue': 'Audio',
  'save-load': 'Save/Load',
  'ai-behavior': 'AI Behavior',
  'positive-feedback': 'Positive',
};

const EVENT_ICONS: Record<string, typeof Activity> = {
  action: Activity,
  observation: Info,
  screenshot: Camera,
  finding: Target,
  'system-test': Gamepad2,
  error: AlertOctagon,
};

type DetailTab = 'findings' | 'timeline' | 'coverage';

interface SessionDetailProps {
  session: PlaytestSession;
  onBack: () => void;
  onSimulate: () => Promise<void>;
  onDelete: () => Promise<void>;
  simulating: boolean;
  getFindings: (id: string) => Promise<PlaytestFinding[]>;
  getEvents: (id: string) => Promise<DirectorEvent[]>;
}

export function SessionDetail({
  session,
  onBack,
  onSimulate,
  onDelete,
  simulating,
  getFindings,
  getEvents,
}: SessionDetailProps) {
  const [findings, setFindings] = useState<PlaytestFinding[]>([]);
  const [events, setEvents] = useState<DirectorEvent[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('findings');
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      const [f, e] = await Promise.all([getFindings(session.id), getEvents(session.id)]);
      if (!cancelled) {
        setFindings(f);
        setEvents(e);
        setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.id, getFindings, getEvents]);

  const isComplete = session.status === 'complete';
  const canSimulate = session.status === 'configuring' || session.status === 'complete';

  // Group findings by severity
  const criticals = findings.filter(f => f.severity === 'critical');
  const highs = findings.filter(f => f.severity === 'high');
  const mediums = findings.filter(f => f.severity === 'medium');
  const lows = findings.filter(f => f.severity === 'low');
  const positives = findings.filter(f => f.severity === 'positive');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-muted" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-text truncate">{session.name}</h1>
            <p className="text-xs text-text-muted">
              {new Date(session.createdAt).toLocaleString()}
              {session.durationMs && ` · ${Math.round(session.durationMs / 1000)}s`}
            </p>
          </div>

          {/* Score badge */}
          {session.summary && (
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle
                    cx="20" cy="20" r="17"
                    fill="none"
                    stroke={session.summary.overallScore >= 70 ? '#4ade80' : session.summary.overallScore >= 40 ? '#fbbf24' : '#f87171'}
                    strokeWidth="3"
                    strokeDasharray={`${(session.summary.overallScore / 100) * 106.8} 106.8`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">
                  {session.summary.overallScore}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {canSimulate && (
              <button
                onClick={onSimulate}
                disabled={simulating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${ACCENT}15`,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}30`,
                }}
              >
                {simulating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {simulating ? 'Running...' : isComplete ? 'Re-run' : 'Run Playtest'}
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-text-muted hover:text-[#f87171] hover:bg-[#f8717110] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Summary strip */}
        {session.summary && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 px-3.5 py-2.5 bg-surface border border-border rounded-lg mb-4"
          >
            <SummaryStat icon={Target} label="Findings" value={session.findingsCount} color="#60a5fa" />
            <SummaryStat icon={Gamepad2} label="Systems" value={session.systemsTestedCount} color={ACCENT} />
            <SummaryStat icon={Camera} label="Screenshots" value={session.summary.totalScreenshotsAnalyzed} color="#c084fc" />
            <SummaryStat icon={Clock} label="Playtime" value={`${Math.floor(session.summary.playtimeSeconds / 60)}m`} color="#fbbf24" />
            <div className="ml-auto flex items-center gap-3 text-2xs">
              {criticals.length > 0 && (
                <span className="text-[#f87171]">{criticals.length} critical</span>
              )}
              {positives.length > 0 && (
                <span className="text-[#4ade80]">{positives.length} positive</span>
              )}
            </div>
          </motion.div>
        )}

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <SubTab label="Findings" icon={Target} active={activeTab === 'findings'} onClick={() => setActiveTab('findings')} count={findings.length} />
          <SubTab label="Timeline" icon={Activity} active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} count={events.length} />
          <SubTab label="Coverage" icon={BarChart3} active={activeTab === 'coverage'} onClick={() => setActiveTab('coverage')} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'findings' && (
              <FindingsList
                findings={findings}
                expandedId={expandedFindingId}
                onToggle={(id) => setExpandedFindingId(expandedFindingId === id ? null : id)}
              />
            )}
            {activeTab === 'timeline' && <TimelineView events={events} />}
            {activeTab === 'coverage' && <CoverageView session={session} findings={findings} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryStat({ icon: Icon, label, value, color }: { icon: typeof Target; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-2xs text-text-muted">{label}</span>
      <span className="text-xs font-semibold text-text">{value}</span>
    </div>
  );
}

function SubTab({ label, icon: Icon, active, onClick, count }: {
  label: string; icon: typeof Target; active: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {count !== undefined && count > 0 && (
        <span className="text-2xs px-1 py-0.5 rounded bg-border text-text-muted">{count}</span>
      )}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: ACCENT }} />}
    </button>
  );
}

function FindingsList({ findings, expandedId, onToggle }: {
  findings: PlaytestFinding[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="w-6 h-6 text-border-bright mb-2" />
        <p className="text-xs text-text-muted">No findings yet. Run a playtest to generate findings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {findings.map((finding, idx) => {
        const style = SEVERITY_STYLES[finding.severity];
        const Icon = style.icon;
        const isExpanded = expandedId === finding.id;
        const catLabel = CATEGORY_LABELS[finding.category] ?? finding.category;

        return (
          <motion.div
            key={finding.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.02 }}
            className="rounded-lg border overflow-hidden"
            style={{ backgroundColor: style.bg, borderColor: style.border }}
          >
            <button
              onClick={() => onToggle(finding.id)}
              className="w-full text-left flex items-start gap-3 px-3.5 py-3 hover:brightness-110 transition-colors"
            >
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: style.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-text">{finding.title}</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-border text-text-muted">{catLabel}</span>
                  {finding.relatedModule && (
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-border text-text-muted-hover">{finding.relatedModule}</span>
                  )}
                </div>
                <p className="text-xs text-text-muted-hover leading-relaxed line-clamp-2">{finding.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-2xs text-[#4a4e6a]">{finding.confidence}%</span>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-text-muted" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3.5 pb-3 pt-1 border-t" style={{ borderColor: style.border }}>
                    {finding.suggestedFix && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Wrench className="w-3 h-3 text-text-muted" />
                          <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Suggested Fix</span>
                        </div>
                        <p className="text-xs text-text-muted-hover leading-relaxed pl-4.5">{finding.suggestedFix}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-2xs text-[#4a4e6a]">
                      {finding.gameTimestamp != null && (
                        <span>Game time: {finding.gameTimestamp}s</span>
                      )}
                      <span>Confidence: {finding.confidence}%</span>
                      <span className="capitalize">{finding.severity}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function TimelineView({ events }: { events: DirectorEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="w-6 h-6 text-border-bright mb-2" />
        <p className="text-xs text-text-muted">No events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical timeline line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-3">
        {events.map((event, idx) => {
          const Icon = EVENT_ICONS[event.type] ?? Activity;
          const isError = event.type === 'error';
          const isFinding = event.type === 'finding';

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.02 }}
              className="relative flex items-start gap-3"
            >
              {/* Timeline dot */}
              <div
                className="absolute left-[-18px] w-3 h-3 rounded-full border-2 border-surface-deep flex-shrink-0"
                style={{
                  backgroundColor: isError ? '#f87171' : isFinding ? '#fbbf24' : 'var(--border-bright)',
                }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon
                    className="w-3 h-3 flex-shrink-0"
                    style={{ color: isError ? '#f87171' : isFinding ? '#fbbf24' : 'var(--text-muted)' }}
                  />
                  <span className={`text-xs ${isError ? 'text-[#f87171]' : 'text-text'}`}>
                    {event.message}
                  </span>
                </div>
                <span className="text-2xs text-[#4a4e6a]">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function CoverageView({ session, findings }: { session: PlaytestSession; findings: PlaytestFinding[] }) {
  if (!session.summary) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="w-6 h-6 text-border-bright mb-2" />
        <p className="text-xs text-text-muted">Coverage data available after playtest completion.</p>
      </div>
    );
  }

  const categories = Object.entries(session.summary.testCoverage);

  // Count findings per severity
  const severityCounts: Record<string, number> = {};
  for (const f of findings) {
    severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
  }

  // Count findings per category
  const categoryCounts: Record<string, number> = {};
  for (const f of findings) {
    categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Test Coverage Bars */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Test Coverage by Category
        </h3>
        <div className="space-y-2.5">
          {categories.map(([cat, pct], idx) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="text-xs text-text-muted-hover w-28 capitalize">{cat.replace(/-/g, ' ')}</span>
              <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 + idx * 0.05 }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171',
                  }}
                />
              </div>
              <span className="text-xs font-medium text-text w-8 text-right">{pct}%</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Severity breakdown */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Findings by Severity
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {(['critical', 'high', 'medium', 'low', 'positive'] as FindingSeverity[]).map((sev) => {
            const style = SEVERITY_STYLES[sev];
            const count = severityCounts[sev] ?? 0;
            return (
              <div
                key={sev}
                className="p-3 rounded-lg border text-center"
                style={{ backgroundColor: style.bg, borderColor: style.border }}
              >
                <span className="text-lg font-bold block" style={{ color: style.color }}>{count}</span>
                <span className="text-2xs capitalize text-text-muted">{sev}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Findings by Category
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <SurfaceCard
              key={cat}
              className="flex items-center justify-between px-3 py-2"
            >
              <span className="text-xs text-text-muted-hover capitalize">{CATEGORY_LABELS[cat as FindingCategory] ?? cat}</span>
              <span className="text-xs font-semibold text-text">{count}</span>
            </SurfaceCard>
          ))}
        </div>
      </div>

      {/* Summary callouts */}
      {session.summary.topIssue && (
        <div className="p-3 bg-[#f8717108] border border-[#f8717120] rounded-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3 text-[#f87171]" />
            <span className="text-2xs uppercase tracking-wider text-[#f87171] font-semibold">Top Issue</span>
          </div>
          <p className="text-xs text-text">{session.summary.topIssue}</p>
        </div>
      )}
      {session.summary.topPraise && (
        <div className="p-3 bg-[#4ade8008] border border-[#4ade8020] rounded-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3 h-3 text-[#4ade80]" />
            <span className="text-2xs uppercase tracking-wider text-[#4ade80] font-semibold">Top Praise</span>
          </div>
          <p className="text-xs text-text">{session.summary.topPraise}</p>
        </div>
      )}
    </div>
  );
}
