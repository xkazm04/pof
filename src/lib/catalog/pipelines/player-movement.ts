import { registerCatalogPipeline } from '../pipeline-registry';
import { pythonStepSuccess, pythonStepOk, humanConfirmed } from '../acceptance/pythonStepCheckers';
import { visualDeferred } from '../acceptance/deferred';

/**
 * Player Movement pipeline (catalogId: 'player-movement').
 *
 * Tier-2 Mixamo + WASD + Shift sprint + Space roll. Ten steps drive the player
 * from no animation to a PIE-and-feel playable gated by a visual capture.
 *
 * Every step that builds UE assets dispatches a Python module on the editor
 * thread via /pof/python/run; acceptance reads the module's structured return
 * (created/skipped/failed lists) from the persisted artifact.
 *
 * See docs/superpowers/specs/2026-05-27-player-movement-design.md.
 */

const py = (module: string) => ({ python: { module, function: 'run' } });

registerCatalogPipeline({
  catalogId: 'player-movement',
  steps: [
    // ── 01. Mesh + skeleton + input bindings ──────────────────────────────────
    {
      archetype: 'rules',
      label: 'Mesh + Skeleton',
      view: { kind: 'manifest', field: 'issues' },
      produce: () => ({ data: { ...py('player_movement.verify_mesh') } }),
      accept: pythonStepOk('BP_VSPlayer mesh + IMC + IA assets present'),
      produceNote: 'Verifies BP_VSPlayer mesh = SKM_Manny, capsule sized, and IMC + IA assets exist.',
    },

    // ── 02. Mixamo source files ───────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Mixamo Source',
      view: { kind: 'checklist', field: 'confirmed' },
      produce: () => ({ data: { confirmed: false } }),
      accept: humanConfirmed('10 Mixamo FBX files in Raw/', 'confirmed'),
      produceNote:
        'Drop the 10 expected Mixamo FBX files into Content/Source/Mixamo/Raw/, then mark confirmed.',
    },

    // ── 03. Mixamo import ─────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'Import Mixamo Clips',
      view: { kind: 'manifest', field: 'created' },
      produce: () => ({ data: { ...py('player_movement.import_clips') } }),
      accept: pythonStepSuccess('10 AnimSequences imported under /Game/Mixamo/Raw/', 10),
      produceNote: 'Batch FBX import (idempotent). First clip brings the rig.',
    },

    // ── 04. IK rigs + retargeter ──────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'IK Rigs',
      view: { kind: 'manifest', field: 'created' },
      produce: () => ({ data: { ...py('player_movement.build_ik_rigs') } }),
      accept: pythonStepSuccess('IK_Mixamo + IK_Manny + RTG_MixamoToManny', 3),
      produceNote: 'Builds the two IK rigs + the Mixamo→Manny retargeter (idempotent).',
    },

    // ── 05. Batch retarget ────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'Retarget Clips',
      view: { kind: 'manifest', field: 'created' },
      produce: () => ({ data: { ...py('player_movement.retarget') } }),
      accept: pythonStepSuccess('10 _RT clips under /Game/Mixamo/Retargeted/SKM_Manny/', 10),
      produceNote: 'Batch retarget every Mixamo clip to the Manny skeleton.',
    },

    // ── 06. Blend space ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Blend Space Grid',
      view: { kind: 'manifest', field: 'created' },
      produce: () => ({ data: { ...py('player_movement.build_blend_space') } }),
      accept: pythonStepSuccess('11-sample 8-way strafe grid in BS_Locomotion', 11),
      produceNote: 'Wires 11 retargeted clips into BS_Locomotion (X=direction, Y=speed).',
    },

    // ── 07. PoFEditor build ───────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'PoFEditor Build',
      view: { kind: 'manifest', field: 'lib_present' },
      produce: () => ({
        data: {
          // No python call here; user (or the step panel) compiles PoFEditor + reloads the editor.
          // Acceptance probes for the library symbol via a separate python verify.
          ...py('player_movement.verify_anim_bp_lib'),
        },
      }),
      accept: pythonStepOk('UPoFAnimBPAuthoringLibrary symbol resolves in unreal'),
      produceNote:
        'Rebuild PoFEditor (Visual Studio / Rider) then restart the editor. This step is L0 — it ' +
        'just verifies the library symbol is available. Done once per PoFEditor source change.',
    },

    // ── 08. AnimBP authoring ──────────────────────────────────────────────────
    {
      archetype: 'graph',
      label: 'ABP_VSPlayer',
      view: { kind: 'graph', field: 'created' },
      produce: () => ({ data: { ...py('player_movement.build_anim_bp') } }),
      accept: pythonStepSuccess('ABP_VSPlayer authored + compiled', 1),
      produceNote: 'Calls UPoFAnimBPAuthoringLibrary: state machine + blend-space state + slot.',
    },

    // ── 09. Roll montage ──────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'AM_Roll Montage',
      view: { kind: 'manifest', field: 'created' },
      produce: () => ({ data: { ...py('player_movement.build_montage') } }),
      accept: pythonStepSuccess('AM_Roll with iframe notify at frame 2', 1),
      produceNote: 'Builds AM_Roll from Forward_Roll_RT + AnimNotify_DodgeWindow at frame 2.',
    },

    // ── 10. Playable gate (L4 visual) ─────────────────────────────────────────
    {
      archetype: 'custom',
      label: 'Playable Gate',
      view: { kind: 'manifest', field: 'frames' },
      produce: () => ({ data: { ...py('player_movement.run_playable_gate') } }),
      accept: visualDeferred('PIE + WASD/Sprint/Roll + 4-frame variance proves not-T-pose'),
      produceNote:
        'L4: drives PIE, injects WASD + Shift + Space, captures 4 frames, asserts walked/sprinted/' +
        'rolled and frame variance proves the AnimBP is driving the mesh.',
    },
  ],
});

/** Test-only export of the step list for unit tests. The pipeline registers itself on import. */
export const PLAYER_MOVEMENT_STEPS_TEST_HELPER = ['01-mesh-and-skeleton'] as const;
