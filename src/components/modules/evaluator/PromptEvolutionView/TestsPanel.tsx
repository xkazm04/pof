import { useMemo } from 'react';
import { FlaskConical, Play, Trophy } from 'lucide-react';
import { StatTerm } from '@/components/ui/StatTerm';
import type { PromptVariant, ABTest } from '@/types/prompt-evolution';
import { STATUS_COLORS, type ViewMode } from './constants';
import { ABTestCard } from './ABTestCard';
import { EmptyState } from './EmptyState';

// ── Tests Panel ─────────────────────────────────────────────────────────────

export function TestsPanel({
  abTests,
  variants,
  expandedTestId,
  setExpandedTestId,
  concludeTest,
  mode,
}: {
  abTests: ABTest[];
  variants: PromptVariant[];
  expandedTestId: string | null;
  setExpandedTestId: (id: string | null) => void;
  concludeTest: (id: string) => Promise<ABTest | null>;
  mode: ViewMode;
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
        title="No A/B tests yet"
        description="Create variants and start an A/B test to compare their effectiveness."
      />
    );
  }

  const running = abTests.filter((t) => t.status === 'running');
  const concluded = abTests.filter((t) => t.status === 'concluded');

  return (
    <div className="space-y-4">
      {/* Advanced-only "how it works" line surfaces the engine's jargon as
          hover tooltips; Simple Mode hides it entirely. */}
      {mode === 'advanced' && (
        <p className="text-xs text-text-muted leading-relaxed">
          Each variant is served using an{' '}
          <StatTerm term="epsilon-greedy">epsilon-greedy</StatTerm> strategy, then compared with a{' '}
          <StatTerm term="z-test">z-test</StatTerm> to decide a winner.
        </p>
      )}

      {running.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-text flex items-center gap-1.5">
            <Play className="w-3 h-3" style={{ color: STATUS_COLORS.running }} />
            {mode === 'simple' ? 'Testing' : 'Running'} ({running.length})
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
              mode={mode}
            />
          ))}
        </div>
      )}

      {concluded.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-text flex items-center gap-1.5">
            <Trophy className="w-3 h-3" style={{ color: STATUS_COLORS.concluded }} />
            {mode === 'simple' ? 'Decided' : 'Concluded'} ({concluded.length})
          </h3>
          {concluded.map((test) => (
            <ABTestCard
              key={test.id}
              test={test}
              variantA={variantMap.get(test.variantAId)}
              variantB={variantMap.get(test.variantBId)}
              isExpanded={expandedTestId === test.id}
              onToggle={() => setExpandedTestId(expandedTestId === test.id ? null : test.id)}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
