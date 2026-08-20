import { registerCatalogPipeline } from '../pipeline-registry';
import { wiringContractSound } from '@/lib/catalog/acceptance/wiringCheckers';
import { minLength, fieldsPopulated, selected, minCount, entriesHaveFields } from '../acceptance/dataCheckers';
import { entityRuntimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { allOf } from '../acceptance/combinators';
import { linksResolve } from '../acceptance/linkCheckers';
import { gallerySeed } from '@/lib/catalog/acceptance/galleryArtifact';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * The mechanic a beat teaches, derived from the beat's OWN name:
 * "Learn to Dodge" → "Dodge", "Learn how to Block" → "Block".
 *
 * This is the single identity token every step in this pipeline derives from, so a beat
 * can never write another beat's tags/keys/assets:
 *   gameplay tags        Tutorial.<M>.Introduced / .Skipped / .Failed / .Executed
 *   taught input/ability IA_<M> · GA_<M>
 *   sandbox scope        <m>_only_zone          sequence step   wait_<m>
 *   advance signal       <m>_executed           metric          <m>_success_rate
 *   VO cue ids           coach_<m>_prompt / _success / _retry
 *   localization prefix  TUT_<M>_
 * The beat actor itself stays keyed on the full entity slug (BP_TutorialBeat_<slug>).
 */
const mechanic = (n: string) => slug(n.replace(/^\s*learn(ing)?\s+(how\s+to|to)\s+/i, '')) || slug(n);
/** lower-case form used for snake_case ids (scopes, signals, metrics, VO cues). */
const mech = (n: string) => mechanic(n).toLowerCase();
/** UPPER form used for the localization key prefix (TUT_<M>_*). */
const MECH = (n: string) => mechanic(n).toUpperCase();

/**
 * Tutorial Beats pipeline (catalogId: 'tutorial-beats').
 *
 * A tutorial beat is a single scripted teaching moment that locks all inputs
 * outside the taught mechanic within a named, scoped sandbox, advancing
 * linearly by default (canon tutorial-sandbox: branching requires an explicit
 * flag + reachability check).
 *
 * Wiring: BP_TutorialBeat_* extends the base tutorial-beat BP; on
 * OnEnterZone the beat fires beat_started, locks irrelevant inputs via the
 * InputSandbox subsystem, and steps through the sequence. On completion /
 * skip / fail it fires the matching telemetry event and unlocks inputs.
 */
registerCatalogPipeline({
  catalogId: 'tutorial-beats',
  steps: [
    // ── 1. Concept Brief ────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const m = mechanic(e.name);
        const ml = mech(e.name);
        return {
          data: {
            brief:
              `${e.name} is a tutorial beat in PoF that teaches the player a core mechanic through a ` +
              `scripted, sandboxed moment (canon tutorial-sandbox). The beat locks all inputs outside ` +
              `the taught mechanic — for "${e.name}" this means attack, skill, and interact ` +
              `inputs are disabled while the player is inside the named ${ml}_only_zone sandbox scope. ` +
              `The beat advances linearly by default: show_prompt → wait_${ml} → show_success. ` +
              `Branching is off by default (no branchingEnabled flag) so reachability is trivially ` +
              `guaranteed. On success the player is granted the Tutorial.${m}.Introduced tag and the next ` +
              `beat is unlocked in DT_TutorialBeats. On failure after ${3} attempts the beat resets ` +
              `with a shorter prompt delay. Telemetry fires beat_started / beat_completed / beat_skipped / ` +
              `beat_failed per canon tutorial-telemetry, and comprehensionMetric=${ml}_success_rate ` +
              `(ratio of completions to total attempts) is persisted to the analytics backend so the ` +
              `onboarding funnel drop-off is measurable per beat. The beat's UE representation is a ` +
              `BP_TutorialBeat_${s} actor placed in the tutorial area level; it reads its ` +
              `config from a DT_TutorialBeats row keyed by "${s}".`,
          },
        };
      },
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Trigger Condition Logic ──────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Trigger',
      view: {
        kind: 'table',
        field: 'trigger',
        columns: [{ key: 'event' }, { key: 'condition' }, { key: 'resetOn' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const m = mechanic(e.name);
        return {
          data: {
            trigger: {
              event: 'OnEnterZone',
              condition: `GameplayTag_Missing:Tutorial.${m}.Introduced AND GameplayTag_Missing:Tutorial.${m}.Skipped`,
              resetOn: 'OnExitZone_WithoutCompletion',
              note:
                `Fires when the player enters the trigger volume AND lacks Tutorial.${m}.Introduced ` +
                `(has not completed the beat) AND lacks Tutorial.${m}.Skipped. ` +
                'ResetOn: if the player exits without completing, the beat resets to its initial state ' +
                'on next entry. Gameplay tags checked via UARPGGameplayTagComponent on the player. ' +
                'The trigger volume is a AARPGTriggerBox placed in the tutorial area.',
              wiringContract: {
                grantedBy: `AARPGTriggerBox::OnBeginOverlap delegate → BP_TutorialBeat_${s} BeginBeat()`,
                activatedBy: 'Player pawn overlaps the tutorial trigger volume (collision channel: TutorialTrigger)',
                dependencies: ['characters (player UARPGGameplayTagComponent for tag checks)'],
                verification:
                  `L2: AARPGTriggerBox in Source/PoF/ + DT_TutorialBeats row seeded for "${s}"; ` +
                  `L3: VSTutorialComprehensionTest — beat does NOT trigger when Tutorial.${m}.Introduced is set`,
              },
            },
          },
        };
      },
      accept: allOf(
        fieldsPopulated('trigger', 'Trigger event + condition + resetOn defined', ['event', 'condition', 'resetOn']),
        wiringContractSound('trigger'),
      ),
    },

    // ── 3. Player State Lock / Sandbox ──────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Lock / Sandbox',
      view: {
        kind: 'table',
        field: 'sandbox',
        columns: [{ key: 'lockedInputs' }, { key: 'sandboxScope' }, { key: 'branchingEnabled' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const m = mechanic(e.name);
        const ml = mech(e.name);
        return {
          data: {
            sandbox: {
              lockedInputs: 'IA_Attack, IA_Skill_1, IA_Skill_2, IA_Interact',
              sandboxScope: `${ml}_only_zone`,
              branchingEnabled: false,
              unlockCondition: 'OnBeatComplete OR OnBeatSkipped OR OnBeatFailed_MaxAttempts',
              note:
                'Per canon tutorial-sandbox: linear advance by default — branchingEnabled=false, so ' +
                'the step sequence is deterministic (no reachability analysis needed). ' +
                'Locked inputs map to Enhanced Input Action bindings disabled via the InputSandbox ' +
                'USubsystem while the player is inside the sandbox scope. ' +
                `The taught input (IA_${m}) remains enabled as the only active input. ` +
                'On beat exit (success/skip/fail) all inputs are restored in the same frame.',
              wiringContract: {
                grantedBy: `UARPGInputSandboxSubsystem::LockInputs() called by BP_TutorialBeat_${s} on BeginBeat()`,
                activatedBy: `Trigger fires → BeginBeat() → LockInputs("${ml}_only_zone")`,
                dependencies: ['input-schemes (IA_* input actions; input-gamepad starter)'],
                verification:
                  'L2: UARPGInputSandboxSubsystem declared in Source/PoF/; ' +
                  'L3: VSTutorialComprehensionTest — IA_Attack fires no GAS ability while sandbox is active',
              },
            },
          },
        };
      },
      accept: allOf(
        fieldsPopulated('sandbox', 'Locked inputs + sandbox scope + branching flag defined', [
          'lockedInputs',
          'sandboxScope',
          'branchingEnabled',
        ]),
        wiringContractSound('sandbox'),
      ),
    },

    // ── 4. Step Sequence Authoring ──────────────────────────────────────────
    // Linear by default per tutorial-sandbox canon. branchingEnabled=false means
    // a graph archetype is not required — a rules step with an ordered array suffices.
    // If branching is introduced later, switch to archetype:'graph' + view.kind:'graph'
    // and add a reachabilityCheck field.
    {
      archetype: 'rules',
      label: 'Step Sequence',
      view: {
        kind: 'table',
        field: 'sequence',
        columns: [{ key: 'steps' }, { key: 'advanceOn' }, { key: 'timeoutPerStep' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const m = mechanic(e.name);
        const ml = mech(e.name);
        const M = MECH(e.name);
        return {
          data: {
            sequence: {
              steps: [
                { id: 'show_prompt',   description: `Display TUT_${M}_PROMPT widget; highlight the IA_${m} input binding on HUD via hud-elements::hud-health-bar pointer overlay` },
                { id: `wait_${ml}`,    description: `Wait for IA_${m} execution; after 8s timeout show retry cue; after 3 timeouts transition to fail terminal` },
                { id: 'show_success',  description: `Play success VFX (NS_TutorialGlow from vfx-fire-impact recolored) + VO coach_${ml}_success; grant Tutorial.${m}.Introduced tag; fire beat_completed` },
              ],
              advanceOn: `${ml}_executed`,
              timeoutPerStep: 8,
              maxRetries: 3,
              branchingEnabled: false,
              note:
                'Linear sequence (branchingEnabled=false per tutorial-sandbox canon). ' +
                `advanceOn: the GA_${m} GameplayAbility broadcasts Tutorial.${m}.Executed tag on activation; ` +
                `BP_TutorialBeat_${s} listens via WaitGameplayTagAdded. ` +
                'Timeout at 8s per step triggers the retry VO cue. ' +
                'After maxRetries=3 the beat transitions to the fail path.',
              wiringContract: {
                grantedBy: `BP_TutorialBeat_${s} state machine stepped by WaitGameplayTagAdded(Tutorial.${m}.Executed)`,
                activatedBy: `Player executes GA_${m} → ability broadcasts Tutorial.${m}.Executed tag`,
                dependencies: [`spellbook (GA_${m} ability — broadcasts Tutorial.${m}.Executed on activation)`],
                verification:
                  `L2: GA_${m} in Source/PoF/ broadcasts Tutorial.${m}.Executed tag; ` +
                  `L3: VSTutorialComprehensionTest — sequence advances to show_success within 8s of the taught input`,
              },
            },
          },
        };
      },
      accept: allOf(
        fieldsPopulated('sequence', 'Steps + advanceOn + timeoutPerStep defined', [
          'steps',
          'advanceOn',
          'timeoutPerStep',
        ]),
        wiringContractSound('sequence'),
      ),
    },

    // ── 5. Success / Skip / Fail Rules ─────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Success / Skip / Fail',
      view: {
        kind: 'table',
        field: 'outcomes',
        columns: [{ key: 'success' }, { key: 'skip' }, { key: 'fail' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const m = mechanic(e.name);
        const ml = mech(e.name);
        return {
          data: {
            outcomes: {
              success: {
                condition: `${ml}_executed before maxRetries exhausted`,
                grantedTag: `Tutorial.${m}.Introduced`,
                effect: `unlock next beat row in DT_TutorialBeats; play coach_${ml}_success VO; fire beat_completed telemetry`,
              },
              skip: {
                condition: `GameplayTag_Present:Tutorial.${m}.Introduced OR player_level >= 5`,
                grantedTag: `Tutorial.${m}.Skipped`,
                effect: 'bypass beat without firing show_prompt; fire beat_skipped telemetry',
              },
              fail: {
                condition: `maxRetries (3) exhausted without ${ml}_executed`,
                grantedTag: `Tutorial.${m}.Failed`,
                effect: `play coach_${ml}_retry VO; reset beat after 3s cooldown; increment failCount in analytics; fire beat_failed telemetry`,
              },
              note:
                'All three terminals are explicit (per QUALITY-GATE §1: a beat with no fail terminal can silently block). ' +
                'On success/fail/skip the sandbox scope is unlocked in the same frame.',
              wiringContract: {
                grantedBy: `BP_TutorialBeat_${s} grants/removes gameplay tags via UAbilitySystemComponent::AddLooseGameplayTag`,
                activatedBy: `Outcome condition evaluated by BP_TutorialBeat_${s} state machine at each step transition`,
                dependencies: ['characters (player UAbilitySystemComponent for tag grants)'],
                verification:
                  `L2: Tutorial.${m}.* tags declared in GameplayTags.ini; ` +
                  `L3: VSTutorialComprehensionTest — success grants Tutorial.${m}.Introduced, fail fires beat_failed`,
              },
            },
          },
        };
      },
      accept: allOf(
        fieldsPopulated('outcomes', 'Success + skip + fail paths defined', ['success', 'skip', 'fail']),
        wiringContractSound('outcomes'),
      ),
    },

    // ── 6. Pointer / Highlight 2D ──────────────────────────────────────────
    // Links use REAL seeded ids only (hud-elements::hud-health-bar, icon-sets::iconset-abilities).
    // Flavor names live in data, not links.
    {
      archetype: 'gallery',
      label: 'Pointer / Highlight 2D',
      engine: 'Leonardo',
      view: { kind: 'gallery', field: 'pointer', candidates: 4 },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const m = mechanic(e.name);
        return {
          data: {
            ...gallerySeed('pointer', 4),
            pointerDesignFlavor: [
              `tutorial_pointer overlay — blinking arrow on the IA_${m} input binding (built from hud-elements::hud-health-bar pointer slot)`,
              `tutorial_icons highlight — IA_${m} input icon highlighted on the ability bar (from icon-sets::iconset-abilities family)`,
            ],
            links: [
              { catalogId: 'hud-elements', entityId: 'hud-health-bar', role: 'pointer-overlay' },
              { catalogId: 'icon-sets',    entityId: 'iconset-abilities', role: 'input-highlight' },
            ],
            wiringContract: {
              grantedBy:
                `BP_TutorialBeat_${s} activates the pointer overlay widget (child of hud-health-bar) ` +
                `and highlights the IA_${m} icon (from iconset-abilities atlas) on show_prompt step`,
              activatedBy: `Sequence step show_prompt → BP_TutorialBeat_${s}::ShowPointerOverlay()`,
              dependencies: [
                'hud-elements (hud-health-bar widget — exposes a named TutorialPointerSlot CanvasPanel slot)',
                `icon-sets (iconset-abilities atlas — T_AbilityIcons_Atlas frame for IA_${m})`,
              ],
              verification:
                'L2: hud-health-bar WBP exposes TutorialPointerSlot slot; iconset-abilities atlas imported; ' +
                'L3: VSTutorialComprehensionTest — pointer widget visible during show_prompt step',
            },
          },
          links: [
            { catalogId: 'hud-elements', entityId: 'hud-health-bar', role: 'pointer-overlay' },
            { catalogId: 'icon-sets',    entityId: 'iconset-abilities', role: 'input-highlight' },
          ],
          ueAssets: [`/Game/UI/Tutorial/T_${s}_Pointer`],
        };
      },
      accept: allOf(
        linksResolve(),
        wiringContractSound(),
        selected('pointer', 'A pointer / highlight candidate is selected'),
      ),
    },

    // ── 7. VFX / Audio Cue ─────────────────────────────────────────────────
    // VFX links to REAL seeded id vfx::vfx-fire-impact.
    // Audio: no real audio entity seeded (seed-audio.ts returns []).
    // Audio is captured as descriptive data with a pending note — no dangling link.
    {
      archetype: 'rules',
      label: 'VFX / Audio Cue',
      view: {
        kind: 'table',
        field: 'cues',
        columns: [{ key: 'id' }, { key: 'type' }, { key: 'catalog' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        return {
          data: {
            cues: [
              {
                id: 'NS_TutorialGlow',
                type: 'vfx',
                catalog: 'vfx',
                catalogEntityId: 'vfx-fire-impact',
                note:
                  'Recolor of vfx-fire-impact (golden/white palette) keyed to show_success step anim notify. ' +
                  'SHARED across the tutorial-beats catalog — one glow asset every beat spawns, not a per-beat asset.',
              },
              {
                id: 'SC_TutorialPrompt',
                type: 'audio',
                catalog: 'audio',
                catalogEntityId: 'audio-tutorial-prompt',
                note:
                  'pending audio catalog seed — a short UI chime played on show_prompt; add link once seeded. ' +
                  'SHARED across the tutorial-beats catalog (one prompt chime, not a per-beat cue).',
              },
            ],
            links: [
              { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'success-highlight' },
            ],
            audioPendingNote:
              'No audio entity seeded in audio catalog yet (seed-audio.ts returns []). ' +
              'SC_TutorialPrompt is modeled as descriptive data. ' +
              'Add link { catalogId: "audio", entityId: "audio-tutorial-prompt", role: "prompt-sfx" } ' +
              'once the audio catalog row is seeded.',
            wiringContract: {
              grantedBy:
                `NS_TutorialGlow Niagara system spawned by BP_TutorialBeat_${s} on show_success step; ` +
                'SC_TutorialPrompt SoundCue played via UAudioComponent on show_prompt step',
              activatedBy:
                'show_success step → SpawnSystemAtLocation(NS_TutorialGlow); ' +
                'show_prompt step → PlaySound(SC_TutorialPrompt)',
              dependencies: [
                'vfx (vfx-fire-impact — NS_FireImpactBurst recolored to NS_TutorialGlow)',
              ],
              verification:
                'L2: NS_TutorialGlow derives from NS_FireImpactBurst; ' +
                'L3: VSTutorialComprehensionTest — NS_TutorialGlow spawns on beat completion in PIE',
            },
          },
          links: [
            { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'success-highlight' },
          ],
        };
      },
      accept: allOf(
        minCount('cues', '≥1 VFX or audio cue bound', 1),
        entriesHaveFields('cues', 'every cue carries id + type + catalog target', ['id', 'type', 'catalog', 'catalogEntityId']),
        linksResolve(),
        wiringContractSound(),
      ),
    },

    // ── 8. VO ────────────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'VO',
      view: { kind: 'checklist', field: 'lines' },
      produce: (e: LabEntity) => {
        const m = mechanic(e.name);
        const ml = mech(e.name);
        const M = MECH(e.name);
        return {
          data: {
            // Cue ids + localization keys derive from the beat's own mechanic token, so two
            // beats can never claim the same VO cue, SoundCue asset or LocRes key.
            lines: [
              `coach_${ml}_prompt   — "Press [${ml} button] to roll out of harm's way." (shown at show_prompt)`,
              `coach_${ml}_success  — "Well done. You'll need that reflex out there." (shown at show_success)`,
              `coach_${ml}_retry    — "Not quite — try again." (shown on timeout retry)`,
            ],
            localizationKeys: [`TUT_${M}_PROMPT`, `TUT_${M}_SUCCESS`, `TUT_${M}_RETRY`],
            voNote:
              'VO lines match the post-Sundering tone (grim/earned, per game-tone canon). ' +
              `Bound to SC_VO_TutorialCoach_${m}_{Prompt,Success,Retry} SoundCues (pending audio catalog seed). ` +
              'Text variants (no-VO fallback) use the localization keys below.',
          },
        };
      },
      accept: minCount('lines', '≥1 VO line defined', 1),
    },

    // ── 9. Telemetry ─────────────────────────────────────────────────────────
    // Fires all 4 required events per tutorial-telemetry canon.
    {
      archetype: 'rules',
      label: 'Telemetry',
      view: {
        kind: 'table',
        field: 'telemetry',
        columns: [{ key: 'events' }, { key: 'comprehensionMetric' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const ml = mech(e.name);
        return {
        data: {
          telemetry: {
            events: [
              {
                name: 'beat_started',
                trigger: 'Trigger fires → BeginBeat()',
                payload: '{ beatId, entitySlug, attemptIndex }',
              },
              {
                name: 'beat_completed',
                trigger: 'Outcome: success path reached',
                payload: '{ beatId, entitySlug, attemptIndex, timeToComplete_ms }',
              },
              {
                name: 'beat_skipped',
                trigger: 'Outcome: skip condition met before beat fires',
                payload: '{ beatId, entitySlug, reason: "already_introduced | level_gate" }',
              },
              {
                name: 'beat_failed',
                trigger: 'Outcome: maxRetries exhausted',
                payload: '{ beatId, entitySlug, failCount, lastStepReached }',
              },
            ],
            comprehensionMetric: `${ml}_success_rate`,
            comprehensionMetricDef:
              `${ml}_success_rate = beat_completed_count / (beat_completed_count + beat_failed_count) ` +
              'per beatId, rolling 7-day window. Persisted to analytics backend via UARPGTelemetrySubsystem. ' +
              'Drop-off is measurable per beat (canon tutorial-telemetry).',
            wiringContract: {
              grantedBy: `UARPGTelemetrySubsystem::RecordBeatEvent() called by BP_TutorialBeat_${s} at each outcome`,
              activatedBy: `BP_TutorialBeat_${s} outcome handlers: OnSuccess / OnSkip / OnFail each call RecordBeatEvent`,
              dependencies: ['characters (player session context for analytics tagging)'],
              verification:
                'L2: UARPGTelemetrySubsystem declared in Source/PoF/ with RecordBeatEvent(); ' +
                'L3: VSTutorialComprehensionTest — all 4 event names recorded in analytics log during a PIE run',
            },
          },
        },
        };
      },
      accept: allOf(
        fieldsPopulated('telemetry', 'Telemetry events + comprehension metric defined', [
          'events',
          'comprehensionMetric',
        ]),
        wiringContractSound('telemetry'),
      ),
    },

    // ── 10. Icon 2D Art ──────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      engine: 'Leonardo',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { ...gallerySeed('selected', 4) },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A tutorial beat icon is selected'),
    },

    // ── 11. Localization ─────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: (e: LabEntity) => {
        const M = MECH(e.name);
        return {
          data: {
            // Real localization content — en source + cs translation per key, not a bare
            // key-name schema (the judge fleet failed the stub form, 2026-07-07).
            // The key PREFIX derives from the beat's own mechanic token (TUT_<M>_), so two
            // beats can never write the same LocRes key.
            keys: [
              `TUT_${M}_PROMPT: en "Press [SPACE] as the strike lands to roll through it." · cs "Stiskni [SPACE] ve chvíli úderu a prokutálej se skrz."`,
              `TUT_${M}_SUCCESS: en "Perfect roll — you passed clean through the attack." · cs "Dokonalý kotoul — útok tě zcela minul."`,
              `TUT_${M}_RETRY: en "Too early. Watch the wind-up, then roll." · cs "Příliš brzy. Sleduj nápřah, pak se kutál."`,
              `TUT_${M}_SKIP: en "Hold [TAB] to skip this lesson." · cs "Podržením [TAB] lekci přeskočíš."`,
              `TUT_${M}_FAIL: en "That one hurt. The roll grants brief immunity — time it to the hit." · cs "Tohle bolelo. Kotoul dává chvilkovou nezranitelnost — načasuj ho na zásah."`,
            ],
            locales: ['en', 'cs'],
            format: 'key: en "<source>" · cs "<translation>" — en is the authoring truth; cs seeds the LocRes pipeline',
          },
        };
      },
      accept: minCount('keys', '≥1 localization key defined', 1),
    },

    // ── 12. Test Gate ────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: (e: LabEntity) => {
        const m = mechanic(e.name);
        const ml = mech(e.name);
        return {
          data: {
            checks: [
              `beat triggers on OnEnterZone when Tutorial.${m}.Introduced tag is absent`,
              `beat does NOT trigger when Tutorial.${m}.Introduced is already set`,
              'IA_Attack / IA_Skill_* inputs are locked while sandbox is active',
              `sequence advances to show_success on ${ml}_executed`,
              'after maxRetries=3 the fail path fires and sandbox unlocks',
              'beat_started / beat_completed / beat_skipped / beat_failed all recorded in analytics log',
              `${ml}_success_rate comprehensionMetric persisted to UARPGTelemetrySubsystem`,
            ],
          },
        };
      },
      accept: entityRuntimeDeferred(
        'VSTutorialComprehensionTest',
        'Beat triggers, teaches dodge, fires all 4 telemetry events, and records comprehensionMetric in PIE',
      ),
    },

    // ── 13. UE Packaging ─────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const m = mechanic(e.name);
        const assets = [
          `DT_TutorialBeats :: ${s}`,
          `BP_TutorialBeat_${s}`,
          `T_${s}_Pointer`,
          `T_${s}_Icon`,
          // Catalog-shared success glow (one asset every beat spawns), not per-beat.
          `NS_TutorialGlow`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'BP_TutorialBeat_' + s + ' actor placed in the tutorial area level; ' +
                'reads config from DT_TutorialBeats row keyed by "' + s + '"',
              activatedBy:
                'AARPGTriggerBox::OnBeginOverlap → BP_TutorialBeat_' + s + '::BeginBeat() — ' +
                'locks sandbox, steps sequence, fires telemetry, unlocks on outcome',
              dependencies: [
                'hud-elements (hud-health-bar — pointer overlay slot)',
                `icon-sets (iconset-abilities — IA_${m} icon atlas)`,
                'vfx (vfx-fire-impact — NS_TutorialGlow derives from NS_FireImpactBurst)',
                `input-schemes (IA_${m}, IA_Attack, IA_Skill_* Enhanced Input actions)`,
                'characters (player UAbilitySystemComponent + UARPGGameplayTagComponent)',
              ],
              verification:
                'L2: DT_TutorialBeats row seeded via seed_tutorial_beats.py; BP_TutorialBeat_' + s + ' compiled; ' +
                'L3: VSTutorialComprehensionTest — full beat cycle passes in PIE with all 4 telemetry events',
            },
          },
          ueAssets: assets.map((a) => `/Game/Tutorial/${a}`),
        };
      },
      accept: allOf(
        minCount('assets', 'All tutorial beat assets packaged', 2),
        wiringContractSound(),
      ),
    },
  ],
});
