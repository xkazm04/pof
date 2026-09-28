import { isMouseKey, type ResolvedBindings } from '@/lib/character/input-bindings';

/** Binding label -> UE `EKeys` name, for the keys whose label differs. */
const UE_KEY_NAMES: Record<string, string> = {
  Space: 'SpaceBar', Shift: 'LeftShift', Ctrl: 'LeftControl', Alt: 'LeftAlt', Tab: 'Tab',
  LMB: 'LeftMouseButton', RMB: 'RightMouseButton', Mouse: 'Mouse XY 2D-Axis',
  WASD: 'W/A/S/D (Swizzle + Negate modifiers)',
  Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
  '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
  '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '0': 'Zero',
};

const ueKey = (key: string) => UE_KEY_NAMES[key] ?? key;

/**
 * Build the CLI prompt for "Apply to IMC_Default": the changed mappings first,
 * then every effective mapping exactly once so the context ends up complete.
 * Mirrors `ai-feel/build-apply-prompt.ts`; dispatched only on an explicit click.
 */
export function buildBindingsApplyPrompt(resolved: ResolvedBindings): string {
  const changes = resolved.changed.map((c) => `- ${c.action}: ${c.from} -> ${c.to} (EKeys::${ueKey(c.to)})`);
  const mappings = resolved.effective.map((b) =>
    `- ${b.action}: ${b.key} (${isMouseKey(b.key) ? 'mouse' : 'key'} ${ueKey(b.key)}) -> ${b.handler}`,
  );

  return `## Task: Apply Input Bindings to IMC_Default — ${changes.length} changed mapping${changes.length === 1 ? '' : 's'}

Update the Enhanced Input mapping context **IMC_Default** so its key mappings match the designer's binding profile below. Only the key assignments change; Input Action assets, value types and handler functions stay as they are.

### Changed Mappings (default -> new)
${changes.join('\n')}

### Full Effective Mapping (one row per action)
${mappings.join('\n')}

### Instructions
1. Locate where IMC_Default is defined (C++ mapping setup in AARPGPlayerController / a UInputMappingContext subclass, or a data asset) and read it first
2. For each changed mapping, replace the old key with the new one — do not add a second key for the same action
3. Keep every other mapping exactly as listed in the full mapping above
4. Actions without an \`IA_\` prefix are design names: map them to the matching Input Action if one exists; if none exists, report it instead of inventing one
5. Verify the project compiles`;
}
