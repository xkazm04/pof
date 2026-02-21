'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dna, FlaskConical, GitBranch, BarChart3, Lightbulb, Play,
  Zap, Trophy, Plus, Shuffle, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Clock, TrendingUp, Layers,
  Target, Sparkles, Copy, ArrowRight, Wand2,
  ArrowDown, ArrowUp, ShieldCheck, FileCode2, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type {
  PromptVariant,
  ABTest,
  PromptCluster,
  EvolutionStats,
  EvolutionSuggestion,
  MutationType,
  VariantStyle,
  PromptOptimizationResult,
} from '@/types/prompt-evolution';
import { MUTATION_OPTIONS } from '@/lib/prompt-evolution/mutations';
import { UI_TIMEOUTS } from '@/lib/constants';
import { MODULE_COLORS, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';

// ── Constants ───────────────────────────────────────────────────────────────

const ACCENT = '#10b981'; // Emerald for evolution/growth

const STYLE_COLORS: Record<VariantStyle, string> = {
  imperative: MODULE_COLORS.evaluator,
  descriptive: MODULE_COLORS.core,
  'step-by-step': MODULE_COLORS.content,
  holistic: MODULE_COLORS.systems,
  'example-rich': '#10b981',
  minimal: STATUS_NEUTRAL,
};

const STATUS_COLORS = {
  running: MODULE_COLORS.content,
  concluded: '#10b981',
  cancelled: STATUS_NEUTRAL,
};

// ── Sample modules for the module picker ────────────────────────────────────

const MODULE_OPTIONS = [
  { id: 'arpg-character', label: 'Character' },
  { id: 'arpg-combat', label: 'Combat' },
  { id: 'arpg-inventory', label: 'Inventory' },
  { id: 'arpg-abilities', label: 'Abilities' },
  { id: 'arpg-ai', label: 'AI' },
  { id: 'arpg-world', label: 'World' },
  { id: 'arpg-ui', label: 'UI' },
  { id: 'arpg-audio', label: 'Audio' },
  { id: 'arpg-vfx', label: 'VFX' },
  { id: 'arpg-save', label: 'Save' },
  { id: 'arpg-multiplayer', label: 'Multiplayer' },
  { id: 'arpg-progression', label: 'Progression' },
];

// ── Main Component ──────────────────────────────────────────────────────────

export function PromptEvolutionView() {
  const variants = usePromptEvolutionStore((s) => s.variants);
  const abTests = usePromptEvolutionStore((s) => s.abTests);
  const clusters = usePromptEvolutionStore((s) => s.clusters);
  const suggestions = usePromptEvolutionStore((s) => s.suggestions);
  const stats = usePromptEvolutionStore((s) => s.stats);
  const selectedModuleId = usePromptEvolutionStore((s) => s.selectedModuleId);
  const isLoading = usePromptEvolutionStore((s) => s.isLoading);
  const isMutating = usePromptEvolutionStore((s) => s.isMutating);
  const isClustering = usePromptEvolutionStore((s) => s.isClustering);
  const error = usePromptEvolutionStore((s) => s.error);
  const activeSubTab = usePromptEvolutionStore((s) => s.activeSubTab);

  const lastOptimization = usePromptEvolutionStore((s) => s.lastOptimization);
  const isOptimizing = usePromptEvolutionStore((s) => s.isOptimizing);

  const init = usePromptEvolutionStore((s) => s.init);
  const setSelectedModule = usePromptEvolutionStore((s) => s.setSelectedModule);
  const setActiveSubTab = usePromptEvolutionStore((s) => s.setActiveSubTab);
  const loadVariants = usePromptEvolutionStore((s) => s.loadVariants);
  const createVariant = usePromptEvolutionStore((s) => s.createVariant);
  const mutateVariant = usePromptEvolutionStore((s) => s.mutateVariant);
  const startABTest = usePromptEvolutionStore((s) => s.startABTest);
  const concludeTestAction = usePromptEvolutionStore((s) => s.concludeTest);
  const clusterPrompts = usePromptEvolutionStore((s) => s.clusterPrompts);
  const loadStats = usePromptEvolutionStore((s) => s.loadStats);
  const loadSuggestions = usePromptEvolutionStore((s) => s.loadSuggestions);
  const optimizePromptAction = usePromptEvolutionStore((s) => s.optimizePrompt);

  const [newPrompt, setNewPrompt] = useState('');
  const [newChecklistItemId, setNewChecklistItemId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMutation, setSelectedMutation] = useState<MutationType>('imperative-rewrite');
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (selectedModuleId) {
      loadVariants(selectedModuleId);
      loadSuggestions(selectedModuleId);
    }
  }, [selectedModuleId, loadVariants, loadSuggestions]);

  const handleCreateVariant = useCallback(async () => {
    if (!selectedModuleId || !newChecklistItemId || !newPrompt.trim()) return;
    await createVariant(selectedModuleId, newChecklistItemId, newPrompt.trim());
    setNewPrompt('');
    setShowCreateForm(false);
  }, [selectedModuleId, newChecklistItemId, newPrompt, createVariant]);

  const handleMutate = useCallback(async (variantId: string) => {
    await mutateVariant(variantId, selectedMutation);
  }, [mutateVariant, selectedMutation]);

  const handleCluster = useCallback(async () => {
    if (!selectedModuleId) return;
    await clusterPrompts(selectedModuleId);
  }, [selectedModuleId, clusterPrompts]);

  const handleStartTest = useCallback(async (variantAId: string, variantBId: string) => {
    if (!selectedModuleId) return;
    const varA = variants.find((v) => v.id === variantAId);
    if (!varA) return;
    await startABTest(selectedModuleId, varA.checklistItemId, variantAId, variantBId);
  }, [selectedModuleId, variants, startABTest]);

  // Group variants by checklist item
  const variantsByItem = useMemo(() => {
    const map = new Map<string, PromptVariant[]>();
    for (const v of variants) {
      const list = map.get(v.checklistItemId) ?? [];
      list.push(v);
      map.set(v.checklistItemId, list);
    }
    return map;
  }, [variants]);

  const SUB_TABS = [
    { id: 'optimizer' as const, label: 'Optimizer', icon: Wand2 },
    { id: 'variants' as const, label: 'Variants', icon: GitBranch },
    { id: 'tests' as const, label: 'A/B Tests', icon: FlaskConical },
    { id: 'clusters' as const, label: 'Clusters', icon: Layers },
    { id: 'stats' as const, label: 'Stats', icon: BarChart3 },
  ];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Dna className="w-5 h-5" style={{ color: ACCENT }} />
          <h2 className="text-base font-semibold text-text">Prompt Evolution Engine</h2>
          <Badge variant="default" className="text-[10px]">
            {stats.totalVariants} variants
          </Badge>
        </div>

        {/* Module picker */}
        <select
          value={selectedModuleId ?? ''}
          onChange={(e) => setSelectedModule((e.target.value || null) as SubModuleId | null)}
          className="px-3 py-1.5 text-xs rounded-md bg-surface border border-border text-text"
        >
          <option value="">Select module...</option>
          {MODULE_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Suggestions bar */}
      {suggestions.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-surface/50">
          <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
          <div className="space-y-1">
            {suggestions.slice(0, 3).map((s, i) => (
              <p key={i} className="text-xs text-text-muted">{s.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
              activeSubTab === tab.id ? 'text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
            {activeSubTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: ACCENT }} />
            )}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-status-red-strong bg-status-red-subtle text-xs text-red-400">{error}</div>
      )}

      {!isLoading && !error && (
        <>
          {activeSubTab === 'optimizer' && (
            <OptimizerPanel
              selectedModuleId={selectedModuleId}
              lastOptimization={lastOptimization}
              isOptimizing={isOptimizing}
              onOptimize={optimizePromptAction}
            />
          )}

          {activeSubTab === 'variants' && (
            <VariantsPanel
              variantsByItem={variantsByItem}
              selectedModuleId={selectedModuleId}
              showCreateForm={showCreateForm}
              setShowCreateForm={setShowCreateForm}
              newPrompt={newPrompt}
              setNewPrompt={setNewPrompt}
              newChecklistItemId={newChecklistItemId}
              setNewChecklistItemId={setNewChecklistItemId}
              handleCreateVariant={handleCreateVariant}
              isMutating={isMutating}
              selectedMutation={selectedMutation}
              setSelectedMutation={setSelectedMutation}
              handleMutate={handleMutate}
              expandedVariantId={expandedVariantId}
              setExpandedVariantId={setExpandedVariantId}
              handleStartTest={handleStartTest}
            />
          )}

          {activeSubTab === 'tests' && (
            <TestsPanel
              abTests={abTests}
              variants={variants}
              expandedTestId={expandedTestId}
              setExpandedTestId={setExpandedTestId}
              concludeTest={concludeTestAction}
            />
          )}

          {activeSubTab === 'clusters' && (
            <ClustersPanel
              clusters={clusters}
              selectedModuleId={selectedModuleId}
              isClustering={isClustering}
              handleCluster={handleCluster}
            />
          )}

          {activeSubTab === 'stats' && (
            <StatsPanel stats={stats} />
          )}
        </>
      )}
    </div>
  );
}

// ── Variants Panel ──────────────────────────────────────────────────────────

function VariantsPanel({
  variantsByItem,
  selectedModuleId,
  showCreateForm,
  setShowCreateForm,
  newPrompt,
  setNewPrompt,
  newChecklistItemId,
  setNewChecklistItemId,
  handleCreateVariant,
  isMutating,
  selectedMutation,
  setSelectedMutation,
  handleMutate,
  expandedVariantId,
  setExpandedVariantId,
  handleStartTest,
}: {
  variantsByItem: Map<string, PromptVariant[]>;
  selectedModuleId: string | null;
  showCreateForm: boolean;
  setShowCreateForm: (v: boolean) => void;
  newPrompt: string;
  setNewPrompt: (v: string) => void;
  newChecklistItemId: string;
  setNewChecklistItemId: (v: string) => void;
  handleCreateVariant: () => void;
  isMutating: boolean;
  selectedMutation: MutationType;
  setSelectedMutation: (v: MutationType) => void;
  handleMutate: (id: string) => void;
  expandedVariantId: string | null;
  setExpandedVariantId: (id: string | null) => void;
  handleStartTest: (a: string, b: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Create variant button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-surface transition-colors"
        >
          <Plus className="w-3 h-3" />
          New Variant
        </button>
        {!selectedModuleId && (
          <span className="text-xs text-text-muted">Select a module first</span>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreateForm && selectedModuleId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <SurfaceCard level={2} className="p-4 space-y-3">
              <input
                type="text"
                value={newChecklistItemId}
                onChange={(e) => setNewChecklistItemId(e.target.value)}
                placeholder="Checklist item ID (e.g. ac-1)"
                className="w-full px-3 py-1.5 text-xs rounded-md bg-surface border border-border text-text placeholder:text-text-muted"
              />
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Enter the prompt variant text..."
                rows={5}
                className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-text placeholder:text-text-muted resize-none font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateVariant}
                  disabled={!newPrompt.trim() || !newChecklistItemId || isMutating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Plus className="w-3 h-3" />
                  Create
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant groups */}
      {variantsByItem.size === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No variants yet"
          description={selectedModuleId
            ? 'Create a variant from a checklist prompt to start evolving it'
            : 'Select a module to view and manage prompt variants'
          }
        />
      ) : (
        <div className="space-y-3">
          {Array.from(variantsByItem.entries()).map(([itemId, itemVariants]) => (
            <SurfaceCard key={itemId} level={2} className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-medium text-text">{itemId}</span>
                <Badge variant="default" className="text-[10px]">
                  {itemVariants.length} variant{itemVariants.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {itemVariants.map((v, idx) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <VariantCard
                        variant={v}
                        isExpanded={expandedVariantId === v.id}
                        onToggle={() => setExpandedVariantId(expandedVariantId === v.id ? null : v.id)}
                        selectedMutation={selectedMutation}
                        setSelectedMutation={setSelectedMutation}
                        onMutate={() => handleMutate(v.id)}
                        isMutating={isMutating}
                        siblings={itemVariants}
                        onStartTest={handleStartTest}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Variant Card ────────────────────────────────────────────────────────────

function VariantCard({
  variant,
  isExpanded,
  onToggle,
  selectedMutation,
  setSelectedMutation,
  onMutate,
  isMutating,
  siblings,
  onStartTest,
}: {
  variant: PromptVariant;
  isExpanded: boolean;
  onToggle: () => void;
  selectedMutation: MutationType;
  setSelectedMutation: (m: MutationType) => void;
  onMutate: () => void;
  isMutating: boolean;
  siblings: PromptVariant[];
  onStartTest: (a: string, b: string) => void;
}) {
  const styleColor = STYLE_COLORS[variant.style];

  return (
    <div className="rounded-md border border-border/50 bg-surface/30">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-surface/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        )}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: styleColor }} />
        <span className="text-xs font-medium text-text truncate flex-1">{variant.label}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded border" style={{ borderColor: styleColor, color: styleColor }}>
          {variant.style}
        </span>
        <Badge variant="default" className="text-[9px]">
          {variant.origin}
        </Badge>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border/30">
              {/* Prompt preview */}
              <div className="mt-2 p-2 rounded bg-surface/50 max-h-32 overflow-y-auto">
                <pre className="text-[10px] text-text-muted whitespace-pre-wrap font-mono leading-relaxed">
                  {variant.prompt.slice(0, 500)}{variant.prompt.length > 500 ? '...' : ''}
                </pre>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span>{variant.prompt.length} chars</span>
                {variant.parentId && <span>Parent: {variant.parentId.slice(0, 12)}...</span>}
                {variant.mutationType && <span>Mutation: {variant.mutationType}</span>}
                <span>{new Date(variant.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mutate */}
                <select
                  value={selectedMutation}
                  onChange={(e) => setSelectedMutation(e.target.value as MutationType)}
                  className="px-2 py-1 text-[10px] rounded bg-surface border border-border text-text"
                >
                  {MUTATION_OPTIONS.map((m) => (
                    <option key={m.type} value={m.type}>{m.label}</option>
                  ))}
                </select>
                <button
                  onClick={onMutate}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-border hover:bg-surface transition-colors disabled:opacity-40"
                >
                  <Shuffle className="w-3 h-3" />
                  Mutate
                </button>

                {/* Start A/B test */}
                {siblings.length >= 2 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-text-muted">A/B vs:</span>
                    {siblings
                      .filter((s) => s.id !== variant.id)
                      .slice(0, 3)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onStartTest(variant.id, s.id)}
                          className="px-1.5 py-0.5 text-[9px] rounded border border-border hover:bg-surface transition-colors"
                          title={s.label}
                        >
                          <FlaskConical className="w-3 h-3 inline" />
                        </button>
                      ))}
                  </div>
                )}

                {/* Copy */}
                <button
                  onClick={() => navigator.clipboard.writeText(variant.prompt)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-border hover:bg-surface transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tests Panel ─────────────────────────────────────────────────────────────

function TestsPanel({
  abTests,
  variants,
  expandedTestId,
  setExpandedTestId,
  concludeTest,
}: {
  abTests: ABTest[];
  variants: PromptVariant[];
  expandedTestId: string | null;
  setExpandedTestId: (id: string | null) => void;
  concludeTest: (id: string) => Promise<ABTest | null>;
}) {
  const variantMap = useMemo(() => {
    const m = new Map<string, PromptVariant>();
    for (const v of variants) m.set(v.id, v);
    return m;
  }, [variants]);

  if (abTests.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No A/B tests"
        description="Create variants and start an A/B test to compare their effectiveness"
      />
    );
  }

  const running = abTests.filter((t) => t.status === 'running');
  const concluded = abTests.filter((t) => t.status === 'concluded');

  return (
    <div className="space-y-4">
      {running.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-text flex items-center gap-1.5">
            <Play className="w-3 h-3" style={{ color: STATUS_COLORS.running }} />
            Running ({running.length})
          </h3>
          {running.map((test) => (
            <ABTestCard
              key={test.id}
              test={test}
              variantA={variantMap.get(test.variantAId)}
              variantB={variantMap.get(test.variantBId)}
              isExpanded={expandedTestId === test.id}
              onToggle={() => setExpandedTestId(expandedTestId === test.id ? null : test.id)}
              onConclude={() => concludeTest(test.id)}
            />
          ))}
        </div>
      )}

      {concluded.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-text flex items-center gap-1.5">
            <Trophy className="w-3 h-3" style={{ color: STATUS_COLORS.concluded }} />
            Concluded ({concluded.length})
          </h3>
          {concluded.map((test) => (
            <ABTestCard
              key={test.id}
              test={test}
              variantA={variantMap.get(test.variantAId)}
              variantB={variantMap.get(test.variantBId)}
              isExpanded={expandedTestId === test.id}
              onToggle={() => setExpandedTestId(expandedTestId === test.id ? null : test.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── A/B Test Card ───────────────────────────────────────────────────────────

function ABTestCard({
  test,
  variantA,
  variantB,
  isExpanded,
  onToggle,
  onConclude,
}: {
  test: ABTest;
  variantA?: PromptVariant;
  variantB?: PromptVariant;
  isExpanded: boolean;
  onToggle: () => void;
  onConclude?: () => void;
}) {
  const rateA = test.variantATrials > 0 ? test.variantASuccesses / test.variantATrials : 0;
  const rateB = test.variantBTrials > 0 ? test.variantBSuccesses / test.variantBTrials : 0;
  const totalTrials = test.variantATrials + test.variantBTrials;
  const statusColor = STATUS_COLORS[test.status];

  return (
    <SurfaceCard level={2} className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-surface/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        )}
        <FlaskConical className="w-3.5 h-3.5" style={{ color: statusColor }} />
        <span className="text-xs font-medium text-text flex-1">{test.checklistItemId}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded border" style={{ borderColor: statusColor, color: statusColor }}>
          {test.status}
        </span>
        <span className="text-[10px] text-text-muted">{totalTrials} trials</span>
        {test.winnerId && (
          <Trophy className="w-3 h-3 text-yellow-500" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border/30">
              {/* Variant A vs B */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <VariantSlotCard
                  label="Variant A"
                  variant={variantA}
                  trials={test.variantATrials}
                  successes={test.variantASuccesses}
                  totalDurationMs={test.variantATotalDurationMs}
                  rate={rateA}
                  isWinner={test.winnerId === test.variantAId}
                />
                <VariantSlotCard
                  label="Variant B"
                  variant={variantB}
                  trials={test.variantBTrials}
                  successes={test.variantBSuccesses}
                  totalDurationMs={test.variantBTotalDurationMs}
                  rate={rateB}
                  isWinner={test.winnerId === test.variantBId}
                />
              </div>

              {/* Confidence */}
              {test.confidence > 0 && (
                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                  <Target className="w-3 h-3" />
                  <span>Confidence: {Math.round(test.confidence * 100)}%</span>
                </div>
              )}

              {/* Conclude button */}
              {test.status === 'running' && onConclude && totalTrials >= 2 && (
                <button
                  onClick={onConclude}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md text-white transition-colors"
                  style={{ backgroundColor: ACCENT }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Conclude Test
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

function VariantSlotCard({
  label,
  variant,
  trials,
  successes,
  totalDurationMs,
  rate,
  isWinner,
}: {
  label: string;
  variant?: PromptVariant;
  trials: number;
  successes: number;
  totalDurationMs: number;
  rate: number;
  isWinner: boolean;
}) {
  const avgDur = trials > 0 ? Math.round(totalDurationMs / trials / 1000) : 0;

  return (
    <div className={`rounded-md p-2.5 border ${isWinner ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border/50 bg-surface/30'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-medium text-text">{label}</span>
        {isWinner && <Trophy className="w-3 h-3 text-yellow-500" />}
      </div>
      {variant && (
        <p className="text-[9px] text-text-muted mb-1.5 truncate">{variant.label}</p>
      )}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-text">
          {Math.round(rate * 100)}%
        </span>
        <span className="text-text-muted">
          {successes}/{trials}
        </span>
        {avgDur > 0 && (
          <span className="text-text-muted flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {avgDur}s
          </span>
        )}
      </div>
      {/* Rate bar */}
      <div className="mt-1.5 h-1 rounded-full bg-border/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${rate * 100}%`, backgroundColor: isWinner ? '#eab308' : ACCENT }}
        />
      </div>
    </div>
  );
}

// ── Clusters Panel ──────────────────────────────────────────────────────────

function ClustersPanel({
  clusters,
  selectedModuleId,
  isClustering,
  handleCluster,
}: {
  clusters: PromptCluster[];
  selectedModuleId: string | null;
  isClustering: boolean;
  handleCluster: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={handleCluster}
          disabled={!selectedModuleId || isClustering}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-40 transition-colors"
          style={{ backgroundColor: ACCENT }}
        >
          {isClustering ? (
            <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          Analyze Clusters
        </button>
        {!selectedModuleId && (
          <span className="text-xs text-text-muted">Select a module first</span>
        )}
      </div>

      {clusters.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No clusters"
          description="Run cluster analysis on a module to discover prompt patterns that correlate with success"
        />
      ) : (
        <div className="space-y-2">
          {clusters.map((cluster, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <SurfaceCard level={2} className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-xs font-medium text-text capitalize">{cluster.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={cluster.successRate >= 0.7 ? 'success' : cluster.successRate >= 0.4 ? 'warning' : 'error'}
                      className="text-[9px]"
                    >
                      {Math.round(cluster.successRate * 100)}% success
                    </Badge>
                    <span className="text-[10px] text-text-muted">{cluster.sessionIds.length} sessions</span>
                  </div>
                </div>

                {/* Keywords */}
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  {cluster.keywords.map((kw) => (
                    <span key={kw} className="px-1.5 py-0.5 text-[9px] rounded bg-surface border border-border text-text-muted">
                      {kw}
                    </span>
                  ))}
                </div>

                {/* Representative prompt */}
                <p className="text-[10px] text-text-muted font-mono leading-relaxed">
                  {cluster.representative}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                  <span>Avg length: {cluster.avgLength} chars</span>
                </div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Optimizer Panel ──────────────────────────────────────────────────────────

const DIFF_TYPE_CONFIG: Record<string, { icon: typeof Wand2; color: string; label: string }> = {
  'add-context': { icon: ShieldCheck, color: MODULE_COLORS.core, label: 'Context' },
  'restructure': { icon: Shuffle, color: MODULE_COLORS.systems, label: 'Restructure' },
  'add-verification': { icon: CheckCircle2, color: '#10b981', label: 'Verification' },
  'shorten': { icon: ArrowUp, color: MODULE_COLORS.content, label: 'Shorten' },
  'lengthen': { icon: ArrowDown, color: MODULE_COLORS.content, label: 'Lengthen' },
  'imperative-rewrite': { icon: Zap, color: MODULE_COLORS.evaluator, label: 'Imperative' },
};

function OptimizerPanel({
  selectedModuleId,
  lastOptimization,
  isOptimizing,
  onOptimize,
}: {
  selectedModuleId: string | null;
  lastOptimization: PromptOptimizationResult | null;
  isOptimizing: boolean;
  onOptimize: (moduleId: SubModuleId, prompt: string) => Promise<PromptOptimizationResult | null>;
}) {
  const [inputPrompt, setInputPrompt] = useState('');
  const [copiedOptimized, setCopiedOptimized] = useState(false);

  const handleOptimize = useCallback(async () => {
    if (!selectedModuleId || !inputPrompt.trim()) return;
    await onOptimize(selectedModuleId as SubModuleId, inputPrompt.trim());
  }, [selectedModuleId, inputPrompt, onOptimize]);

  const handleCopyOptimized = useCallback(() => {
    if (!lastOptimization?.optimized) return;
    navigator.clipboard.writeText(lastOptimization.optimized);
    setCopiedOptimized(true);
    setTimeout(() => setCopiedOptimized(false), UI_TIMEOUTS.copyFeedback);
  }, [lastOptimization]);

  return (
    <div className="space-y-5">
      {/* Input section */}
      <SurfaceCard level={2} className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4" style={{ color: ACCENT }} />
          <h3 className="text-xs font-semibold text-text">Prompt Optimizer</h3>
          <span className="text-[10px] text-text-muted">Paste a prompt to auto-optimize based on session history</span>
        </div>

        <textarea
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Paste your CLI prompt here to see how the optimizer would improve it..."
          rows={6}
          className="w-full px-3 py-2 text-xs rounded-md bg-surface border border-border text-text placeholder:text-text-muted resize-none font-mono leading-relaxed"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleOptimize}
            disabled={!selectedModuleId || !inputPrompt.trim() || isOptimizing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: ACCENT }}
          >
            {isOptimizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            {isOptimizing ? 'Optimizing...' : 'Optimize Prompt'}
          </button>
          {!selectedModuleId && (
            <span className="text-[10px] text-text-muted">Select a module first</span>
          )}
        </div>
      </SurfaceCard>

      {/* Results section */}
      <AnimatePresence mode="wait">
        {lastOptimization && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Summary bar */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/50">
              {lastOptimization.wasModified ? (
                <>
                  <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text">
                      {lastOptimization.diffs.length} optimization{lastOptimization.diffs.length !== 1 ? 's' : ''} applied
                    </p>
                    <p className="text-[10px] text-text-muted">
                      Based on {lastOptimization.sampleSize} historical sessions
                      {lastOptimization.predictedImprovement > 0 && (
                        <> — predicted +{Math.round(lastOptimization.predictedImprovement * 100)}% success rate</>
                      )}
                    </p>
                  </div>
                  <ProgressRing
                    value={Math.min(Math.round(lastOptimization.predictedImprovement * 200), 100)}
                    size={36}
                    strokeWidth={3}
                    color={ACCENT}
                    label={`+${Math.round(lastOptimization.predictedImprovement * 100)}%`}
                  />
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-text-muted" />
                  <p className="text-xs text-text-muted">
                    No optimizations needed — your prompt already follows best practices
                    {lastOptimization.sampleSize > 0 && ` (based on ${lastOptimization.sampleSize} sessions)`}
                  </p>
                </>
              )}
            </div>

            {/* Diffs breakdown */}
            {lastOptimization.diffs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-text flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  Changes Applied
                </h4>
                {lastOptimization.diffs.map((diff, i) => {
                  const config = DIFF_TYPE_CONFIG[diff.type] ?? { icon: Wand2, color: ACCENT, label: diff.type };
                  const DiffIcon = config.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <SurfaceCard level={2} className="p-3">
                        <div className="flex items-start gap-2.5">
                          <div
                            className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${config.color}15`, color: config.color }}
                          >
                            <DiffIcon className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-text">{diff.description}</span>
                              <span
                                className="px-1.5 py-0.5 text-[9px] font-medium rounded"
                                style={{ backgroundColor: `${config.color}15`, color: config.color }}
                              >
                                {config.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted leading-relaxed">{diff.reason}</p>
                          </div>
                        </div>
                      </SurfaceCard>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Before / After diff view */}
            {lastOptimization.wasModified && (
              <div className="grid grid-cols-2 gap-3">
                {/* Before */}
                <SurfaceCard level={2} className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-400/70" />
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Original</span>
                    <span className="text-[10px] text-text-muted ml-auto">{lastOptimization.original.length} chars</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded bg-surface/50 p-2">
                    <pre className="text-[10px] text-text-muted/80 whitespace-pre-wrap font-mono leading-relaxed">
                      {lastOptimization.original.slice(0, 1200)}
                      {lastOptimization.original.length > 1200 ? '\n...' : ''}
                    </pre>
                  </div>
                </SurfaceCard>

                {/* After */}
                <SurfaceCard level={2} className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Optimized</span>
                    <span className="text-[10px] text-text-muted ml-auto">{lastOptimization.optimized.length} chars</span>
                    <button
                      onClick={handleCopyOptimized}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded border border-border hover:bg-surface transition-colors"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      {copiedOptimized ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded p-2" style={{ backgroundColor: `${ACCENT}08` }}>
                    <pre className="text-[10px] text-text whitespace-pre-wrap font-mono leading-relaxed">
                      {lastOptimization.optimized.slice(0, 1200)}
                      {lastOptimization.optimized.length > 1200 ? '\n...' : ''}
                    </pre>
                  </div>
                </SurfaceCard>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state when no optimization has been run yet */}
      {!lastOptimization && !isOptimizing && (
        <EmptyState
          icon={Wand2}
          title="Self-Learning Optimizer"
          description="Paste a prompt above and select a module to see how the optimizer rewrites it based on historical success patterns. Every CLI interaction improves future suggestions."
        />
      )}
    </div>
  );
}

// ── Stats Panel ─────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: EvolutionStats }) {
  return (
    <div className="space-y-4">
      {/* Global stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Variants" value={stats.totalVariants} icon={GitBranch} />
        <StatCard label="Active Tests" value={stats.activeABTests} icon={FlaskConical} color={STATUS_COLORS.running} />
        <StatCard label="Concluded" value={stats.concludedABTests} icon={Trophy} color={STATUS_COLORS.concluded} />
        <StatCard
          label="Avg Improvement"
          value={`${stats.avgImprovementRate > 0 ? '+' : ''}${Math.round(stats.avgImprovementRate * 100)}%`}
          icon={TrendingUp}
          color={stats.avgImprovementRate > 0 ? ACCENT : STATUS_NEUTRAL}
        />
      </div>

      {/* Module breakdown */}
      {stats.moduleBreakdown.length > 0 ? (
        <SurfaceCard level={2} className="p-4">
          <h3 className="text-xs font-medium text-text mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            Module Breakdown
          </h3>
          <div className="space-y-2">
            {stats.moduleBreakdown.map((m) => (
              <div key={m.moduleId} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-xs text-text w-28 truncate">{m.moduleId}</span>
                <Badge variant="default" className="text-[9px]">{m.variants} var</Badge>
                <Badge variant="default" className="text-[9px]">{m.activeTests} tests</Badge>
                <div className="flex-1 h-1.5 rounded-full bg-border/30 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(m.bestSuccessRate * 100, 2)}%`,
                      backgroundColor: ACCENT,
                    }}
                  />
                </div>
                <span className="text-[10px] text-text-muted w-12 text-right">
                  {Math.round(m.bestSuccessRate * 100)}%
                </span>
                {m.improvement > 0 && (
                  <span className="text-[10px] font-medium" style={{ color: ACCENT }}>
                    +{Math.round(m.improvement * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No evolution data yet"
          description="Create prompt variants and run A/B tests to see per-module improvement stats"
        />
      )}

      {stats.topPerformingModule && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface/50">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-xs text-text">
            Top performing module: <strong>{stats.topPerformingModule}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color = ACCENT,
}: {
  label: string;
  value: number | string;
  icon: typeof BarChart3;
  color?: string;
}) {
  return (
    <SurfaceCard level={2} className="p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] text-text-muted">{label}</span>
      </div>
      <span className="text-lg font-semibold text-text">{value}</span>
    </SurfaceCard>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BarChart3;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-8 h-8 text-text-muted/30 mb-3" />
      <p className="text-sm font-medium text-text-muted mb-1">{title}</p>
      <p className="text-xs text-text-muted/70 max-w-xs">{description}</p>
    </div>
  );
}
