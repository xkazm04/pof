'use client';

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { Tag, Swords, Timer, Droplet, Sparkles, ShieldAlert } from 'lucide-react';
import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import { EffectTimelineEditor } from '@/components/modules/core-engine/sub_ability/blueprint/EffectTimelineEditor';
import { TagRulesEditor } from '@/components/modules/core-engine/sub_ability/blueprint/TagRulesEditor';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { UI_TIMEOUTS, getAppOrigin } from '@/lib/constants';
import { calculateDamage, formulaPreview } from '@/lib/ability/damage-formula';
import { buildLogicChangePrompt, type LogicAspect, type AbilityRef } from '@/lib/ability/logic-prompts';
import { deriveDefaultSpec, type EnrichedAbilitySpec, type EditorEffect, type TagRule } from '@/lib/ability/spec';
import { useAbilitySpecStore, useEntityAbilitySpec } from '@/stores/abilitySpecStore';
import type { TrackWorkspaceProps } from '@/components/ecw/inspector/trackWorkspaceRegistry';

interface AbilityData {
  name?: string; category?: string; element?: string; tier?: string;
  damage?: number; manaCost?: number; cooldown?: number; color?: string; tag?: string;
}

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
  icon: ReactNode; title: string; children: ReactNode; onChange?: () => void; action?: string; busy?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-3 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        {onChange && action && (
          <button
            onClick={onChange}
            disabled={busy}
            className="focus-ring ml-auto px-2 py-1 rounded text-2xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50"
          >
            {busy ? 'Dispatching…' : action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Spellbook Logic editor (ECW sub-project C + B2). The four scalar cards
 * (Type/Damage/Cooldown/Cost) display the catalog state with per-aspect
 * CLI-to-change (the source is seeded read-only, so changes go through Claude).
 * The Effect Mapping + Requirements cards bind the rich legacy editors to a
 * persisted EnrichedAbilitySpec (B1): edits write back to /api/ability-spec
 * (debounced), and "Draft with AI" asks Claude to propose a starter spec.
 */
export function SpellbookLogicWorkspace({ entity }: TrackWorkspaceProps) {
  const a = (entity.data ?? {}) as AbilityData;
  const [instruction, setInstruction] = useState('');

  // ── Enriched spec (B1 store; DB is source of truth) ─────────────────────────
  const loadSpec = useAbilitySpecStore((s) => s.loadSpec);
  const setSpec = useAbilitySpecStore((s) => s.setSpec);
  const slot = useEntityAbilitySpec(entity.catalogId, entity.id);
  const fallback = useMemo(
    () => deriveDefaultSpec(entity.catalogId, {
      id: entity.id, element: a.element, color: a.color, damage: a.damage, cooldown: a.cooldown, tag: a.tag,
    }),
    [entity.catalogId, entity.id, a.element, a.color, a.damage, a.cooldown, a.tag],
  );
  const spec = slot ?? fallback;

  const cli = useModuleCLI({
    moduleId: 'arpg-gas',
    sessionKey: `gen-${entity.id}`,
    label: `Logic · ${entity.name}`,
    accentColor: MODULE_COLORS.core,
    // After a "Draft with AI" run persists via callback, pull the drafted spec in.
    onComplete: () => {
      apiFetch<EnrichedAbilitySpec | null>(`/api/ability-spec?catalogId=${entity.catalogId}&entityId=${entity.id}`)
        .then((row) => { if (row) loadSpec(entity.catalogId, entity.id, row); })
        .catch(() => {});
    },
  });

  // Load the persisted spec on entity open. Falls back to the derived default,
  // but never clobbers an edit already made before the GET resolves.
  useEffect(() => {
    let cancelled = false;
    apiFetch<EnrichedAbilitySpec | null>(`/api/ability-spec?catalogId=${entity.catalogId}&entityId=${entity.id}`)
      .then((row) => {
        if (cancelled) return;
        const cur = useAbilitySpecStore.getState().getSpec(entity.catalogId, entity.id);
        if (cur == null) loadSpec(entity.catalogId, entity.id, row ?? fallback);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [entity.catalogId, entity.id, fallback, loadSpec]);

  // Optimistic + debounced write-back of an edited spec.
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: EnrichedAbilitySpec) => {
    setSpec(entity.catalogId, entity.id, next);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      saveRef.current = null;
      void apiFetch('/api/ability-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId: next.catalogId, entityId: next.entityId, effects: next.effects, tagRules: next.tagRules }),
      }).catch((e) => logger.warn('ability-spec save failed', e));
    }, UI_TIMEOUTS.specSaveDebounce);
  }, [entity.catalogId, entity.id, setSpec]);
  useEffect(() => () => { if (saveRef.current) clearTimeout(saveRef.current); }, []);

  const onEffectsChange = useCallback((effects: EditorEffect[]) => persist({ ...spec, effects }), [persist, spec]);
  const onRulesChange = useCallback((tagRules: TagRule[]) => persist({ ...spec, tagRules }), [persist, spec]);

  const ref: AbilityRef = {
    name: entity.name, element: a.element ?? '', tag: a.tag ?? '', category: a.category ?? '', tier: a.tier ?? '',
  };
  const change = (aspect: LogicAspect) =>
    void cli.execute(TaskFactory.quickAction('arpg-gas', buildLogicChangePrompt(aspect, ref, instruction), `Logic · ${entity.name}`));
  const draftSpec = () =>
    void cli.execute(TaskFactory.draftAbilitySpec('arpg-gas', { catalogId: entity.catalogId, entityId: entity.id, ref, instruction }, getAppOrigin(), `Draft · ${entity.name}`));
  const generateCpp = () =>
    void cli.execute(TaskFactory.generateGasEffects('arpg-gas', { ref, effects: spec.effects, tagRules: spec.tagRules }, getAppOrigin(), `Gen C++ · ${entity.name}`));

  const damage = a.damage ?? 0;
  const manaCost = a.manaCost ?? 0;
  const cooldown = a.cooldown ?? 0;

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

        <Card icon={<Sparkles className="w-4 h-4 text-text-muted" />} title="Effect Mapping" action="Draft with AI" busy={cli.isRunning} onChange={draftSpec}>
          <div className="flex justify-end">
            <button
              onClick={generateCpp}
              disabled={cli.isRunning || spec.effects.length === 0}
              className="focus-ring px-2 py-1 rounded text-2xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50"
            >
              Generate C++
            </button>
          </div>
          <EffectTimelineEditor effects={spec.effects} onChange={onEffectsChange} />
        </Card>

        <Card icon={<ShieldAlert className="w-4 h-4 text-text-muted" />} title="Requirements">
          <TagRulesEditor rules={spec.tagRules} onChange={onRulesChange} effects={spec.effects} loadout={[]} />
        </Card>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="optional: describe the change for any aspect above (or the AI draft) before clicking it"
          rows={2}
          className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
        />
      </div>
    </div>
  );
}
