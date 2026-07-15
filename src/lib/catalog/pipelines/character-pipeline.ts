import { registerCatalogPipeline } from '../pipeline-registry';
import { fieldsPopulated, minCount, selected } from '../acceptance/dataCheckers';
import { runtimeDeferred, visualDeferred } from '../acceptance/deferred';
import { meshGalleryCandidates } from '@/components/layout-lab/steps/shared/meshGalleryCandidates';

/**
 * Character Pipeline (catalogId: 'character-pipeline').
 *
 * The proven idea→playable-character workflow, ground-truthed on the standalone
 * `jinx` UE 5.8 project (2026-07-06/07): face-priority 2D concept (Leonardo GPT
 * Image 2) → 2D face gate → Tripo v3.1 image-to-3D → 3D face gate → auto-rig +
 * preset retargets (run/idle/roll, glb) → UE import (idle = skeleton master) →
 * playable wire (graph-free C++ blend AnimInstance) → game-tier convert
 * (40k faces / 2K textures, rig+anim preserved, ~14x smaller).
 *
 * Gates are the moat: EVERY generative step is verified by close-up renders
 * BEFORE the next credit spend. Seeded entity "Jinx" carries the real provenance
 * (task ids, gate verdicts, the P1/v2.5 failures) so future sessions inherit the
 * calibration, not just the recipe.
 */

registerCatalogPipeline({
  catalogId: 'character-pipeline',
  steps: [
    // ── 01. Face-priority 2D concept ──────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Concept 2D',
      engine: 'Leonardo',
      view: { kind: 'gallery', field: 'candidates', candidates: 3 },
      produce: () => ({
        data: {
          candidates: [
            { name: 'jinx_gptimg2 (v1)', verdict: 'face too menacing — glowing pupil-less eyes propagate to 3D', path: 'generated/jinx-leo/jinx_gptimg2.png' },
            { name: 'jinx_v2_friendly', verdict: 'face gate PASS — defined eyes with whites+pupils', path: 'generated/jinx-leo/jinx_v2_friendly.png' },
            { name: 'jinx_hd_concept', verdict: 'face gate PASS + detail-maximized (engraved bullets, stitching, fishnet)', path: 'generated/jinx-leo/jinx_hd_concept.png' },
          ],
          selected: 2,
          promptLaws: 'FACE PRIORITY block (eyes with white sclera + crisp pupils, no glow/makeup) + plain white bg + relaxed A-pose + head-to-toe',
        },
      }),
      accept: selected('selected', 'concept chosen after face gate'),
      produceNote: 'Leonardo GPT Image 2 (RENDER_3D, 1024x1536). The source face DETERMINES the 3D face — fix it here, not downstream.',
    },

    // ── 02. 2D face gate ──────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Face Gate 2D',
      engine: 'Blender',
      view: { kind: 'table', field: 'gate', columns: [{ key: 'verdict' }, { key: 'method' }, { key: 'criteria' }, { key: 'evidence' }] },
      produce: () => ({
        data: {
          gate: {
            verdict: 'pass',
            method: 'close-up crop review of eyes/mouth/brows before any 3D spend',
            criteria: 'visible sclera + defined pupils; natural brows; no glow/heavy makeup; expression readable',
            evidence: 'generated/tripo3d/face_v32_strip.png',
          },
        },
      }),
      accept: fieldsPopulated('gate', 'face gate recorded (verdict+method+evidence)', ['verdict', 'method', 'criteria', 'evidence']),
      produceNote: 'Cheapest gate in the chain. A creepy source face survives every downstream model — reject here.',
    },

    // ── 03. Image → 3D (model-version calibrated) ─────────────────────────────
    {
      archetype: 'gallery',
      label: '3D Generation',
      engine: 'Tripo',
      view: { kind: 'gallery', field: 'candidates', candidates: 3 },
      // Surface REAL generated .glb meshes when any exist on disk: each candidate carries
      // payload.glbUrl so the selected mesh renders in the interactive GlbViewer (orbit/
      // zoom) instead of a colored swatch. Empty manifest → honest deterministic swatch
      // fallback (never a fake 3D preview); acceptance (`selected`) is unchanged either way.
      genCandidates: {
        needsAssets: true,
        assetKind: '3d',
        build: (dir, seq, assets) => meshGalleryCandidates('candidates', 3, assets, dir, seq),
      },
      produce: () => ({
        data: {
          candidates: [
            { name: 'v2.5-20250123 (default)', verdict: 'FAIL — smeared face; the silent default, never leave model_version unset', task: 'fdcd9e71' },
            { name: 'P1-20260311', verdict: 'FAIL — low-poly tier (3MB, shard hair); NOT a hero model despite newest date', task: 'e83baf76' },
            { name: 'v3.1-20260211 (HD)', verdict: 'PASS — 45MB, woven braids, full facial structure', task: '696732ea-95df-4410-b6b6-42864a1408e4' },
          ],
          selected: 2,
          settings: 'Tripo image_to_model: model_version=v3.1-20260211, texture_quality=detailed, pbr=true',
        },
      }),
      accept: selected('selected', 'hero-tier 3D model chosen'),
      produceNote: 'Tripo REST (pof_tripo.mjs). API credits are a SEPARATE wallet from Studio credits. Free tier output is CC BY 4.0 (non-commercial).',
    },

    // ── 04. 3D face gate ──────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Face Gate 3D',
      engine: 'Blender',
      view: { kind: 'table', field: 'gate', columns: [{ key: 'verdict' }, { key: 'method' }, { key: 'criteria' }, { key: 'evidence' }] },
      produce: () => ({
        data: {
          gate: {
            verdict: 'pass',
            method: 'Blender headless close-up head renders (front/3q/profile) BEFORE rig spend (bl_face.py)',
            criteria: 'eyes with irises+lids survive meshing; braids read as geometry not tubes',
            evidence: 'generated/tripo3d/face_hd3_pair.png',
          },
        },
      }),
      accept: fieldsPopulated('gate', '3D face gate recorded', ['verdict', 'method', 'criteria', 'evidence']),
      produceNote: 'Rig + retargets cost ~55 credits — gate the mesh first. Re-texturing with a DIFFERENT reference image smears (projection mismatch); only regenerate.',
    },

    // ── 05. Auto-rig + preset clips ───────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'Rig & Clips',
      engine: 'Tripo',
      view: { kind: 'manifest', field: 'created' },
      produce: () => ({
        data: {
          created: [
            'rig 35684390 (animate_rig, biped, spec:tripo — 41 bones, NO hair bones)',
            'jinx_hd_run.glb (animate_retarget preset:run, baked, with geometry)',
            'jinx_hd_idle.glb (preset:idle)',
            'jinx_hd_roll.glb (preset:dive — the roll-type clip)',
          ],
          presets: 'idle/walk/run/jump/slash/shoot/hurt/dive/climb… (AnimationType enum)',
        },
      }),
      accept: minCount('created', 'rig + 3 preset clips produced', 4),
      produceNote: 'One rig, N retargets (reuse the rig task id — do not re-rig per clip). out_format glb imports cleanest via Interchange.',
    },

    // ── 06. UE import (shared-skeleton discipline) ────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Import',
      engine: 'UE Python',
      view: { kind: 'manifest', field: 'created' },
      produce: () => ({
        data: {
          created: [
            '/Game/JinxHD/Idle (master: mesh + skeleton + idle take)',
            '/Game/JinxHD/Run (anim-only, InterchangePipelineStackOverride bound to the idle skeleton)',
            '/Game/JinxHD/Roll (anim-only, same skeleton)',
          ],
          law: 'each Interchange glb import creates ITS OWN skeleton unless overridden — one master import, then bind every other take to that skeleton. When this pipeline targets the PoF UE project, emit proj-naming prefixes (SK_/A_) instead of the jinx-project paths recorded here.',
        },
      }),
      accept: minCount('created', 'mesh + takes on ONE shared skeleton', 3),
      produceNote: 'Commandlet (-run=pythonscript) with a PRE-QUOTED arg string (space-in-path silently boots the fallback project). Verify saves by re-reading the asset (save_asset only_if_is_dirty gotcha).',
    },

    // ── 07. Playable wire (Test Gate) ─────────────────────────────────────────
    {
      archetype: 'custom',
      label: 'Playable Wire',
      engine: 'UE C++',
      view: { kind: 'manifest', field: 'features' },
      produce: () => ({
        data: {
          features: [
            'graph-free C++ blend AnimInstance (idle<->run crossfade by input intent)',
            'SPACE roll: one-shot overlay + quadratic-decay dash + hip-XY lock',
            'per-bone run-pose corrections (ini/Details live-tunable)',
            'clips ini-configurable (DefaultGame.ini soft paths beat BP archetype staleness)',
          ],
        },
      }),
      accept: runtimeDeferred('VSCharacterPipelineTest', 'WASD run + SPACE roll verified in a live PIE session'),
      produceNote: 'L3: proven live in the standalone jinx project (PIE, 2026-07-07); deferred here until the pipeline targets the PoF UE project.',
    },

    // ── 08. Game-tier convert ─────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Game-Tier Convert',
      engine: 'Tripo',
      // Size budget bars: the game-tier footprint vs the HQ archive master (same unit,
      // the ~14x sustainability story) reads clearer as a bar pair than a table.
      view: { kind: 'chart', variant: 'bars', field: 'gameTier', rows: [{ key: 'sizeMB', label: 'Game tier', unit: 'MB' }, { key: 'hqSizeMB', label: 'HQ master', unit: 'MB' }], highlightKey: 'sizeMB', max: 66 },
      produce: () => ({
        data: {
          gameTier: {
            faceLimit: 40000,
            textureSize: 2048,
            sizeMB: 4.3,
            hqSizeMB: 60,
            rigPreserved: true,
            animPreserved: true,
          },
          law: 'convert_model on the RIGGED retarget task keeps bones+skinning+anim — convert once, ship the ~4MB tier; keep HQ as the archive master',
        },
      }),
      accept: fieldsPopulated('gameTier', 'game-tier budget recorded (size/faces/rig intact)', ['faceLimit', 'textureSize', 'sizeMB', 'rigPreserved']),
      produceNote: '~14x smaller per character at near-zero credit cost — the sustainability step for batch character production.',
    },

    // ── 09. Icon 2D Art (universal step) ──────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      engine: 'Leonardo',
      view: { kind: 'gallery', field: 'candidates', candidates: 3 },
      produce: () => ({
        data: {
          candidates: [{ name: 'portrait crop of the gated HD concept (256px, upper-left light)', path: 'generated/tripo3d/face_hd3_pair.png' }],
          selected: 0,
        },
      }),
      accept: selected('selected', 'character icon selected'),
      produceNote: 'Bind to the shared icon-sets presentation family (silhouette weight, rarity frame, light direction).',
    },

    // ── 10. Visual quality gate (L4) ──────────────────────────────────────────
    {
      archetype: 'custom',
      label: 'Visual Gate',
      engine: 'VLM',
      view: { kind: 'manifest', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'in-game frame: character reads on the gameplay camera',
            'run gait cycles without limb scramble',
            'roll completes without mesh/capsule flash',
          ],
        },
      }),
      accept: visualDeferred('gameplay-camera capture proves the character reads in-engine'),
      produceNote: 'L4: the -game -DumpMovie loop (or the L4 runner) captures frames; a VLM/human verdict closes it.',
    },
  ],
});

