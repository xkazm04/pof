import type { LayoutTemplateId, PanelDirective } from '@/lib/dzin/core/layout/types';

/**
 * A named composition preset — a saved layout + panel combination
 * that users can recall instantly.
 */
export interface CompositionPreset {
  /** Unique preset identifier. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Description of the preset's purpose. */
  description: string;
  /** Layout template to use. */
  templateId: LayoutTemplateId;
  /** Panel directives to place in the layout's slots. */
  directives: PanelDirective[];
}

/**
 * Built-in composition presets for the ARPG Combat module.
 */
export const COMPOSITION_PRESETS: CompositionPreset[] = [
  {
    id: 'ability-overview',
    label: 'Ability Overview',
    description: 'Side-by-side view of core GAS setup and ability definitions',
    templateId: 'split-2',
    directives: [
      { type: 'arpg-combat-core' },
      { type: 'arpg-combat-abilities' },
    ],
  },
  {
    id: 'combat-debug',
    label: 'Combat Debug',
    description: 'Four-panel debug view for combat tuning and effect inspection',
    templateId: 'grid-4',
    directives: [
      { type: 'arpg-combat-core' },
      { type: 'arpg-combat-effects' },
      { type: 'arpg-combat-damage-calc' },
      { type: 'arpg-combat-effect-timeline' },
    ],
  },
  {
    id: 'full-spellbook',
    label: 'Full Spellbook',
    description: 'Studio layout with tags, core, attributes, and abilities for comprehensive ability authoring',
    templateId: 'studio',
    directives: [
      { type: 'arpg-combat-tags' },
      { type: 'arpg-combat-core' },
      { type: 'arpg-combat-attributes' },
      { type: 'arpg-combat-abilities' },
    ],
  },
];
