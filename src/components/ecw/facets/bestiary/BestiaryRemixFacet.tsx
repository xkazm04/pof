'use client';

import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { buildRemixPrompt } from '@/lib/bestiary/remix-prompt';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Remix facet (ECW Phase 10-B) — describe an archetype variation in plain
 * language ("make a fire elite", "give it a charge attack") and dispatch a CLI
 * session to author it (subclass AARPGEnemyCharacter, reuse GAS + BT). Demos
 * the CLI-dispatch enhancement-facet template (vs the pure-function facets).
 */
export function BestiaryRemixFacet({ entity }: Props) {
  const [instruction, setInstruction] = useState('');
  const cli = useModuleCLI({
    moduleId: 'arpg-enemy-ai',
    sessionKey: `gen-${entity.id}`,
    label: `Remix ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const dispatch = () => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    void cli.execute(
      TaskFactory.quickAction('arpg-enemy-ai', buildRemixPrompt(entity.name, entity.catalogId, trimmed), `Remix ${entity.name}`),
    );
  };

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Remix with Claude</span>
      </div>
      <p className="text-2xs text-text-muted/70">
        Describe a variation of {entity.name}; Claude authors it into the UE project.
      </p>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. make a fire-themed elite that summons adds at 50% HP"
        rows={3}
        className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
      />
      <button
        onClick={dispatch}
        disabled={cli.isRunning || instruction.trim().length === 0}
        className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wand2 className="w-3.5 h-3.5" />
        <span>{cli.isRunning ? 'Authoring…' : 'Remix with Claude'}</span>
      </button>
    </div>
  );
}

registerFacet('bestiary', { id: 'remix', label: 'Remix', Component: BestiaryRemixFacet });
