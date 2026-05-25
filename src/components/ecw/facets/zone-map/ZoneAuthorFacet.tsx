'use client';

import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { buildZonePrompt } from '@/lib/world/zone-prompt';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Zone Author facet (ECW Phase 10-F) — describe a zone change in plain language
 * ("add a hidden side-path to the boss", "raise the level range to 8-10") and
 * dispatch a CLI session to author it via the existing world/streaming setup.
 * The CLI-dispatch template applied to zone-map (module `arpg-world`).
 */
export function ZoneAuthorFacet({ entity }: Props) {
  const [instruction, setInstruction] = useState('');
  const cli = useModuleCLI({
    moduleId: 'arpg-world',
    sessionKey: `gen-${entity.id}`,
    label: `Author ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const dispatch = () => {
    void cli.execute(
      TaskFactory.quickAction('arpg-world', buildZonePrompt(entity.name, instruction), `Author ${entity.name}`),
    );
  };

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Author with Claude</span>
      </div>
      <p className="text-2xs text-text-muted/70">
        Describe how {entity.name} should change; Claude authors the zone in the UE project.
      </p>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. add a hidden side-path to the boss arena, raise the level range to 8-10"
        rows={3}
        className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
      />
      <button
        onClick={dispatch}
        disabled={cli.isRunning}
        className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wand2 className="w-3.5 h-3.5" />
        <span>{cli.isRunning ? 'Authoring…' : 'Author zone with Claude'}</span>
      </button>
    </div>
  );
}

registerFacet('zone-map', { id: 'author', label: 'Author', Component: ZoneAuthorFacet });
