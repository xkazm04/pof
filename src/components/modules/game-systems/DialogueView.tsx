'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scroll, Swords, Package, MousePointerClick, MapPin, MessageSquare,
  ChevronDown, ChevronRight, RefreshCw, Sparkles, AlertTriangle,
  Target, Users, Box, Zap,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { apiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import type {
  QuestGenerationResult,
  GeneratedQuest,
  QuestObjective,
  DialogueNode,
  WorldScanResult,
  QuestCategory,
} from '@/types/quest-generation';
import { MODULE_COLORS, STATUS_SUCCESS, ACCENT_VIOLET, ACCENT_GREEN, withOpacity, OPACITY_80, OPACITY_10, OPACITY_15 } from '@/lib/chart-colors';

// ── Stable empty refs ──

const EMPTY_QUESTS: GeneratedQuest[] = [];
const EMPTY_NOTES: string[] = [];

// ── Config ──

const ACCENT = MODULE_COLORS.systems;

type ViewTab = 'generator' | 'checklist';

const CATEGORY_LABELS: Record<QuestCategory, { label: string; color: string }> = {
  main: { label: 'Main', color: MODULE_COLORS.content },
  side: { label: 'Side', color: MODULE_COLORS.core },
  bounty: { label: 'Bounty', color: MODULE_COLORS.evaluator },
  exploration: { label: 'Exploration', color: STATUS_SUCCESS },
  fetch: { label: 'Fetch', color: MODULE_COLORS.systems },
};

const OBJ_ICONS: Record<string, typeof Swords> = {
  kill: Swords,
  collect: Package,
  interact: MousePointerClick,
  'reach-location': MapPin,
  escort: Users,
  defend: Target,
  talk: MessageSquare,
};

// ── Main view ──

export function DialogueView() {
  const mod = SUB_MODULE_MAP['dialogue-quests'];
  const cat = getCategoryForSubModule('dialogue-quests');
  const [tab, setTab] = useState<ViewTab>('generator');

  if (!mod || !cat) return null;

  const tabClass = (t: ViewTab) =>
    `px-3 py-1.5 text-xs font-medium transition-colors rounded-t ${
      tab === t
        ? 'text-text bg-surface-hover border-b-2'
        : 'text-text-muted hover:text-text'
    }`;

  const tabStyle = (t: ViewTab) =>
    tab === t ? { borderColor: ACCENT } : undefined;

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-border">
        <button className={tabClass('generator')} style={tabStyle('generator')} onClick={() => setTab('generator')}>
          <span className="flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> Quest Generator</span>
        </button>
        <button className={tabClass('checklist')} style={tabStyle('checklist')} onClick={() => setTab('checklist')}>
          <span className="flex items-center gap-1"><Scroll className="w-2.5 h-2.5" /> Checklist</span>
        </button>
      </div>

      {tab === 'generator' && <QuestGeneratorPanel />}
      {tab === 'checklist' && (
        <ReviewableModuleView
          moduleId="dialogue-quests"
          moduleLabel={mod.label}
          moduleDescription={mod.description}
          moduleIcon={mod.icon}
          accentColor={cat.accentColor}
          checklist={getModuleChecklist('dialogue-quests')}
          quickActions={mod.quickActions}
        />
      )}
    </div>
  );
}

// ── Quest Generator Panel ──

function QuestGeneratorPanel() {
  const [result, setResult] = useState<QuestGenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelDocs, setLevelDocs] = useState<Array<{ id: number; name: string; roomCount: number }>>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  const projectPath = useProjectStore((s) => s.projectPath);

  // Load available level docs
  useEffect(() => {
    apiFetch<{ docs: Array<{ id: number; name: string; roomCount: number }> }>('/api/quest-generation')
      .then(data => {
        setLevelDocs(data.docs);
        if (data.docs.length > 0 && selectedDocId === null) {
          setSelectedDocId(data.docs[0].id);
        }
      })
      .catch(() => { /* ignore */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ result: QuestGenerationResult }>(
        '/api/quest-generation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath: projectPath || undefined,
            levelDocId: selectedDocId || undefined,
          }),
        },
      );
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, selectedDocId]);

  const quests = result?.quests ?? EMPTY_QUESTS;
  const notes = result?.coherenceNotes ?? EMPTY_NOTES;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <SurfaceCard level={2} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-text">Quest Archeologist</span>
          <div className="ml-auto flex items-center gap-2">
            {levelDocs.length > 0 && (
              <select
                value={selectedDocId ?? ''}
                onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : null)}
                className="bg-background border border-border-bright rounded px-2 py-1 text-xs text-text outline-none"
              >
                <option value="">No level doc</option>
                {levelDocs.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.roomCount} rooms)</option>
                ))}
              </select>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white transition-colors disabled:opacity-50 hover:brightness-125"
              style={{ backgroundColor: withOpacity(ACCENT, OPACITY_80) }}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating…' : 'Generate Quests'}
            </button>
          </div>
        </div>
        <p className="text-2xs text-text-muted mt-1.5">
          Scans project actors and level designs to procedurally generate quests with dialogue trees.
        </p>
      </SurfaceCard>

      {error && (
        <div className="rounded border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      {!result && !loading && (
        <SurfaceCard level={2} className="px-4 py-8 text-center">
          <Scroll className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">Click "Generate Quests" to scan your world and create quests</p>
          <p className="text-2xs text-text-muted mt-1">Works best with a level design document and scanned UE5 project</p>
        </SurfaceCard>
      )}

      {loading && !result && (
        <SurfaceCard level={2} className="px-4 py-8 text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" style={{ color: ACCENT }} />
          <p className="text-sm text-text-muted">Scanning world actors and generating quests…</p>
        </SurfaceCard>
      )}

      {result && (
        <>
          {/* World scan summary */}
          <WorldScanSummary scan={result.worldScan} levelDocName={result.levelDocName} />

          {/* Quest metrics — animate as a group first */}
          <motion.div
            className="flex flex-wrap gap-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {(['main', 'side', 'bounty', 'exploration', 'fetch'] as QuestCategory[]).map(c => {
              const count = quests.filter(q => q.category === c).length;
              const cfg = CATEGORY_LABELS[c];
              return (
                <motion.div
                  key={c}
                  className="min-w-[100px] flex-1"
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <SurfaceCard level={2} className="px-3 py-2 border-l-2" style={{ borderLeftColor: cfg.color }}>
                    <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-0.5">{cfg.label}</div>
                    <div className="text-base font-semibold" style={{ color: count > 0 ? cfg.color : 'var(--text-muted)' }}>{count}</div>
                  </SurfaceCard>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Coherence notes */}
          {notes.length > 0 && (
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Coherence Check</span>
              </div>
              <div className="space-y-0.5">
                {notes.map((note, i) => (
                  <p key={i} className="text-xs text-text-muted">{note}</p>
                ))}
              </div>
            </SurfaceCard>
          )}

          {/* Quest list — stagger in after metrics */}
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.35 } },
            }}
          >
            {quests.length === 0 ? (
              <SurfaceCard level={2} className="px-4 py-6 text-center">
                <p className="text-xs text-text-muted">No quests generated. Add enemy, NPC, or interactable actors to your project and create a level design document.</p>
              </SurfaceCard>
            ) : (
              quests.map(q => (
                <motion.div
                  key={q.id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <QuestCard quest={q} />
                </motion.div>
              ))
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

// ── World scan summary ──

function WorldScanSummary({ scan, levelDocName }: { scan: WorldScanResult; levelDocName: string | null }) {
  return (
    <SurfaceCard level={2} className="px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Target className="w-3 h-3 text-text-muted" />
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">World Scan</span>
        {levelDocName && (
          <span className="text-2xs font-mono ml-auto" style={{ color: ACCENT }}>{levelDocName}</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Swords className="w-3 h-3 text-red-400" />
          <span className="text-text">{scan.enemyClasses.length}</span>
          <span className="text-text-muted">enemies</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-blue-400" />
          <span className="text-text">{scan.npcClasses.length}</span>
          <span className="text-text-muted">NPCs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MousePointerClick className="w-3 h-3 text-green-400" />
          <span className="text-text">{scan.interactableClasses.length}</span>
          <span className="text-text-muted">interactables</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Box className="w-3 h-3 text-purple-400" />
          <span className="text-text">{scan.itemClasses.length}</span>
          <span className="text-text-muted">items</span>
        </div>
      </div>
    </SurfaceCard>
  );
}

// ── Difficulty pips ──

const DIFFICULTY_COLORS = [
  'var(--accent-green, #22c55e)',   // Lv1
  'var(--accent-green, #84cc16)',   // Lv2
  'var(--accent-yellow, #eab308)', // Lv3
  'var(--accent-orange, #f97316)', // Lv4
  'var(--accent-red, #ef4444)',    // Lv5
] as const;

const MAX_PIPS = 5;

function DifficultyPips({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(MAX_PIPS, level));
  const color = DIFFICULTY_COLORS[clamped - 1];

  return (
    <div className="flex items-center gap-0.5" title={`Difficulty ${clamped}/${MAX_PIPS}`}>
      {Array.from({ length: MAX_PIPS }, (_, i) => (
        <svg key={i} width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <circle
            cx="4" cy="4" r="3"
            fill={i < clamped ? color : 'transparent'}
            stroke={i < clamped ? color : 'var(--text-muted)'}
            strokeWidth="1"
            opacity={i < clamped ? 1 : 0.3}
          />
        </svg>
      ))}
    </div>
  );
}

// ── Quest card ──

function QuestCard({ quest }: { quest: GeneratedQuest }) {
  const [expanded, setExpanded] = useState(false);
  const catCfg = CATEGORY_LABELS[quest.category];

  return (
    <SurfaceCard level={2} className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover/30 transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        }
        <Scroll className="w-3.5 h-3.5 flex-shrink-0" style={{ color: catCfg.color }} />
        <span className="text-xs font-semibold text-text truncate flex-1">{quest.name}</span>
        <span
          className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: catCfg.color, backgroundColor: `${catCfg.color}15` }}
        >
          {catCfg.label}
        </span>
        <DifficultyPips level={quest.difficulty} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3 border-t border-border/40">
              {/* Description */}
              <p className="text-xs text-text-muted pt-2">{quest.description}</p>

              {/* Source hint */}
              <p className="text-2xs text-text-muted italic">{quest.sourceHint}</p>

              {/* Objectives */}
              <div>
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Objectives</span>
                <div className="mt-1 space-y-1">
                  {quest.objectives.map(obj => (
                    <ObjectiveRow key={obj.id} objective={obj} />
                  ))}
                </div>
              </div>

              {/* Rewards */}
              {quest.rewards.length > 0 && (
                <div>
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Rewards</span>
                  <div className="flex items-center gap-2 mt-1">
                    {quest.rewards.map((r, i) => (
                      <span key={i} className="text-2xs px-1.5 py-0.5 rounded font-medium" style={{ color: MODULE_COLORS.content, backgroundColor: withOpacity(MODULE_COLORS.content, OPACITY_10) }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dialogue preview */}
              {quest.dialogue.length > 0 && (
                <div>
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Dialogue Preview</span>
                  <div className="mt-1 space-y-1.5">
                    {quest.dialogue.slice(0, 3).map(node => (
                      <DialogueNodePreview key={node.id} node={node} />
                    ))}
                  </div>
                </div>
              )}

              {/* Room path */}
              {quest.roomPath.length > 0 && (
                <div className="flex items-center gap-1 text-2xs text-text-muted">
                  <MapPin className="w-2.5 h-2.5" />
                  <span>Path: {quest.roomPath.length} zone{quest.roomPath.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Objective row ──

function ObjectiveRow({ objective }: { objective: QuestObjective }) {
  const Icon = OBJ_ICONS[objective.type] || Target;
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3 h-3 text-text-muted flex-shrink-0" />
      <span className={`flex-1 ${objective.optional ? 'text-text-muted italic' : 'text-text'}`}>
        {objective.description}
        {objective.optional && ' (optional)'}
      </span>
      {objective.roomName && (
        <span className="text-2xs text-text-muted font-mono">{objective.roomName}</span>
      )}
    </div>
  );
}

// ── Dialogue preview ──

function DialogueNodePreview({ node }: { node: DialogueNode }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <MessageSquare className="w-2.5 h-2.5" style={{ color: ACCENT }} />
        <span className="text-2xs font-semibold" style={{ color: ACCENT_VIOLET }}>{node.speaker}</span>
      </div>
      <p className="text-2xs text-text leading-relaxed">{node.text}</p>
      {node.choices.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {node.choices.map(ch => (
            <div key={ch.id} className="flex items-center gap-1 text-2xs">
              <Zap className="w-2 h-2" style={{ color: ACCENT_GREEN }} />
              <span style={{ color: ACCENT_GREEN }}>{ch.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
