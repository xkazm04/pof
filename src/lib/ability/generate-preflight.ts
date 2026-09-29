import type { EditorAttribute, EditorEffect } from '@/lib/gas-codegen';
import { resolveGenerateCooldown, type GenerateScalars } from '@/lib/ability/effect-codegen-prompt';

/**
 * Generate preflight — what a "Generate GAS effects" run WILL do to the design,
 * computed before the paid CLI run + UE build instead of discovered in C++.
 *
 * Each finding predicts one instruction of `buildGenerateAbilityBundlePrompt`:
 *   - nothing-to-generate (block) — no effects: the run reports and stops.
 *   - damage-override (override) — an authored Health hit differs from the
 *     catalog damage the prompt pins "the primary damaging effect" to. One-click
 *     fix: set that magnitude to -damage.
 *   - damage-unpinned (override) — no effect reduces Health at all (e.g. every
 *     template damages through the IncomingDamage meta attribute), so the model
 *     must invent where the pin lands. SURFACE-ONLY (`fix: null`): meta-attribute
 *     vs direct Health is a design call, and auto-adding Health -damage beside an
 *     IncomingDamage hit would author double damage.
 *   - cooldown-override (override) — an effect "Cooldown" that disagrees with the
 *     resolved ability cooldown ({@link resolveGenerateCooldown}, the prompt's own
 *     rule). It is dropped, never a GE Period. Fix: align the field.
 *   - unknown-attribute (todo) — a modifier on an attribute outside the spec's
 *     attribute set becomes `// TODO: unknown attribute`. Fix: add the attribute.
 *
 * Which Health hit is "primary" is this module's guess (the prompt leaves it to
 * the model): the largest Health reduction. Pure.
 */

export type PreflightKind =
  | 'nothing-to-generate' | 'damage-override' | 'damage-unpinned' | 'cooldown-override' | 'unknown-attribute';
export type PreflightSeverity = 'block' | 'override' | 'todo';

export type PreflightFix =
  | { kind: 'set-magnitude'; effectId: string; modifierIndex: number; magnitude: number }
  | { kind: 'set-cooldown'; effectId: string; cooldownSec: number }
  | { kind: 'add-attribute'; name: string };

export interface PreflightFinding {
  kind: PreflightKind;
  severity: PreflightSeverity;
  /** What the run will do, in the designer's words. */
  message: string;
  effectName?: string;
  attribute?: string;
  /** damage-override: the authored and the catalog-pinned Health magnitude. */
  authored?: number;
  catalog?: number;
  /** cooldown-override: the ability cooldown the run writes. */
  resolvedSec?: number;
  /** null = surface-only (a design call, no one-click patch). */
  fix: PreflightFix | null;
}

export interface GeneratePreflight {
  findings: PreflightFinding[];
  /** False only when a finding blocks (the run would do nothing). */
  canGenerate: boolean;
}

export interface PreflightSlices {
  effects: EditorEffect[];
  attributes: EditorAttribute[];
}

interface PreflightInput extends PreflightSlices {
  scalars?: GenerateScalars;
}

/** Every `Health += <negative>` modifier, in authoring order. */
function healthHits(effects: EditorEffect[]) {
  return effects.flatMap((e) => e.modifiers.flatMap((m, i) =>
    m.attribute === 'Health' && m.operation === 'add' && m.magnitude < 0 ? [{ effect: e, index: i, magnitude: m.magnitude }] : []));
}

function damageFindings(effects: EditorEffect[], damage: number | undefined): PreflightFinding[] {
  if (damage == null || damage <= 0) return [];
  const pin = -damage;
  const hits = healthHits(effects);
  if (hits.some((h) => h.magnitude === pin)) return [];
  if (hits.length) {
    const primary = hits.reduce((a, b) => (b.magnitude < a.magnitude ? b : a));
    return [{
      kind: 'damage-override', severity: 'override', effectName: primary.effect.name, authored: primary.magnitude, catalog: pin,
      message: `${primary.effect.name} authors Health ${primary.magnitude}; the run pins the primary damaging effect to ${pin} (catalog damage ${damage}).`,
      fix: { kind: 'set-magnitude', effectId: primary.effect.id, modifierIndex: primary.index, magnitude: pin },
    }];
  }
  const meta = effects.find((e) => e.modifiers.some((m) => m.attribute === 'IncomingDamage' && m.operation === 'add' && m.magnitude > 0));
  const via = meta?.modifiers.find((m) => m.attribute === 'IncomingDamage');
  return [{
    kind: 'damage-unpinned', severity: 'override', effectName: meta?.name,
    message: `${meta && via ? `${meta.name} damages through IncomingDamage +${via.magnitude} and n` : 'N'}o effect reduces Health; the run must pin a Health modifier to ${pin} (catalog damage ${damage}) on an effect it picks. Decide where by hand: meta-attribute vs direct Health is a design call.`,
    fix: null,
  }];
}

function cooldownFindings(effects: EditorEffect[], scalars?: GenerateScalars): PreflightFinding[] {
  const resolved = resolveGenerateCooldown(effects, scalars);
  const source = scalars?.cooldown != null ? 'the catalog cooldown' : 'the largest authored cooldown';
  return effects.filter((e) => e.cooldownSec > 0 && e.cooldownSec !== resolved).map((e) => ({
    kind: 'cooldown-override' as const, severity: 'override' as const, effectName: e.name, resolvedSec: resolved,
    message: `${e.name}'s Cooldown ${e.cooldownSec}s is dropped: the ability cooldown is ${source}, ${resolved}s, and ${e.cooldownSec}s will NOT become a GE Period.`,
    fix: { kind: 'set-cooldown' as const, effectId: e.id, cooldownSec: resolved },
  }));
}

function unknownAttributeFindings(effects: EditorEffect[], attributes: EditorAttribute[]): PreflightFinding[] {
  const known = new Set(attributes.map((a) => a.name));
  const seen = new Set<string>();
  const out: PreflightFinding[] = [];
  for (const e of effects) {
    for (const m of e.modifiers) {
      if (known.has(m.attribute) || seen.has(m.attribute)) continue;
      seen.add(m.attribute);
      out.push({
        kind: 'unknown-attribute', severity: 'todo', effectName: e.name, attribute: m.attribute,
        message: `${e.name} modifies ${m.attribute}, which is not in this spec's attribute set; the run writes \`// TODO: unknown attribute\` instead of that modifier.`,
        fix: { kind: 'add-attribute', name: m.attribute },
      });
    }
  }
  return out;
}

/** Predict what the generate run will override, TODO or refuse. Pure. */
export function preflightGenerate({ scalars, effects, attributes }: PreflightInput): GeneratePreflight {
  if (effects.length === 0) {
    return {
      canGenerate: false,
      findings: [{
        kind: 'nothing-to-generate', severity: 'block', fix: null,
        message: 'No effects authored: the run would report there is nothing to generate and stop.',
      }],
    };
  }
  const findings = [
    ...damageFindings(effects, scalars?.damage),
    ...cooldownFindings(effects, scalars),
    ...unknownAttributeFindings(effects, attributes),
  ];
  return { findings, canGenerate: true };
}

/** Apply one fix to the slices. Pure; untouched effects/attributes keep identity. */
export function applyPreflightFix<S extends PreflightSlices>(slices: S, fix: PreflightFix): S {
  switch (fix.kind) {
    case 'set-magnitude':
      return {
        ...slices,
        effects: slices.effects.map((e) => e.id !== fix.effectId ? e : {
          ...e, modifiers: e.modifiers.map((m, i) => (i === fix.modifierIndex ? { ...m, magnitude: fix.magnitude } : m)),
        }),
      };
    case 'set-cooldown':
      return { ...slices, effects: slices.effects.map((e) => (e.id === fix.effectId ? { ...e, cooldownSec: fix.cooldownSec } : e)) };
    case 'add-attribute': {
      if (slices.attributes.some((a) => a.name === fix.name)) return slices;
      const attr: EditorAttribute = { id: `a-${fix.name.toLowerCase()}-${slices.attributes.length}`, name: fix.name, category: 'combat', defaultValue: 0 };
      return { ...slices, attributes: [...slices.attributes, attr] };
    }
  }
}

/** Apply every finding's fix (surface-only findings are skipped). Pure. */
export function applyAllPreflightFixes<S extends PreflightSlices>(slices: S, findings: PreflightFinding[]): S {
  return findings.reduce((acc, f) => (f.fix ? applyPreflightFix(acc, f.fix) : acc), slices);
}
