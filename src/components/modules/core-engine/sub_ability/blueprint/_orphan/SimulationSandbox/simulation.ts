import type {
  EditorAttribute, EditorEffect, AttrRelationship, QueuedEffect, SimSnapshot,
} from './types';
import { SIM_STEP } from './constants';

function resolveClampMax(attr: EditorAttribute, values: Record<string, number>): number | undefined {
  if (attr.clampMax == null) return undefined;
  const num = Number(attr.clampMax);
  if (!isNaN(num)) return num;
  // It's an attribute name reference like "MaxHealth"
  return values[attr.clampMax];
}

function clampValue(val: number, attr: EditorAttribute, values: Record<string, number>): number {
  let v = val;
  if (attr.clampMin != null) v = Math.max(v, attr.clampMin);
  const max = resolveClampMax(attr, values);
  if (max != null) v = Math.min(v, max);
  return v;
}

export function runSimulation(
  attributes: EditorAttribute[],
  effects: EditorEffect[],
  relationships: AttrRelationship[],
  queue: QueuedEffect[],
  overrides: Record<string, number>,
  duration: number,
): SimSnapshot[] {
  const snapshots: SimSnapshot[] = [];
  const attrMap = new Map(attributes.map(a => [a.name, a]));

  // Initialize values from defaults + overrides
  const values: Record<string, number> = {};
  for (const attr of attributes) {
    values[attr.name] = overrides[attr.name] ?? attr.defaultValue;
  }

  // Apply relationship-based initial scaling (e.g., MaxMana += Intelligence * 5)
  for (const rel of relationships) {
    if (rel.type === 'scale') {
      const src = attributes.find(a => a.id === rel.sourceId);
      const tgt = attributes.find(a => a.id === rel.targetId);
      if (src && tgt) {
        // Extract multiplier from formula like "AttackPower += Strength * 2"
        const mulMatch = rel.formula.match(/\*\s*([0-9.]+)/);
        if (mulMatch) {
          values[tgt.name] += values[src.name] * parseFloat(mulMatch[1]);
        }
      }
    }
  }

  // Clamp initial values
  for (const attr of attributes) {
    values[attr.name] = clampValue(values[attr.name], attr, values);
  }

  // Track active duration-based effects: { effectId, expiresAt }
  const activeEffects: { effectId: string; expiresAt: number; nextTickAt: number }[] = [];

  // Sort queue by trigger time
  const sorted = [...queue].sort((a, b) => a.triggerTime - b.triggerTime);
  let queueIdx = 0;

  // Initial snapshot
  snapshots.push({ time: 0, values: { ...values }, activeTags: [], events: ['Simulation start'] });

  for (let t = SIM_STEP; t <= duration + 0.001; t = Math.round((t + SIM_STEP) * 100) / 100) {
    const events: string[] = [];

    // 1. Trigger queued effects that fire at or before this time
    while (queueIdx < sorted.length && sorted[queueIdx].triggerTime <= t + 0.001) {
      const qe = sorted[queueIdx];
      const eff = effects.find(e => e.id === qe.effectId);
      if (eff) {
        // Apply instant modifiers
        for (const mod of eff.modifiers) {
          if (mod.operation === 'add') {
            values[mod.attribute] = (values[mod.attribute] ?? 0) + mod.magnitude;
          } else {
            values[mod.attribute] = (values[mod.attribute] ?? 0) * mod.magnitude;
          }
        }

        if (eff.duration === 'duration' || eff.duration === 'infinite') {
          activeEffects.push({
            effectId: eff.id,
            expiresAt: eff.duration === 'infinite' ? Infinity : t + eff.durationSec,
            nextTickAt: eff.cooldownSec > 0 ? t + eff.cooldownSec : Infinity,
          });
        }

        events.push(`${eff.name} applied`);
      }
      queueIdx++;
    }

    // 2. Tick active periodic effects
    for (const ae of activeEffects) {
      if (t > ae.expiresAt) continue;
      const eff = effects.find(e => e.id === ae.effectId);
      if (!eff || eff.cooldownSec <= 0) continue;

      if (t >= ae.nextTickAt - 0.001) {
        for (const mod of eff.modifiers) {
          if (mod.operation === 'add') {
            values[mod.attribute] = (values[mod.attribute] ?? 0) + mod.magnitude;
          } else {
            values[mod.attribute] = (values[mod.attribute] ?? 0) * mod.magnitude;
          }
        }
        ae.nextTickAt = t + eff.cooldownSec;
        events.push(`${eff.name} tick`);
      }
    }

    // 3. Remove expired effects
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      if (t > activeEffects[i].expiresAt) {
        const eff = effects.find(e => e.id === activeEffects[i].effectId);
        if (eff) events.push(`${eff.name} expired`);
        activeEffects.splice(i, 1);
      }
    }

    // 4. Apply clamps
    for (const attr of attributes) {
      values[attr.name] = clampValue(values[attr.name], attr, values);
    }

    // 5. Collect active tags
    const activeTags: string[] = [];
    for (const ae of activeEffects) {
      const eff = effects.find(e => e.id === ae.effectId);
      if (eff) activeTags.push(...eff.grantedTags);
    }

    snapshots.push({
      time: Math.round(t * 100) / 100,
      values: { ...values },
      activeTags: [...new Set(activeTags)],
      events,
    });
  }

  return snapshots;
}
