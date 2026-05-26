import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'input-schemes',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is an input scheme for PoF — mapping physical device inputs to game actions with accessibility and platform cert in mind. `.repeat(4) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'schema', label: 'Action Mapping',
      view: { kind: 'table', field: 'mapping', columns: [{ key: 'move' }, { key: 'attack' }, { key: 'dodge' }, { key: 'interact' }] },
      produce: () => ({ data: { mapping: { move: 'LeftThumbstick', attack: 'ButtonFaceBottom', dodge: 'LeftTrigger', interact: 'ButtonFaceRight' } }, ueAssets: ['/Game/Input/DA_InputSchemes'] }),
      accept: fieldsPopulated('mapping', 'Move/attack/dodge/interact bindings defined', ['move', 'attack', 'dodge', 'interact']),
      staticChecks: () => [cppSymbolExists('AARPGPlayerController', 'Player controller (input) class present')],
    },
    {
      archetype: 'rules', label: 'Context Stack',
      view: { kind: 'table', field: 'contexts', columns: [{ key: 'gameplay' }, { key: 'menu' }, { key: 'dialogue' }] },
      produce: () => ({ data: { contexts: { gameplay: 'IMC_Gameplay', menu: 'IMC_Menu', dialogue: 'IMC_Dialogue' } } }),
      accept: fieldsPopulated('contexts', 'Gameplay/menu/dialogue context mappings defined', ['gameplay', 'menu', 'dialogue']),
    },
    {
      archetype: 'rules', label: 'Rebinding UI',
      view: { kind: 'table', field: 'rebinding', columns: [{ key: 'widget' }, { key: 'conflictCheck' }, { key: 'reset' }] },
      produce: () => ({ data: { rebinding: { widget: 'WBP_InputRebind', conflictCheck: 'FindConflictingAction', reset: 'RestoreDefaults' } } }),
      accept: fieldsPopulated('rebinding', 'Rebinding widget/conflict-check/reset defined', ['widget', 'conflictCheck', 'reset']),
    },
    {
      archetype: 'rules', label: 'Deadzone & Haptics',
      view: { kind: 'table', field: 'feel', columns: [{ key: 'deadzone' }, { key: 'rumble' }] },
      produce: () => ({ data: { feel: { deadzone: 0.15, rumble: 'ForceFeedbackEffect_DefaultHit' } } }),
      accept: fieldsPopulated('feel', 'Deadzone + rumble profile defined', ['deadzone', 'rumble']),
    },
    {
      archetype: 'checklist', label: 'Accessibility',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['hold-to-toggle on all hold actions', 'all actions remappable (no hardcoded exception)', 'no required chord (single-button alternatives provided)'] } }),
      accept: minCount('checks', '≥3 accessibility checks documented', 3),
    },
    {
      archetype: 'gallery', label: 'Input Glyphs',
      view: { kind: 'gallery', field: 'glyphSet', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { glyphSet: 0, links: [{ catalogId: 'icon-sets', entityId: 'input-glyphs', role: 'glyph-source' }] }, ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Glyphs`] }),
      accept: selected('glyphSet', 'A glyph set candidate is selected'),
    },
    {
      archetype: 'rules', label: 'Tutorial Prompts',
      view: { kind: 'table', field: 'tutorial', columns: [{ key: 'promptStyle' }] },
      produce: () => ({ data: { tutorial: { promptStyle: 'contextual-overlay' } } }),
      accept: fieldsPopulated('tutorial', 'Tutorial prompt style defined', ['promptStyle']),
    },
    {
      archetype: 'checklist', label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: () => ({ data: { keys: ['action_move', 'action_attack', 'action_dodge', 'action_interact'] } }),
      accept: minCount('keys', '≥1 localization key defined', 1),
    },
    {
      archetype: 'checklist', label: 'Platform Cert',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['System button reserved (no remap of PS/Xbox guide)', 'Trigger axes not required for accessibility interactions', 'Vibration off by default (user opt-in)'] } }),
      accept: minCount('checks', '≥1 platform cert check documented', 1),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['rebind persists across sessions', 'conflict rejected by FindConflictingAction', 'hold-to-toggle fires correctly in PIE'] } }),
      accept: runtimeDeferred('VSInputRebindTest', 'Rebind persists + conflicts rejected in PIE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [`DA_InputSchemes :: ${s}`, `IMC_Gameplay_${s}`, `T_${s}_Glyphs`, `WBP_InputRebind`];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/Input/${a}`) };
      },
      accept: minCount('assets', 'All input assets packaged', 2),
      staticChecks: () => [cppSymbolExists('AARPGPlayerController', 'Player controller present')],
    },
  ],
});
