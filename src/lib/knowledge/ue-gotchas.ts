import type { PromptKind } from './types';

/**
 * A hard-won UE pitfall from the vertical-slice initiative. Each is filtered
 * into prompts by `appliesTo` so a prompt only carries the lessons it can hit.
 */
export interface Gotcha {
  id: string;
  summary: string;
  detail: string;
  appliesTo: PromptKind[];
  /**
   * Domain tags scoping this pitfall to relevant modules. Omitted → UNIVERSAL
   * (applies to every module of its `appliesTo` kind — e.g. "introspect the API
   * first" is true for all Python). When present, the gotcha is only injected
   * for a module whose domains intersect these tags. See {@link MODULE_GOTCHA_DOMAINS}.
   */
  modules?: string[];
  source: string;
}

export const UE_GOTCHAS: Gotcha[] = [
  {
    id: 'material-const3vector-pin',
    modules: ['materials'],
    summary: 'Constant3Vector output pin is "" not "RGB"',
    detail:
      'A MaterialExpressionConstant3Vector exposes its output on pin "" — connect_material_property(node, "RGB", ...) silently returns false and yields a black material. Use the empty-string pin name.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: materials',
  },
  {
    id: 'umg-rebuildwidget-timing',
    modules: ['ui'],
    summary: 'a code-only UUserWidget builds its Slate tree in RebuildWidget(), not NativeConstruct()',
    detail:
      'A C++-only UUserWidget with no UMG asset must construct its widget hierarchy by overriding RebuildWidget(); NativeConstruct() runs too late and the tree is empty. BindWidget members still require a WBP.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: HUD',
  },
  {
    id: 'umg-debug-text-overlay',
    modules: ['ui'],
    summary: 'AddOnScreenDebugMessage debug text draws over UMG and pins to the top-left',
    detail:
      'GEngine->AddOnScreenDebugMessage prints above all UMG and pins to the top-left corner, colliding with anything placed there and confounding screenshot/vision HUD checks. Either offset HUD elements down (the slice put the player health bar at y=90) or disable it in dev with the DisableAllScreenMessages console command.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: HUD',
  },
  {
    id: 'cmd-quote-wrap',
    modules: ['packaging'],
    summary: 'cmd.exe /c with an embedded quoted command needs windowsVerbatimArguments + an outer-quote wrap',
    detail:
      'Spawning cmd.exe /c "<command with its own quotes>" on Windows requires windowsVerbatimArguments: true AND wrapping the whole command in an extra pair of outer quotes, or the inner quotes are stripped.',
    appliesTo: ['packaging'],
    source: 'vertical-slice: packaging',
  },
  {
    id: 'interchange-fbx-commandlet-crash',
    modules: ['character', 'animation'],
    summary: 'FBX import via Interchange breaks under -run=pythonscript (5.7 crash; 5.8 silent "nothing to import") — disable the Interchange FBX flag and use the legacy path',
    detail:
      'The Interchange FBX path does not work in the pythonscript commandlet: UE 5.7 crashes; UE 5.8 intercepts AssetImportTask even when task.options is a legacy FbxImportUI and fails with LogInterchangeEngine "There was nothing to import from the provided source data using the chosen pipeline options" (imported_object_paths comes back empty). Fix (proven on 5.8.0): run unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX 0") at the top of the script — the import then routes through the legacy FBXImport honoring FbxImportUI, and skeletal FBX (mesh + skeleton + AnimSequence) imports fine headless. Also ensure the FBX actually CONTAINS a skinned mesh: a Blender export with use_selection that selects only the armature yields a mesh-less FBX and the legacy path fails with a bare "Import failed".',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: characters',
  },
  {
    id: 'runtime-module-editor-api',
    summary: 'a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded',
    detail:
      'Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: characters',
  },
  {
    id: 'plugin-content-rescan',
    modules: ['character', 'animation'],
    summary: 'newly-enabled engine-plugin content needs an asset-registry rescan',
    detail:
      'After enabling an engine plugin that ships content (e.g. MoverTests), its assets are invisible until the asset registry rescans the mounted path under -run=pythonscript. Trigger a scan before referencing the assets.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: harness',
  },
  {
    id: 'python-api-introspect-first',
    summary: 'verify unreal.* API names by introspection before calling — never guess',
    detail:
      'Guessed unreal.* class/method/property names fail silently (return None/false) or crash the pythonscript commandlet, and each wrong guess burns tokens on retries. Before calling an unfamiliar API, confirm it exists and check its signature: use mcp-unreal lookup_class / lookup_docs / subsystem_query, or `dir(unreal.X)`, `help(unreal.X.method)`, and `unreal.X.__doc__` inside execute_script. Prefer EditorSubsystem getters (unreal.get_editor_subsystem(...)) over deprecated global helpers.',
    appliesTo: ['ue-python'],
    source: 'research: Claude-in-UE5 demo (Stefan 3D AI) + VibeUE introspection',
  },
  {
    id: 'fbx-import-scale',
    modules: ['character', 'animation', '3d'],
    summary: 'metre-authored FBX: Blender apply_unit_scale=True + UE import_uniform_scale=1.0',
    detail:
      'For meshes authored in metres, export from Blender with apply_unit_scale=True and import into UE with import_uniform_scale = 1.0 (not 100), or the mesh is 100x off.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: characters',
  },
  {
    id: 'lumen-swrt-thin-geometry',
    modules: ['materials', 'world', 'lighting'],
    summary: 'Lumen software tracing misses thin geometry — raise the mesh Distance Field Resolution Scale',
    detail:
      'With Lumen Software Ray Tracing, thin meshes (walls, ceilings, railings) drop out of the mesh distance field and leak light / lose GI. Fix per-mesh in the Static Mesh Editor build settings: raise Distance Field Resolution Scale (e.g. ~10-20) — costs memory/disk but resolves thin geo — or thicken the mesh. Visualize with Show Flags → Visualize → Mesh Distance Fields.',
    appliesTo: ['ue-python'],
    source: 'research: Lumen in AAA (Karim Yasser)',
  },
  {
    id: 'lumen-swrt-mode-by-scale',
    modules: ['materials', 'world', 'lighting'],
    summary: 'Pick Lumen SWRT mode by world scale: Detail Tracing (per-mesh) vs Global Tracing (large worlds)',
    detail:
      'Lumen Software Ray Tracing has two modes. Detail Tracing uses per-mesh distance fields — accurate, best for focused/interior or small-distance detail. Global Tracing uses the low-res global distance field — cheaper + faster, loses small-distance detail, best for large open-world environments. Choose by project scale, not by default.',
    appliesTo: ['ue-python'],
    source: 'research: Lumen in AAA (Karim Yasser)',
  },
  {
    id: 'lumen-hwrt-reflection-cache',
    modules: ['materials', 'world', 'lighting'],
    summary: 'Lumen HWRT surface-cache gives black/inaccurate reflections on smooth surfaces — use Hit Lighting for Reflections',
    detail:
      'With Hardware Ray Tracing, the default Surface Cache produces black or wrong reflections on smooth/specular surfaces (water, polished floors). Set the post-process Lumen reflection method to "Hit Lighting for Reflections" for accurate reflections at moderate cost. Avoid full "Hit Lighting" in shipping games — it casts far more indirect rays and is too expensive to be reliable.',
    appliesTo: ['ue-python'],
    source: 'research: Lumen in AAA (Karim Yasser)',
  },
  {
    id: 'modular-character-accessory-rigging',
    modules: ['character', '3d'],
    summary: 'Modular character: weight rigid accessories to ONE bone, hide occluded body mesh, keep swap-slots exclusive',
    detail:
      'For customizable/modular characters: (1) rigid accessories (hats, glasses, held props) must be weighted 100% to a single bone (head; or a hand socket via parenting) — NOT auto-skinned to the body, or they deform with it. (2) Hide/remove body mesh occluded by equipped clothing (do not render the torso under a shirt) to save draw cost. (3) Make swappable slots mutually exclusive (legs vs pants in one category) so they do not co-occupy and clip. (4) Generate the body WITH a placeholder head for proportion, then swap in a higher-detail head (bridge the neck loops). Show holdables only in the matching animation state.',
    appliesTo: ['ue-python'],
    source: 'research: Modular 3D Character (Stefan 3D AI)',
  },
  {
    id: 'niagara-effect-types-significance',
    modules: ['vfx'],
    summary: 'Cap active Niagara systems with Effect Types (significance + max-instance + visibility cull) — hidden systems still TICK',
    detail:
      'A disabled renderer or off-screen Niagara system still TICKS (and GPU sims still cost the render thread via compute dispatch) — hiding it does not save the cost. Use Effect Types (like texture groups, assigned per system): a significance manager (distance/age) + hard max-instance caps + visibility culling (pre-spawn check + a short re-show delay) cull the TICK. This roughly halves active systems with identical visuals (Lyra). Caveat: at very high system counts the significance-manager refresh itself can spike — keep counts sane.',
    appliesTo: ['ue-cpp', 'ue-python'],
    source: 'research: Optimizing Niagara, Unreal Fest 2025 (A. Kurali)',
  },
  {
    id: 'niagara-insights-stat-named-events',
    modules: ['vfx'],
    summary: 'Profiling Niagara in Unreal Insights needs `stat named events` — else Niagara is invisible in the capture',
    detail:
      'Niagara work will NOT appear in an Unreal Insights trace unless `stat named events` is enabled before capturing. For quick triage use stat NiagaraSystems / stat NiagaraEmitters (per-system/emitter cost, with the owning system/actor) and the in-editor Niagara Debugger (effects outliner shows systems ticking while invisible + GPU compute cost).',
    appliesTo: ['ue-cpp', 'ue-python'],
    source: 'research: Optimizing Niagara, Unreal Fest 2025 (A. Kurali)',
  },
  {
    id: 'gas-meta-attribute-damage',
    modules: ['gas', 'combat'],
    summary: 'GAS: model damage as a server-only META attribute, apply via GameplayEffect, clamp in PostGameplayEffectExecute — never SetHealth directly',
    detail:
      'Route ALL attribute changes through GameplayEffects (so prediction/stacking/calc work) — never call the attribute setter directly. Model damage as a meta attribute (server-only, not replicated): a GE adds to Damage; in PostGameplayEffectExecute, read Damage, reset it to 0, subtract from Health, and clamp Health to [0, MaxHealth] (clamp in PreAttributeChange too). Health/MaxHealth ARE replicated.',
    appliesTo: ['ue-cpp'],
    source: 'research: GAS in 20 minutes (Danny Goodayle)',
  },
  {
    id: 'gas-repnotify-and-cosmetic-cues',
    modules: ['gas', 'combat'],
    summary: 'GAS: replicated attributes need GAMEPLAYATTRIBUTE_REPNOTIFY in OnRep; Gameplay Cues are COSMETIC ONLY',
    detail:
      'Each replicated attribute needs an OnRep_ that calls GAMEPLAYATTRIBUTE_REPNOTIFY(USet, Attribute) — without it the ASC never sees replicated value changes. Use the ATTRIBUTE_ACCESSORS macro set for the getter/setter/init. Gameplay Cues are for COSMETIC feedback only (VFX/SFX/shader), keyed by gameplay tag — never put gameplay logic in a cue.',
    appliesTo: ['ue-cpp'],
    source: 'research: GAS in 20 minutes (Danny Goodayle)',
  },
  {
    id: 'motion-matching-pitfalls',
    modules: ['animation'],
    summary: 'Motion Matching: anims need root motion even w/o capsule root motion; the Phase channel CRASHES the editor; tune cost bias carefully',
    detail:
      'Source anims in a Pose Search database need root motion ENABLED even when the capsule is driven by velocity (not root motion) — the pose search scores foot velocity/position from it. Do NOT enable the Phase channel in the pose-search schema — it crashes the editor and keeps crashing on reopen. Collected bones (pose history) must match the bones in the pose channel. Do not lower Continuing Pose Cost Bias too far (the character becomes unresponsive / sticks in one animation); if a Chooser will not leave a loop DB for a stop DB, lower the stop DB base cost bias. Reduce foot sliding with a SMALL play-rate window (~0.75-1.25, not 0.5-1.5) or Dead Blending; be cautious with mirroring (foot sliding / tilt). Use Exclude-From-Database (not a manual cut) to drop T-posed lead frames.',
    appliesTo: ['ue-cpp', 'ue-python'],
    source: 'research: Motion Matching Problems & Solutions (Unreal DevOP)',
  },
  {
    id: 'ai-mesh-segment-before-rig',
    modules: ['character', '3d'],
    summary: 'AI-generated 3D is one fused mesh — segment into NAMED parts before rigging (riggable + modular)',
    detail:
      'Text/image-to-3D models (Tripo, Hunyuan, Meshy, Roblox Cube/CubePart) output a single solid mesh that is hard to rig, animate, or make modular. Before rigging, segment it into semantically NAMED parts (wheel/body/grip; or head/torso/arms/legs) so each is an independently-skinnable mesh / Skeletal Mesh section / modular swap-slot. Prefer GEOMETRY-ACCURATE part cutters (Tripo V2 / Rodin: cut on the real geometry, 15+ parts, API + commercial-OK) over LATENT-RESAMPLE segmenters (Roblox CubePart: open + local but research-only license, and it reconstructs a lower-detail mesh in a fixed latent space instead of splitting your input — max ~8 parts, no texture, detail loss). After segmenting, apply the modular-character rules (rigid parts weighted to one bone, exclusive swap-slots, hide occluded mesh).',
    appliesTo: ['ue-python'],
    source: 'research: Roblox CubePart 3D part-segmentation (Stefan 3D AI)',
  },
  {
    id: 'metahuman-conform-input-prep',
    modules: ['character', '3d'],
    summary: 'AI→MetaHuman conform: input mesh needs an A-pose, separated fingers, armpit/leg clearance, hair+lashes removed, and a separate high-poly head — or the auto-solve mis-conforms',
    detail:
      "UE 5.8 'Mesh to MetaHuman' conforms an arbitrary-topology human mesh into a fully-rigged MetaHuman via an auto-solve. For a clean solve, prepare the input mesh (from Tripo/Hunyuan/etc.): (1) use an A-pose with clear space between the legs and the arms held away from the torso — tight armpits/legs make the body conform fold. (2) Physically SEPARATE all fingers — fused/close fingers make the solver mis-count (it can place 4 finger markers on 2 fingers), needing a manual fix via Reset Body + hand-placing/adding solve points. (3) REMOVE hair and eyelashes — the body conforms AROUND hair into a distorted skull; generate hair/branches/accessories as SEPARATE meshes to rig on top later. (4) Keep the source HIGH-POLY (an HD mesh, not a smart/low-poly one) — it doubles as the bake reference for normal/color transfer. (5) Model the head as a SEPARATE high-detail mesh (no lashes). (6) Scale the assembled mesh to the free 'MetaHuman conform body' size reference (Fab), apply scale+rotation with transforms zeroed, then export the combined GLB as a static mesh. Auto-solve is a starting point: expect to hand-align points for complex/custom topology.",
    appliesTo: ['ue-python'],
    source: 'research: AI to MetaHuman UE 5.8 workflow (Stefan 3D AI)',
  },
  {
    id: 'metahuman-conform-texture-export',
    modules: ['character', '3d'],
    summary: 'MetaHuman conform texturing/rig-export: save the DNA pose BEFORE it changes, shift UDIMs to one UE UV tile, disable Add Leaf Bones, flip the normal-map green channel',
    detail:
      "Four pitfalls break the texture + accessory-rig round-trip after a MetaHuman conform: (1) At the manual-solve stage SAVE the conformed pose to a DNA file BEFORE moving to the next tab (the pose changes there). Baking transfers color/normal from the original high-poly mesh to the conform's generated skeletal mesh and is IMPOSSIBLE if the two poses don't match — so save-pose is what makes baking possible; the DNA export is reversible. (2) MetaHuman meshes use UDIMs (the body sits on the 2nd UDIM tile), which Blender/AI-texturing can't bake across: in Blender shift the body UVs by -1 tile into a single 0-1 space (re-shift to UE space on the way back). (3) BAKE-FREE alternative for stylized/toon characters that don't need normals: skip Blender baking and texture the conformed body with image-to-3D AI (Tripo) — export the MetaHuman-UV mesh and keep 'use original UV' ON so the AI paints color that follows the MetaHuman UV exactly (no neck-seam transition work). (4) When exporting a rigged accessory FBX from Blender, DISABLE 'Add Leaf Bones' or the armature won't match the MetaHuman skeleton; name the armature 'root'; select armature+mesh only; and on UE import enable 'flip normal map green channel' for normals baked in Blender/Marmoset (OpenGL→DirectX).",
    appliesTo: ['ue-python'],
    source: 'research: AI to MetaHuman UE 5.8 workflow (Stefan 3D AI)',
  },
  {
    id: 'metahuman-animator-headless-memory-window',
    modules: ['character', 'animation'],
    summary: 'MetaHuman Animator markerless solve leaks memory on long clips — window the headless solve with MetaHumanPerformance.set_processing_range, do not feed a whole long clip',
    detail:
      "UE 5.8 MetaHuman Animator turns plain markerless video into MetaHuman face/body animation, and its solve API is fully Python-exposed and loads HEADLESS (verified on 5.8.0 with the MetaHuman + MetaHumanAnimationTools plugins enabled): unreal.MetaHumanPerformance exposes can_process / start_pipeline / set_blocking_processing (the unattended/batch flag) / set_processing_range / is_processing / get_number_of_processed_frames / contains_animation_data / export_animation, plus MetaHumanPerformanceExportUtils.export_animation_sequence and MetaHumanIdentity.start_frame_tracking_pipeline / export_dna_data_to_files. The pitfall: the ML solve's memory usage ramps roughly LINEARLY with clip length and is not released mid-process — a 4K60 clip past ~30-40s can exhaust RAM and crash even with a large page file. The GUI Live Link Hub gives no control over this, forcing users to physically pre-cut the video into ~30s chunks. In the HEADLESS PoF path you have a better lever: call set_processing_range(start_frame, end_frame) to solve the footage in bounded windows without cutting the source video, and set_blocking_processing(True) so each window completes before the next. Check diagnostics_indicates_processing_issue() after each window. (Pairs with the root-drift stitch gotcha — independent windows still need re-anchoring.)",
    appliesTo: ['ue-python'],
    source: 'research: MetaHuman Animator human-animation pipeline (Curtis Holt) + live 5.8 API probe',
  },
  {
    id: 'metahuman-animator-window-root-stitch',
    modules: ['character', 'animation'],
    summary: 'MetaHuman Animator solves each footage window in ISOLATION at world origin — stitch windows and re-anchor per-window root/pelvis offset, or the character teleports between chunks',
    detail:
      "When you solve markerless footage in multiple passes (separate clips, or set_processing_range windows via MetaHumanPerformance.start_pipeline), each pass is solved INDEPENDENTLY with no memory of the previous pass's world state — every window's root/pelvis is placed around world origin, so naively concatenating the exported AnimSequences makes the character snap back to origin at each window boundary. A stitch pass is required after export: append each window's frames onto the previous window's tail AND correct the per-window root (pelvis) translation + rotation by the accumulated offset carried from the end of the prior window (convert rotations to a consistent representation before summing — a MetaHuman/DNA rig authored in Euler must be handled as quaternions to compose rotations correctly). Preserve a stable clip naming convention (…_1, _2, _3) so the stitcher can auto-detect and order the windows. This is the animation analog of the mesh-critique geometry gate: a clean per-window solve can still produce a broken concatenated take.",
    appliesTo: ['ue-python'],
    source: 'research: MetaHuman Animator human-animation pipeline (Curtis Holt) + live 5.8 API probe',
  },
  {
    id: 'ai-motion-generator-ue-ingestion',
    modules: ['animation', 'character'],
    summary:
      'AI motion generators (NVIDIA ARDY etc.) export raw joint data (.npz) on their OWN skeletons — no direct UE import; convert via a scripted Blender armature bake to FBX, then IK Retargeter to the UE5 skeleton, validating in Blender FIRST',
    detail:
      "Text/constraint-driven motion generators (e.g. NVIDIA ARDY — open-source SIGGRAPH 2026 autoregressive diffusion, real-time ~33ms/step, Apache-2.0 code + NVIDIA Open Model weights, headless scripts/generate.py) do NOT emit UE-ready animation: output is raw .npz joint data (world-space joints [T,J,3] + rotations + root + foot contacts) on the generator's own skeleton (ARDY: a 27-bone 'Core' or a Unitree G1 robot skeleton), with no FBX/BVH export. UE ingestion is a 2-hop chain with known pitfalls: (1) CONVERT — build an armature in scripted headless Blender from the npz joints/rotations and bake keyframes, then export FBX (disable Add Leaf Bones; watch FBX axis/scale conventions — a wrong axis convention renders the skeleton lying flat or crumpled in UE while Blender plays it perfectly, the Tripo bind-pose-scramble failure mode); (2) RETARGET — the foreign skeleton never matches the UE5 Mannequin, so retarget with the IK Retargeter (as with Mixamo); validate bone orientation + a few frames in Blender BEFORE the UE import, and judge the UE result by a rendered filmstrip, not by import success. Also note the generator's own gates: ARDY's text encoder is the HF-GATED meta-llama/Meta-Llama-3-8B-Instruct (needs an approved HF token) and real-time use wants a 24GB GPU.",
    appliesTo: ['ue-python'],
    source: 'research: NVIDIA ARDY real-time AI animation (Stefan 3D AI) + nv-tlabs/ardy repo verification',
  },
  {
    id: 'fbx-animsequence-import-fresh-folder',
    modules: ['animation', 'character'],
    summary:
      'Automated FBX import: any REIMPORT path silently skips AnimSequence creation — import into a genuinely FRESH folder (filesystem rm, not delete_directory), replace_existing=False, save=False + explicit save_asset',
    detail:
      "In a headless AssetImportTask FBX import (legacy path, Interchange disabled), the ANIMATION phase only runs on a truly fresh import: if the importer takes ANY reimport route ('Performing atomic reimport' in the log — triggered by an existing same-name asset at the destination, or replace_existing=True matching a prior import) it imports the SkeletalMesh/Skeleton but silently creates NO AnimSequence, with zero warnings (the log lacks the 'SortedLinks' bone-sorting lines that mark the anim phase). Three rules (proven on 5.8.0): (1) import into a FRESH destination folder and clear it on the FILESYSTEM (rm -rf) before launching UE — stale .uasset files can survive EditorAssetLibrary.delete_directory and still trigger the reimport path; (2) set replace_existing=False and task.save=False; (3) save explicitly AFTER import — task.save covers only the primary asset (the mesh), so the Skeleton and the AnimSequence are memory-only and VANISH when the commandlet exits unless you save_asset each (a later session then finds a mesh whose skeleton reference is broken). The created anim is named <file>_Anim; resolve assets in-session with an ARFilter(include_only_on_disk_assets=False) registry query, not a disk scan. Related 5.8 scripting walls: CompositeSection.start_time and AnimMontage.notifies are NOT settable from Python — compose multi-part montages by CONCATENATING the source animation upstream (one segment) and add sections/notify-states in the editor or via C++.",
    appliesTo: ['ue-python'],
    source: 'research: ARDY melee-combo pipeline (live 5.8 A/B debugging)',
  },
  {
    id: 'asset-swap-at-path-does-not-repoint-referencers',
    modules: ['animation', 'character'],
    summary:
      'rename_asset UPDATES serialized referencers — swapping an asset at its old path does NOT re-point Blueprints to the new asset; set the BP CDO property instead, and VERIFY by observing the runtime (montage_name), not the asset',
    detail:
      "The 'swap an asset at its original path' trick (rename old→backup, rename new→old path) silently does nothing for existing consumers: unreal.EditorAssetLibrary.rename_asset UPDATES all serialized referencers to follow the renamed asset, so every Blueprint that pointed at the old path now points at the BACKUP, and the new asset at the old path has zero consumers. Three-layer verification lesson (each layer hid the next): (1) re-point references explicitly — load the BP, unreal.get_default_object(bp.generated_class()).set_editor_property('attack_montage', new_asset), save the BP; check ALL related slots (a dodge has forward/backward/left/right/default); (2) C++ may bypass config entirely — grep for LoadObject<UAnimMontage>(TEXT(\"/Game/...\")) hard-coded fallbacks/overrides that discard the configured asset (a leftover 'always show something in PIE' self-heal overrode every configured melee montage); (3) verify at RUNTIME by observing which montage actually plays (the scenario observer's montage_name per sample), never by loading the asset path in a commandlet. Also for headless captures: a skeletal mesh only advances its pose when rendered — under -RenderOffScreen force VisibilityBasedAnimTickOption=AlwaysTickPoseAndRefreshBones + bEnableUpdateRateOptimizations=false on the observed mesh, or every sampled frame shows a stale pose and any montage looks frozen.",
    appliesTo: ['ue-python'],
    source: 'research: ARDY animation pipeline — three-layer blindness debugging (live 5.8)',
  },
  {
    id: 'gas-author-abilities-incrementally',
    modules: ['gas', 'combat'],
    summary: 'GAS: build an ability one coupled piece at a time (tag → input → effect → ability → grant/bind → cue), not the whole system in one shot',
    detail:
      "A single GAS ability spans several tightly-coupled pieces — a Gameplay Tag, an Input Action + input-config mapping, one or more GameplayEffects, the UGameplayAbility subclass, ASC granting + input binding, and (cosmetic) Gameplay Cues. One-shotting an entire ability (or a multi-ability system) in one pass reliably yields partially-wired, non-activating results: an ability that is never granted, an input that never triggers it, or an effect that never applies — all of which compile 'clean' and fail silently at runtime. Author incrementally and verify each layer before adding the next: create the tag + input and confirm the binding fires; grant the ability and confirm it activates; add the effect and confirm the attribute actually changes; then layer cues/UI. Prefer many small, individually-verified steps over one large generation.",
    appliesTo: ['ue-cpp', 'ue-python'],
    source: 'research: Aura the Unreal AI Agent (tryoura.dev)',
  },
];

/**
 * Domains each module's generation prompts should carry gotchas for. A module
 * present here is scoped to its listed domains; a module ABSENT here is UNKNOWN
 * and receives the conservative SUPERSET (all gotchas of the prompt kind) — a
 * missing mapping must never silently drop a relevant pitfall. Universal
 * gotchas (no `modules` tag) are always included regardless of this map.
 */
export const MODULE_GOTCHA_DOMAINS: Record<string, string[]> = {
  // Core Engine — aRPG
  'arpg-character': ['character', 'animation'],
  'arpg-animation': ['animation', 'character'],
  'arpg-gas': ['gas', 'combat'],
  'arpg-combat': ['gas', 'combat', 'animation'],
  'arpg-enemy-ai': ['ai', 'character', 'combat'],
  'arpg-inventory': ['ui'],
  'arpg-loot': [],
  'arpg-ui': ['ui'],
  'arpg-progression': [],
  'arpg-world': ['world', 'lighting', 'materials'],
  'arpg-save': [],
  'arpg-polish': ['vfx', 'world'],
  // Content
  'models': ['3d', 'character', 'materials'],
  'animations': ['animation', 'character'],
  'materials': ['materials'],
  'level-design': ['world', 'lighting', 'materials'],
  'ui-hud': ['ui'],
  'audio': ['audio'],
  // Game Systems
  'ai-behavior': ['ai'],
  'physics': [],
  'multiplayer': [],
  'save-load': [],
  'input-handling': ['ui'],
  'dialogue-quests': [],
  'packaging': ['packaging'],
};

/**
 * Render the gotchas whose `appliesTo` includes `kind` as a markdown
 * `## Known UE Pitfalls` block. Returns '' for `web` or when none match.
 *
 * When `module` is supplied AND recognized in {@link MODULE_GOTCHA_DOMAINS}, the
 * block is scoped: universal gotchas (no `modules` tag) plus those whose domain
 * tags intersect the module's domains — so a materials task no longer hauls
 * GAS/Niagara/motion-matching text. An UNKNOWN or omitted module falls back to
 * the full superset for the kind (never silently none).
 */
export function formatGotchas(kind: PromptKind, module?: string): string {
  if (kind === 'web') return '';
  let relevant = UE_GOTCHAS.filter((g) => g.appliesTo.includes(kind));

  const domains = module != null ? MODULE_GOTCHA_DOMAINS[module] : undefined;
  if (module != null && domains) {
    // Known module → keep universal gotchas + domain-matching ones.
    relevant = relevant.filter((g) => !g.modules || g.modules.some((m) => domains.includes(m)));
  }
  // module unknown/omitted → superset (relevant unchanged).

  if (relevant.length === 0) return '';
  const lines = relevant.map((g) => `- **${g.summary}** — ${g.detail} (${g.source})`);
  return `## Known UE Pitfalls\n${lines.join('\n')}`;
}
