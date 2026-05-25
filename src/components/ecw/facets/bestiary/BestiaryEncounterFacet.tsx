'use client';

import { useMemo, useState } from 'react';
import { Swords, Crown } from 'lucide-react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { suggestEncounterMix, buildEncounterPrompt, type EncounterUnit } from '@/lib/bestiary/encounter-mix';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/** Read role/tier off an archetype entity; null if it isn't shaped like one. */
function toUnit(e: StoredCatalogEntity): EncounterUnit | null {
  const d = e.data as { role?: unknown; tier?: unknown } | undefined;
  if (!d || typeof d.role !== 'string' || typeof d.tier !== 'string') return null;
  return { id: e.id, name: e.name, role: d.role, tier: d.tier };
}

/**
 * Encounter Director facet (ECW Phase 10-B, idea 3e817d61). Suggests a
 * role-balanced fight built around this archetype (pure `suggestEncounterMix`
 * over the live roster — none tougher than the focus), then dispatches a CLI
 * session to author it in UE. Combines the pure-function + CLI-dispatch templates.
 */
export function BestiaryEncounterFacet({ entity }: Props) {
  const roster = useCatalogEntities('bestiary');
  const [size, setSize] = useState(4);
  const [instruction, setInstruction] = useState('');

  const cli = useModuleCLI({
    moduleId: 'arpg-enemy-ai',
    sessionKey: `encounter-${entity.id}`,
    label: `Encounter · ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const mix = useMemo(() => {
    const focus = toUnit(entity);
    if (!focus) return null;
    const units = roster
      .map((e) => toUnit(e as StoredCatalogEntity))
      .filter((u): u is EncounterUnit => u !== null);
    return suggestEncounterMix(focus, units, size);
  }, [entity, roster, size]);

  if (!mix) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No archetype role/tier to compose an encounter.</div>;
  }

  const dispatch = () => {
    void cli.execute(
      TaskFactory.quickAction('arpg-enemy-ai', buildEncounterPrompt(entity.name, mix, instruction), `Encounter · ${entity.name}`),
    );
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Swords className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Encounter Director</span>
        <label className="ml-auto flex items-center gap-1.5 text-2xs font-mono text-text-muted">
          Size
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="focus-ring bg-surface-deep border border-border/50 rounded px-1 py-0.5 text-text"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Suggested composition</div>
        {mix.map((slot, i) => (
          <div key={`${slot.entityId ?? slot.name}-${i}`} className="flex items-center gap-2 text-2xs font-mono">
            {slot.isFocus ? (
              <Crown className="w-3 h-3 text-amber-400" />
            ) : (
              <span className="w-3 text-center text-text-muted/40">·</span>
            )}
            <span className={slot.isFocus ? 'text-text font-semibold' : 'text-text'}>{slot.name}</span>
            <span className="ml-auto text-text-muted/60 uppercase">{slot.role}</span>
          </div>
        ))}
      </div>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="optional intent — e.g. a rooftop ambush that funnels the player toward the focus"
        rows={2}
        className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
      />
      <button
        onClick={dispatch}
        disabled={cli.isRunning}
        className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Swords className="w-3.5 h-3.5" />
        <span>{cli.isRunning ? 'Authoring encounter…' : 'Author encounter with Claude'}</span>
      </button>
    </div>
  );
}

registerFacet('bestiary', { id: 'encounter', label: 'Encounter', Component: BestiaryEncounterFacet });
