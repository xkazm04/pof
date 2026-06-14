/**
 * C++ code generation functions for the GAS Blueprint Editor.
 *
 * Re-exports the canonical generators from @/lib/gas-codegen and adds
 * the effect-stub generator that lives only in the editor.
 */

export {
  generateAttributeSetHeader,
  generateTagsHeader,
} from '@/lib/gas-codegen';
import type { EditorEffect } from '@/lib/gas-codegen';

export function generateEffectsCode(effects: EditorEffect[]): string {
  const lines: string[] = [
    '// Auto-generated GameplayEffect class stubs by PoF GAS Blueprint Editor',
    '',
  ];

  for (const eff of effects) {
    lines.push(`// \u2500\u2500 ${eff.name} \u2500\u2500`);
    lines.push(`// Duration: ${eff.duration}${eff.duration === 'duration' ? ` (${eff.durationSec}s)` : ''}`);
    if (eff.cooldownSec > 0) lines.push(`// Cooldown: ${eff.cooldownSec}s (ability cooldown — apply via a separate Cooldown GE, NOT as a Period/DoT tick)`);
    if (eff.modifiers.length > 0) {
      lines.push('// Modifiers:');
      for (const m of eff.modifiers) {
        lines.push(`//   ${m.attribute}: ${m.operation === 'add' ? '+' : '*'}${m.magnitude}`);
      }
    }
    if (eff.grantedTags.length > 0) {
      lines.push(`// Granted Tags: ${eff.grantedTags.join(', ')}`);
    }
    lines.push(`U${eff.name}::U${eff.name}()`);
    lines.push('{');
    const policy = eff.duration === 'instant'
      ? 'Instant'
      : eff.duration === 'duration'
        ? 'HasDuration'
        : 'Infinite';
    lines.push(`    DurationPolicy = EGameplayEffectDurationType::${policy};`);
    if (eff.duration === 'duration') {
      lines.push(`    DurationMagnitude = FScalableFloat(${eff.durationSec.toFixed(1)}f);`);
    }
    // cooldownSec is the ABILITY cooldown (the editor's "Cooldown" field) —
    // emitting it as Period would turn the effect into a repeating DoT tick.
    if (eff.cooldownSec > 0) {
      lines.push(`    // Ability cooldown ${eff.cooldownSec.toFixed(1)}s: apply via a separate Cooldown GE`);
      lines.push(`    // (HasDuration, DurationMagnitude = ${eff.cooldownSec.toFixed(1)}f) referenced from the ability's CooldownGameplayEffectClass.`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}
