import { useState, useCallback } from 'react';
import {
  Sparkles, Trophy, ArrowRight, Layers, Target, FlaskConical, Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type {
  PromptVariant, EvolutionSuggestion, MutationType,
} from '@/types/prompt-evolution';
import { MODULE_COLORS, ACCENT_EMERALD_DARK, STATUS_WARNING, ACCENT_PURPLE } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { toast } from 'sonner';

// ── Suggestions Bar ─────────────────────────────────────────────────────────

type SuggestionType = EvolutionSuggestion['type'];

const SUGGESTION_CONFIG: Record<
  SuggestionType,
  { icon: typeof Sparkles; color: string; label: string; actionLabel: string }
> = {
  'try-variant':    { icon: Sparkles,     color: ACCENT_EMERALD_DARK,  label: 'Try Variant',     actionLabel: 'Spawn mutation' },
  'start-ab-test':  { icon: FlaskConical, color: MODULE_COLORS.content, label: 'Start A/B Test', actionLabel: 'Open in Variants' },
  'adopt-winner':   { icon: Trophy,       color: STATUS_WARNING,        label: 'Adopt Winner',    actionLabel: 'Copy best prompt' },
  'cluster-insight':{ icon: Layers,       color: ACCENT_PURPLE,         label: 'Cluster Insight', actionLabel: 'Analyze clusters' },
};

export function SuggestionsBar({
  suggestions,
  onMutate,
  onCluster,
  onAdoptWinner,
  onNavigateVariants,
  onNavigateClusters,
}: {
  suggestions: EvolutionSuggestion[];
  onMutate: (variantId: string, mutation: MutationType) => Promise<PromptVariant | null>;
  onCluster: (moduleId: SubModuleId) => Promise<void>;
  onAdoptWinner: (moduleId: SubModuleId, checklistItemId: string) => Promise<void>;
  onNavigateVariants: (variantId?: string) => void;
  onNavigateClusters: () => void;
}) {
  return (
    <div className="space-y-2" role="list" aria-label="Evolution suggestions">
      {suggestions.slice(0, 4).map((s, i) => (
        <SuggestionCard
          key={`${s.type}-${s.moduleId}-${s.checklistItemId ?? 'na'}-${s.variantId ?? 'na'}-${i}`}
          suggestion={s}
          index={i}
          onMutate={onMutate}
          onCluster={onCluster}
          onAdoptWinner={onAdoptWinner}
          onNavigateVariants={onNavigateVariants}
          onNavigateClusters={onNavigateClusters}
        />
      ))}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  index,
  onMutate,
  onCluster,
  onAdoptWinner,
  onNavigateVariants,
  onNavigateClusters,
}: {
  suggestion: EvolutionSuggestion;
  index: number;
  onMutate: (variantId: string, mutation: MutationType) => Promise<PromptVariant | null>;
  onCluster: (moduleId: SubModuleId) => Promise<void>;
  onAdoptWinner: (moduleId: SubModuleId, checklistItemId: string) => Promise<void>;
  onNavigateVariants: (variantId?: string) => void;
  onNavigateClusters: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cfg = SUGGESTION_CONFIG[suggestion.type];
  const Icon = cfg.icon;
  const confidencePct = Math.round(suggestion.confidence * 100);

  // Per-type action: returns true when nothing to do (button stays disabled).
  const canAct = (() => {
    switch (suggestion.type) {
      case 'try-variant':    return Boolean(suggestion.variantId);
      case 'start-ab-test':  return Boolean(suggestion.variantId);
      case 'adopt-winner':   return Boolean(suggestion.checklistItemId);
      case 'cluster-insight':return true;
    }
  })();

  const handleAction = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      switch (suggestion.type) {
        case 'try-variant': {
          if (!suggestion.variantId) return;
          const next = await onMutate(suggestion.variantId, 'imperative-rewrite');
          if (next) {
            toast.success(`Spawned mutation “${next.label}”`);
            onNavigateVariants(next.id);
          }
          return;
        }
        case 'start-ab-test': {
          onNavigateVariants(suggestion.variantId);
          toast.info('Pick a partner variant to start the test.');
          return;
        }
        case 'adopt-winner': {
          if (!suggestion.checklistItemId) return;
          await onAdoptWinner(suggestion.moduleId, suggestion.checklistItemId);
          return;
        }
        case 'cluster-insight': {
          onNavigateClusters();
          await onCluster(suggestion.moduleId);
          return;
        }
      }
    } finally {
      setBusy(false);
    }
  }, [busy, suggestion, onMutate, onCluster, onAdoptWinner, onNavigateVariants, onNavigateClusters]);

  return (
    <motion.div
      role="listitem"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.22 }}
      className="flex items-start gap-3 p-3 pl-3.5 rounded-lg border border-border bg-surface/50"
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      <div
        className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
        aria-hidden
      >
        <Icon className="w-3.5 h-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold text-text">{cfg.label}</span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium"
            style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
            title={`Confidence: ${confidencePct}%`}
          >
            <Target className="w-2.5 h-2.5" />
            {confidencePct}%
          </span>
          {suggestion.checklistItemId && (
            <span className="text-2xs text-text-muted truncate">{suggestion.checklistItemId}</span>
          )}
        </div>
        <p className="text-xs text-text-muted leading-relaxed">{suggestion.message}</p>
      </div>

      <button
        onClick={handleAction}
        disabled={busy || !canAct}
        aria-label={cfg.actionLabel}
        className="focus-ring flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-40 transition-colors flex-shrink-0 self-center"
        style={{ backgroundColor: cfg.color }}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
        {cfg.actionLabel}
      </button>
    </motion.div>
  );
}
