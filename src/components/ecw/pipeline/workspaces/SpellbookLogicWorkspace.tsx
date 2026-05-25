'use client';

import { useState, type ReactNode } from 'react';
import { Tag, Swords, Timer, Droplet, Sparkles, ShieldAlert } from 'lucide-react';
import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { calculateDamage, formulaPreview } from '@/lib/ability/damage-formula';
import { buildLogicChangePrompt, type LogicAspect, type AbilityRef } from '@/lib/ability/logic-prompts';
import type { TrackWorkspaceProps } from '@/components/ecw/inspector/trackWorkspaceRegistry';

interface AbilityData {
  name?: string; category?: string; element?: string; tier?: string;
  damage?: number; manaCost?: number; cooldown?: number; color?: string; tag?: string;
}

/** Element → the GameplayEffect this ability implies (display hint). */
const ELEMENT_GE: Record<string, string> = {
  Fire: 'GE_Fire_DoT', Ice: 'GE_Ice_Slow', Lightning: 'GE_Lightning_Chain', Shadow: 'GE_Shadow_Drain',
  Holy: 'GE_Holy_Heal', Physical: 'GE_Physical_Impact', Arcane: 'GE_Arcane_Burst', Nature: 'GE_Nature_Root',
};

function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="text-2xs px-2 py-0.5 rounded-full bg-surface text-text-muted" style={color ? { color } : undefined}>
      {children}
    </span>
  );
}

function StatBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 rounded-full bg-surface overflow-hidden w-full">
      <div className="h-full bg-emerald-500/70" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function Card({ icon, title, children, onChange, action, busy }: {
  icon: ReactNode; title: string; children: ReactNode; onChange: () => void; action: string; busy: boolean;
}) {
  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-3 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        <button
          onClick={onChange}
          disabled={busy}
          className="focus-ring ml-auto px-2 py-1 rounded text-2xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50"
        >
          {busy ? 'Dispatching…' : action}
        </button>
      </div>
      {children}
    </section>
  );
}

/**
 * Spellbook Logic editor (ECW sub-project C pilot). Six aspect cards displaying
 * the ability's real state (reusing the extracted damage calc + themed display
 * bits) with per-aspect CLI-to-change — the source (UARPGGameplayAbility /
 * DT_AbilityCatalog) is edited via Claude, since catalog data is seeded read-only.
 */
export function SpellbookLogicWorkspace({ entity }: TrackWorkspaceProps) {
  const a = (entity.data ?? {}) as AbilityData;
  const [instruction, setInstruction] = useState('');
  const cli = useModuleCLI({
    moduleId: 'arpg-gas',
    sessionKey: `gen-${entity.id}`,
    label: `Logic · ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const ref: AbilityRef = {
    name: entity.name,
    element: a.element ?? '',
    tag: a.tag ?? '',
    category: a.category ?? '',
    tier: a.tier ?? '',
  };
  const change = (aspect: LogicAspect) =>
    void cli.execute(TaskFactory.quickAction('arpg-gas', buildLogicChangePrompt(aspect, ref, instruction), `Logic · ${entity.name}`));

  const damage = a.damage ?? 0;
  const manaCost = a.manaCost ?? 0;
  const cooldown = a.cooldown ?? 0;
  const ge = a.element ? ELEMENT_GE[a.element] ?? `GE_${a.element}` : '—';

  return (
    <div>
      <PipelineTrackDetail entity={entity} trackId="logic" />

      <div className="px-4 py-3 space-y-3">
        <Card icon={<Tag className="w-4 h-4 text-text-muted" />} title="Type" action="Reclassify" busy={cli.isRunning} onChange={() => change('type')}>
          <div className="flex flex-wrap items-center gap-1.5">
            {a.category && <Badge>{a.category}</Badge>}
            {a.element && <Badge color={a.color}>{a.element}</Badge>}
            {a.tier && <Badge>{a.tier}</Badge>}
          </div>
          {a.tag && <div className="text-2xs font-mono text-text-muted">{a.tag}</div>}
        </Card>

        <Card icon={<Swords className="w-4 h-4 text-text-muted" />} title="Damage" action="Tune damage" busy={cli.isRunning} onChange={() => change('damage')}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text font-semibold">{damage}</span>
            <StatBar value={damage} max={100} />
          </div>
          <div className="text-2xs text-text-muted">{formulaPreview({ damage })} · e.g. vs 50 armor ≈ {Math.round(calculateDamage(damage, 100, 50, 15, 1.5))}</div>
        </Card>

        <Card icon={<Timer className="w-4 h-4 text-text-muted" />} title="Cooldown" action="Change cooldown" busy={cli.isRunning} onChange={() => change('cooldown')}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text font-semibold">{cooldown}s</span>
            <StatBar value={cooldown} max={30} />
          </div>
        </Card>

        <Card icon={<Droplet className="w-4 h-4 text-text-muted" />} title="Cost" action="Tune cost" busy={cli.isRunning} onChange={() => change('cost')}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text font-semibold">{manaCost}</span>
            <StatBar value={manaCost} max={100} />
            <span className="text-text-muted text-2xs">mana</span>
          </div>
        </Card>

        <Card icon={<Sparkles className="w-4 h-4 text-text-muted" />} title="Effect Mapping" action="Author effects" busy={cli.isRunning} onChange={() => change('effects')}>
          <div className="text-xs text-text-muted">
            element-implied effect: <span className="font-mono text-text">{ge}</span>
          </div>
        </Card>

        <Card icon={<ShieldAlert className="w-4 h-4 text-text-muted" />} title="Requirements" action="Author requirements" busy={cli.isRunning} onChange={() => change('requirements')}>
          <div className="text-xs text-text-muted">Blocked while Dead / Stunned (default activation tags){a.tag ? '.' : ''}</div>
        </Card>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="optional: describe the change for any aspect above before clicking it"
          rows={2}
          className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
        />
      </div>
    </div>
  );
}
