'use client';

import { useMemo, useState } from 'react';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';
import { DEFAULT_EVENTS, PRIORITY_CONFIG } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog/types';
import { useAudioSetLibrary } from '@/components/modules/content/audio/AudioPropertyPanel/useAudioSetLibrary';
import { eventBudget } from '@/lib/audio-runtime-contract';
import {
  CROWDED_FIGHT, crowdedFightScenario, eventVoice, simulateEventBudget,
  type CrowdedFight, type EventBudgetRow, type EventVoice, type TriggerPlan,
} from '@/lib/audio-event-budget';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';

interface BudgetStressPanelProps {
  /** The audio scene whose Event Catalog is stressed (same key the catalog persists under). */
  sceneId: string;
  /** The scene voice limit as the user sees it — the Settings draft, before it is saved. */
  voiceLimit: number;
}

/** Bounded so a stray keystroke cannot turn the run into a million triggers. */
const FIGHT_FIELDS: { key: keyof CrowdedFight; label: string; step: number; max: number }[] = [
  { key: 'enemies', label: 'Enemies', step: 1, max: 64 },
  { key: 'combatPerEnemy', label: 'Combat triggers per second per enemy', step: 0.5, max: 20 },
  { key: 'environmentPerSecond', label: 'Environment triggers per second', step: 0.5, max: 20 },
  { key: 'uiPerSecond', label: 'UI triggers per second', step: 0.5, max: 20 },
];

const rateLabel = (plan: TriggerPlan | undefined) =>
  !plan ? '—' : 'at' in plan ? `${plan.at.length}× per run` : `${plan.perSecond}/s`;

const inputCls = 'w-16 px-2 py-1 bg-surface-deep border border-border rounded text-xs text-text tabular-nums outline-none focus:border-border-bright';

/**
 * "What dies in a crowded fight": the scene's Event Catalog run against the
 * voice limit with the three router rules (see `@/lib/audio-event-budget`).
 * Nothing is generated or played — the only reads are the library GETs, and the
 * only write is the per-row fix, into the same per-scene catalog slot the
 * Event Catalog seeds from.
 */
export function BudgetStressPanel({ sceneId, voiceLimit }: BudgetStressPanelProps) {
  const own = useAudioEventCatalogStore((s) => s.byScene[sceneId]);
  const legacy = useAudioEventCatalogStore((s) => s.legacyEvents);
  const events: AudioEvent[] = own ?? legacy ?? DEFAULT_EVENTS;

  const library = useAudioSetLibrary(true);
  const libraryReady = !library.isLoading && !library.error;
  const voices = useMemo(() => {
    const sets: Record<string, EventVoice> = {};
    if (libraryReady) for (const o of library.options) sets[o.id] = { clipMs: o.clipMs ?? 0, loopable: o.loopable ?? false };
    return Object.fromEntries(events.map((e) => [e.id, eventVoice(e, sets)]));
  }, [events, library.options, libraryReady]);

  const [fight, setFight] = useState<CrowdedFight>(CROWDED_FIGHT);
  const scenario = useMemo(() => crowdedFightScenario(events, fight), [events, fight]);
  const run = useMemo(
    () => simulateEventBudget({ events, voiceLimit, voices, scenario }),
    [events, voiceLimit, voices, scenario],
  );
  const declared = eventBudget(events, { maxConcurrentSounds: voiceLimit });
  const total = (k: 'cutOldest' | 'stolen' | 'dropped') => run.rows.reduce((n, r) => n + r[k], 0);

  // A row keeps its fix controls once edited, so a fix that clears it mid-typing does not yank the input.
  const [fixing, setFixing] = useState<ReadonlySet<string>>(() => new Set());
  const patch = (id: string, p: Partial<Pick<AudioEvent, 'concurrency' | 'cooldownMs'>>) => {
    if (!fixing.has(id)) setFixing(new Set(fixing).add(id));
    useAudioEventCatalogStore.getState().setEvents(sceneId, events.map((e) => (e.id === id ? { ...e, ...p } : e)));
  };

  return (
    <section className="rounded-lg border border-border p-3 space-y-3" aria-label="Voice budget stress test">
      <div>
        <h4 className="text-xs font-semibold text-text">Crowded-fight stress test</h4>
        <p className="text-2xs text-text-muted mt-0.5">
          This scene&apos;s Event Catalog run for {fight.durationMs / 1000} s against the voice limit, with the router&apos;s
          rules: per-event cooldown, oldest-steal at the class cap, lowest-priority steal at the limit, else drop.
          Nothing is generated or played.
        </p>
      </div>

      <p data-testid="budget-totals" className="text-2xs text-text tabular-nums">
        limit {voiceLimit} · peak {run.peakVoices} · declared {declared.declaredVoices} · cut {total('cutOldest')} ·
        stolen {total('stolen')} · dropped {total('dropped')} · {run.summary.clean} clean, {run.summary.overBudget} over
        budget, {run.summary.notMeasured} not measured
      </p>
      {!libraryReady && (
        <p className="text-2xs text-text-muted">
          {library.error ? 'Audio library unreadable — clip lengths unknown. ' : 'Reading clip lengths from the audio library… '}
          {library.error && <button className="underline" onClick={library.retry}>Retry</button>}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {FIGHT_FIELDS.map((f) => (
          <label key={f.key} className="text-2xs text-text-muted flex items-center gap-1.5">
            {f.label}
            <input
              type="number" min={0} max={f.max} step={f.step} aria-label={f.label} className={inputCls}
              value={fight[f.key]}
              onChange={(e) => setFight((prev) => ({ ...prev, [f.key]: Math.min(f.max, Math.max(0, Number(e.target.value) || 0)) }))}
            />
          </label>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead>
            <tr className="text-text-muted text-left">
              {['Event', 'Rate', 'Req', 'Started', 'Cooled', 'Cut', 'Stolen', 'Dropped', 'Peak', 'Fix'].map((h) => (
                <th key={h} className="px-2 py-1 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {run.rows.map((r) => {
              const evt = events.find((e) => e.id === r.id);
              return evt ? (
                <BudgetRow
                  key={r.id} row={r} event={evt} rate={rateLabel(scenario.triggers[r.id])}
                  keepFix={fixing.has(r.id)} onPatch={patch}
                />
              ) : null;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BudgetRow({ row, event, rate, keepFix, onPatch }: {
  row: EventBudgetRow;
  event: AudioEvent;
  rate: string;
  keepFix: boolean;
  onPatch: (id: string, p: Partial<Pick<AudioEvent, 'concurrency' | 'cooldownMs'>>) => void;
}) {
  const measured = row.status === 'measured';
  const over = measured && row.cutOldest + row.stolen + row.dropped > 0;
  const cell = (n: number, color?: string, testId?: string) => (
    <td data-testid={testId} className="px-2 py-1 tabular-nums" style={n > 0 && color ? { color } : undefined}>{n}</td>
  );
  return (
    <tr data-testid={`budget-row-${row.id}`} className="border-t border-border text-text-muted-hover">
      <td className="px-2 py-1">
        <span className="text-text">{row.name}</span>{' '}
        <span style={{ color: PRIORITY_CONFIG[row.priority].color }}>{PRIORITY_CONFIG[row.priority].label}</span>
      </td>
      <td className="px-2 py-1 tabular-nums">{rate}</td>
      {measured ? (
        <>
          {cell(row.requested)}
          {cell(row.started)}
          {cell(row.cooled, undefined, 'cooled')}
          {cell(row.cutOldest, STATUS_WARNING)}
          {cell(row.stolen, STATUS_ERROR)}
          {cell(row.dropped, STATUS_ERROR)}
          <td className="px-2 py-1 tabular-nums">{row.peakVoices}/{event.concurrency}</td>
        </>
      ) : (
        <td colSpan={7} className="px-2 py-1">
          <span className="px-1.5 py-0.5 rounded border border-border uppercase tracking-wider text-text-muted">
            Not measured — {row.reason}
          </span>
        </td>
      )}
      <td className="px-2 py-1">
        {(over || keepFix) && (
          <div className="flex gap-1.5">
            <input
              type="number" min={1} max={16} aria-label={`${row.name} concurrency`} className={inputCls}
              value={event.concurrency}
              onChange={(e) => onPatch(row.id, { concurrency: Math.max(1, Math.min(16, Number(e.target.value) || 1)) })}
            />
            <input
              type="number" min={0} step={50} aria-label={`${row.name} cooldown ms`} className={inputCls}
              value={event.cooldownMs}
              onChange={(e) => onPatch(row.id, { cooldownMs: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        )}
      </td>
    </tr>
  );
}
