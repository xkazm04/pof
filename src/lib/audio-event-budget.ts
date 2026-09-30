/**
 * Voice-budget stress test: what dies in a crowded fight.
 *
 * A pure, deterministic, time-stepped run of an event catalog against the
 * scene's voice limit (`AudioSceneDocument.maxConcurrentSounds`, owned by
 * UAudioSceneManager per `audio-runtime-contract.ts`). It applies exactly the
 * three rules the generated UAudioEventRouter is told to implement
 * (`prompts/audio-events.ts`, Priority Queue / Concurrency Limiter / Cooldown):
 *
 *  1. cooldown gate — a trigger within `cooldownMs` of the event's last START
 *     is cooled (a cooled trigger does not restart the timer);
 *  2. per-event cap — at `concurrency` active voices the event's OLDEST voice
 *     is cut and the new one starts;
 *  3. global limit — at `voiceLimit` active voices the lowest-priority voice
 *     (oldest on a tie) is stolen when it ranks strictly below the trigger;
 *     otherwise the trigger is dropped.
 *
 * Priority ranks come from the catalog's `PRIORITY_CONFIG` weights. A voice
 * lasts its bound set's longest clip; a loopable set holds its voice for the
 * whole run. An event the run never triggers, or one with no known clip
 * length, is NOT MEASURED — never reported as passing.
 */

import { PRIORITY_CONFIG } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import type { EventCategory, PriorityLevel } from '@/components/modules/content/audio/AudioEventCatalog/types';

export interface BudgetEvent {
  id: string;
  name: string;
  category: EventCategory;
  priority: PriorityLevel;
  concurrency: number;
  cooldownMs: number;
}

/** How long one voice of an event holds a slot. */
export interface EventVoice {
  /** Longest non-zero clip in the bound set; 0 = unknown length. */
  clipMs: number;
  loopable: boolean;
}

export type TriggerPlan = { perSecond: number } | { at: readonly number[] };

export interface BudgetScenario {
  durationMs: number;
  /** Per event id; an event absent here is not triggered. */
  triggers: Record<string, TriggerPlan>;
}

export type NotMeasuredReason = 'not triggered' | 'no clip length';

export interface EventBudgetRow {
  id: string;
  name: string;
  priority: PriorityLevel;
  status: 'measured' | 'not-measured';
  reason: NotMeasuredReason | null;
  requested: number;
  started: number;
  cooled: number;
  cutOldest: number;
  stolen: number;
  dropped: number;
  peakVoices: number;
}

export interface BudgetRun {
  rows: EventBudgetRow[];
  byId: Record<string, EventBudgetRow>;
  voiceLimit: number;
  /** Most voices active at once across the measured events. */
  peakVoices: number;
  summary: {
    measured: number;
    notMeasured: number;
    /** Measured rows with nothing cut, stolen or dropped. Not-measured rows never count. */
    clean: number;
    overBudget: number;
  };
}

/** The voice an event plays, from its bound set; `null` when unbound or the set is gone. */
export function eventVoice(
  event: { assetSetId?: string | null },
  sets: Record<string, EventVoice | undefined>,
): EventVoice | null {
  if (!event.assetSetId) return null;
  return sets[event.assetSetId] ?? null;
}

/** Trigger times in [0, durationMs), ascending. */
export function triggerTimes(plan: TriggerPlan | undefined, durationMs: number): number[] {
  if (!plan) return [];
  if ('at' in plan) return plan.at.filter((t) => t >= 0 && t < durationMs).sort((a, b) => a - b);
  if (!(plan.perSecond > 0)) return [];
  const out: number[] = [];
  for (let k = 0; (k * 1000) / plan.perSecond < durationMs; k++) out.push((k * 1000) / plan.perSecond);
  return out;
}

export interface CrowdedFight {
  enemies: number;
  durationMs: number;
  /** Combat triggers per second, per enemy. */
  combatPerEnemy: number;
  environmentPerSecond: number;
  uiPerSecond: number;
}

/** 'Crowded fight, 8 enemies, 10 s': combat 1/s per enemy, environment 2/s, UI 0.5/s, one music change. */
export const CROWDED_FIGHT: CrowdedFight = {
  enemies: 8, durationMs: 10_000, combatPerEnemy: 1, environmentPerSecond: 2, uiPerSecond: 0.5,
};

/** Per-event trigger plan for a crowded fight; music changes state once, at the start. */
export function crowdedFightScenario(
  events: readonly Pick<BudgetEvent, 'id' | 'category'>[],
  fight: CrowdedFight = CROWDED_FIGHT,
): BudgetScenario {
  const plan: Record<EventCategory, TriggerPlan> = {
    combat: { perSecond: fight.enemies * fight.combatPerEnemy },
    environment: { perSecond: fight.environmentPerSecond },
    ui: { perSecond: fight.uiPerSecond },
    music: { at: [0] },
  };
  const triggers: Record<string, TriggerPlan> = {};
  for (const e of events) triggers[e.id] = plan[e.category];
  return { durationMs: fight.durationMs, triggers };
}

interface Voice { idx: number; end: number; seq: number }

const weight = (p: PriorityLevel) => PRIORITY_CONFIG[p].weight;

export function simulateEventBudget(input: {
  events: readonly BudgetEvent[];
  voiceLimit: number;
  voices: Record<string, EventVoice | null | undefined>;
  scenario: BudgetScenario;
}): BudgetRun {
  const { events, voiceLimit, voices, scenario } = input;
  const rows: EventBudgetRow[] = events.map((e) => ({
    id: e.id, name: e.name, priority: e.priority, status: 'measured', reason: null,
    requested: 0, started: 0, cooled: 0, cutOldest: 0, stolen: 0, dropped: 0, peakVoices: 0,
  }));

  const queue: { t: number; idx: number }[] = [];
  events.forEach((e, idx) => {
    const times = triggerTimes(scenario.triggers[e.id], scenario.durationMs);
    const v = voices[e.id];
    rows[idx].requested = times.length;
    if (times.length === 0) { rows[idx].status = 'not-measured'; rows[idx].reason = 'not triggered'; return; }
    if (!v || (!v.loopable && !(v.clipMs > 0))) { rows[idx].status = 'not-measured'; rows[idx].reason = 'no clip length'; return; }
    for (const t of times) queue.push({ t, idx });
  });
  queue.sort((a, b) => a.t - b.t || a.idx - b.idx);

  let active: Voice[] = [];
  const lastStart = new Map<number, number>();
  let seq = 0;
  let peak = 0;
  for (const { t, idx } of queue) {
    active = active.filter((v) => v.end > t);
    const e = events[idx];
    const row = rows[idx];
    const last = lastStart.get(idx);
    if (last !== undefined && t - last < e.cooldownMs) { row.cooled++; continue; }

    const own = active.filter((v) => v.idx === idx);
    if (own.length >= Math.max(1, e.concurrency)) {
      const oldest = own.reduce((a, b) => (b.seq < a.seq ? b : a));
      active = active.filter((v) => v !== oldest);
      row.cutOldest++;
    } else if (active.length >= voiceLimit) {
      const victim = active.reduce((a, b) => {
        const d = weight(events[b.idx].priority) - weight(events[a.idx].priority);
        return d < 0 || (d === 0 && b.seq < a.seq) ? b : a;
      }, active[0]);
      if (!victim || weight(events[victim.idx].priority) >= weight(e.priority)) { row.dropped++; continue; }
      active = active.filter((v) => v !== victim);
      rows[victim.idx].stolen++;
    }

    const v = voices[e.id] as EventVoice;
    active.push({ idx, end: v.loopable ? Infinity : t + v.clipMs, seq: seq++ });
    lastStart.set(idx, t);
    row.started++;
    row.peakVoices = Math.max(row.peakVoices, active.filter((a) => a.idx === idx).length);
    peak = Math.max(peak, active.length);
  }

  const measured = rows.filter((r) => r.status === 'measured');
  const over = measured.filter((r) => r.cutOldest + r.stolen + r.dropped > 0).length;
  return {
    rows,
    byId: Object.fromEntries(rows.map((r) => [r.id, r])),
    voiceLimit,
    peakVoices: peak,
    summary: { measured: measured.length, notMeasured: rows.length - measured.length, clean: measured.length - over, overBudget: over },
  };
}
