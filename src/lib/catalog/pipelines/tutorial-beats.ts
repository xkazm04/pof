import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'tutorial-beats',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is a tutorial beat in PoF that teaches the player a core mechanic through a scripted, sandboxed moment. `.repeat(5) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'rules', label: 'Trigger',
      view: { kind: 'table', field: 'trigger', columns: [{ key: 'event' }, { key: 'condition' }] },
      produce: () => ({ data: { trigger: { event: 'OnEnterZone', condition: 'tutorial_dodge_not_seen == true' } } }),
      accept: fieldsPopulated('trigger', 'Trigger event + condition defined', ['event', 'condition']),
    },
    {
      archetype: 'rules', label: 'Lock / Sandbox',
      view: { kind: 'table', field: 'sandbox', columns: [{ key: 'lockedInputs' }, { key: 'sandboxScope' }] },
      produce: () => ({ data: { sandbox: { lockedInputs: 'attack,skill', sandboxScope: 'dodge_only_zone' } } }),
      accept: fieldsPopulated('sandbox', 'Locked inputs + sandbox scope defined', ['lockedInputs', 'sandboxScope']),
    },
    {
      archetype: 'rules', label: 'Step Sequence',
      view: { kind: 'table', field: 'sequence', columns: [{ key: 'steps' }, { key: 'order' }, { key: 'advanceOn' }] },
      produce: () => ({ data: { sequence: { steps: 'show_prompt,wait_dodge,show_success', order: 'linear', advanceOn: 'dodge_executed' } } }),
      accept: fieldsPopulated('sequence', 'Steps + order + advanceOn defined', ['steps', 'order', 'advanceOn']),
    },
    {
      archetype: 'rules', label: 'Success / Skip / Fail',
      view: { kind: 'table', field: 'outcomes', columns: [{ key: 'success' }, { key: 'skip' }, { key: 'fail' }] },
      produce: () => ({ data: { outcomes: { success: 'unlock_next_beat', skip: 'already_dodged_before', fail: 'retry_after_3s' } } }),
      accept: fieldsPopulated('outcomes', 'Success + skip + fail paths defined', ['success', 'skip', 'fail']),
    },
    {
      archetype: 'gallery', label: 'Pointer / Highlight 2D',
      view: { kind: 'gallery', field: 'pointer', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: {
          pointer: 0,
          links: [
            { catalogId: 'hud-elements', entityId: 'tutorial_pointer', role: 'pointer' },
            { catalogId: 'icon-sets', entityId: 'tutorial_icons', role: 'icons' },
          ],
        },
        ueAssets: [`/Game/UI/Tutorial/T_${slug(e.name)}_Pointer`],
      }),
      accept: selected('pointer', 'A pointer / highlight candidate is selected'),
    },
    {
      archetype: 'rules', label: 'VFX / Audio Cue',
      view: { kind: 'table', field: 'cues', columns: [{ key: 'id' }, { key: 'type' }, { key: 'catalog' }] },
      produce: () => ({
        data: {
          cues: [
            { id: 'NS_TutorialGlow', type: 'vfx', catalog: 'vfx' },
            { id: 'A_TutorialPrompt', type: 'audio', catalog: 'audio' },
          ],
          links: [
            { catalogId: 'vfx', entityId: 'tutorial_glow', role: 'highlight' },
            { catalogId: 'audio', entityId: 'tutorial_prompt', role: 'prompt_sfx' },
          ],
        },
      }),
      accept: minCount('cues', '≥1 VFX or audio cue bound', 1),
    },
    {
      archetype: 'checklist', label: 'VO',
      view: { kind: 'checklist', field: 'lines' },
      produce: () => ({ data: { lines: ['coach_dodge_prompt', 'coach_dodge_success', 'coach_dodge_retry'] } }),
      accept: minCount('lines', '≥1 VO line defined', 1),
    },
    {
      archetype: 'rules', label: 'Telemetry',
      view: { kind: 'table', field: 'telemetry', columns: [{ key: 'events' }, { key: 'comprehensionMetric' }] },
      produce: () => ({ data: { telemetry: { events: 'beat_started,beat_completed,beat_skipped,beat_failed', comprehensionMetric: 'dodge_success_rate' } } }),
      accept: fieldsPopulated('telemetry', 'Telemetry events + comprehension metric defined', ['events', 'comprehensionMetric']),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { selected: 0 }, ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`] }),
      accept: selected('selected', 'A tutorial beat icon is selected'),
    },
    {
      archetype: 'checklist', label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: () => ({ data: { keys: ['TUT_DODGE_PROMPT', 'TUT_DODGE_SUCCESS', 'TUT_DODGE_SKIP', 'TUT_DODGE_FAIL'] } }),
      accept: minCount('keys', '≥1 localization key defined', 1),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['beat triggers on enter', 'teaches dodge mechanic', 'completion fires telemetry in PIE'] } }),
      accept: runtimeDeferred('VSTutorialComprehensionTest', 'Beat triggers, teaches, and completion fires telemetry in PIE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_TutorialBeats :: ${s}`,
          `BP_TutorialBeat_${s}`,
          `T_${s}_Pointer`,
          `T_${s}_Icon`,
        ];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/Tutorial/${a}`) };
      },
      accept: minCount('assets', 'All tutorial beat assets packaged', 2),
    },
  ],
});
