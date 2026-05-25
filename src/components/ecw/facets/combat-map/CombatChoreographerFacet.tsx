'use client';

import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { buildComboPrompt } from '@/lib/combat/combo-prompt';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

function weaponOf(entity: StoredCatalogEntity): string {
  const d = entity.data as { weaponCategory?: unknown } | undefined;
  return d && typeof d.weaponCategory === 'string' && d.weaponCategory ? d.weaponCategory : 'melee';
}

/**
 * Combo Choreographer facet (ECW Phase 10-C) — describe a combo variation in
 * plain language ("add a launcher finisher", "make it cancellable into a dodge")
 * and dispatch a CLI session to author it via the existing montage/GAS combo
 * system. The CLI-dispatch template applied to combat-map (cf. Loot Author).
 */
export function CombatChoreographerFacet({ entity }: Props) {
  const [instruction, setInstruction] = useState('');
  const cli = useModuleCLI({
    moduleId: 'arpg-combat',
    sessionKey: `gen-${entity.id}`,
    label: `Choreograph ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const dispatch = () => {
    void cli.execute(
      TaskFactory.quickAction('arpg-combat', buildComboPrompt(entity.name, weaponOf(entity), instruction), `Choreograph ${entity.name}`),
    );
  };

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Choreograph with Claude</span>
      </div>
      <p className="text-2xs text-text-muted/70">
        Describe how {entity.name} should change; Claude authors the montage/GAS combo in the UE project.
      </p>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. add a launcher finisher, make the 2nd hit cancellable into a dodge"
        rows={3}
        className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
      />
      <button
        onClick={dispatch}
        disabled={cli.isRunning}
        className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wand2 className="w-3.5 h-3.5" />
        <span>{cli.isRunning ? 'Authoring…' : 'Choreograph with Claude'}</span>
      </button>
    </div>
  );
}

registerFacet('combat-map', { id: 'choreographer', label: 'Choreograph', Component: CombatChoreographerFacet });
