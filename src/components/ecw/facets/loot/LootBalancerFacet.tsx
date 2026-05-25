'use client';

import { useMemo, useState } from 'react';
import { Target, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { asLootBinding, computeExpectedValue, RARITY_ORDER } from '@/lib/loot/economy';
import { solveWeightsForTargetEV } from '@/lib/loot/auto-balancer';
import { buildLootPrompt } from '@/lib/loot/loot-author-prompt';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

function archetypeNameOf(entity: StoredCatalogEntity): string {
  const d = entity.data as { archetypeName?: unknown } | undefined;
  return d && typeof d.archetypeName === 'string' && d.archetypeName ? d.archetypeName : 'this enemy';
}

/**
 * Loot Goal-Seek Balancer facet (ECW Phase 10-L round 2). Designer sets a target
 * gold/kill; `solveWeightsForTargetEV` proposes the rarity-weight distribution
 * that reaches it (closed-form). Shows the current→proposed weight diff +
 * reachability, and dispatches a CLI session to apply it. Pure-function +
 * CLI-dispatch templates combined; the one-click-fix evolution of Economy lint.
 */
export function LootBalancerFacet({ entity }: Props) {
  const binding = useMemo(() => asLootBinding(entity.data), [entity.data]);
  const currentEV = useMemo(() => (binding ? computeExpectedValue(binding) : 0), [binding]);
  const [target, setTarget] = useState<number | null>(null);

  const cli = useModuleCLI({
    moduleId: 'arpg-loot',
    sessionKey: `gen-${entity.id}`,
    label: `Rebalance ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const effectiveTarget = target ?? currentEV;
  const proposal = useMemo(
    () => (binding ? solveWeightsForTargetEV(binding, effectiveTarget) : null),
    [binding, effectiveTarget],
  );

  if (!binding || !proposal) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No loot binding to balance.</div>;
  }

  const apply = () => {
    const instruction = `Retune the rarity weights to [${proposal.weights.join(', ')}] (Common→Legendary) to target ~${effectiveTarget} gold per kill. Keep drop chance and bonus gold unless that can't reach the target.`;
    void cli.execute(
      TaskFactory.quickAction('arpg-loot', buildLootPrompt(entity.name, archetypeNameOf(entity), instruction), `Rebalance ${entity.name}`),
    );
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Goal-Seek Balancer</span>
        <span className="ml-auto text-xs text-text-muted">now {currentEV}g</span>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-muted">
        Target gold / kill
        <input
          type="number"
          value={effectiveTarget}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="focus-ring w-20 bg-surface-deep border border-border/50 rounded px-1.5 py-0.5 text-text"
        />
      </label>

      <div className="flex items-center gap-2 text-2xs font-mono">
        {proposal.reachable ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        )}
        <span className="text-text">Proposed reaches {proposal.achievedEV}g</span>
      </div>
      <p className="text-2xs text-text-muted/70">{proposal.note}</p>

      <div className="space-y-1">
        <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Weight diff (Common→Legendary)</div>
        {RARITY_ORDER.map((rarity, i) => {
          const before = Math.round((binding.rarityWeights[i] ?? 0));
          const after = proposal.weights[i] ?? 0;
          const changed = before !== after;
          return (
            <div key={rarity} className="flex items-center gap-2 text-2xs font-mono">
              <span className="w-20 truncate text-text-muted">{rarity}</span>
              <span className="text-text-muted/60">{before}</span>
              <ArrowRight className="w-3 h-3 text-text-muted/40" />
              <span className={changed ? 'text-text font-semibold' : 'text-text-muted/60'}>{after}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={apply}
        disabled={cli.isRunning}
        className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Target className="w-3.5 h-3.5" />
        <span>{cli.isRunning ? 'Applying…' : 'Apply via Claude'}</span>
      </button>
    </div>
  );
}

registerFacet('loot-tables', { id: 'balancer', label: 'Balancer', Component: LootBalancerFacet });
