import {
  Shuffle, ChevronDown, ChevronRight, Copy, FlaskConical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import type { PromptVariant, MutationType } from '@/types/prompt-evolution';
import { MUTATION_OPTIONS } from '@/lib/prompt-evolution/mutations';
import { STYLE_COLORS } from './constants';

// ── Variant Card ────────────────────────────────────────────────────────────

export function VariantCard({
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
        <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border" style={{ borderColor: styleColor, color: styleColor }}>
          {variant.style}
        </span>
        <Badge variant="default" className="text-[11px]">
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
                <pre className="text-xs text-text-muted whitespace-pre-wrap font-mono leading-relaxed">
                  {variant.prompt.slice(0, 500)}{variant.prompt.length > 500 ? '...' : ''}
                </pre>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-3 text-xs text-text-muted">
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
                  className="px-2 py-1 text-xs rounded bg-surface border border-border text-text"
                >
                  {MUTATION_OPTIONS.map((m) => (
                    <option key={m.type} value={m.type}>{m.label}</option>
                  ))}
                </select>
                <button
                  onClick={onMutate}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border hover:bg-surface transition-colors disabled:opacity-40"
                >
                  <Shuffle className="w-3 h-3" />
                  Mutate
                </button>

                {/* Start A/B test */}
                {siblings.length >= 2 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-text-muted">A/B vs:</span>
                    {siblings
                      .filter((s) => s.id !== variant.id)
                      .slice(0, 3)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onStartTest(variant.id, s.id)}
                          className="px-1.5 py-0.5 text-[11px] rounded border border-border hover:bg-surface transition-colors"
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
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border hover:bg-surface transition-colors"
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
