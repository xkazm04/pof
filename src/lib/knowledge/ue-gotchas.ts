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
    id: 'chaos-cloth-asset-5-8-workflow',
    modules: ['character', '3d', 'animation'],
    summary: 'UE 5.8 Chaos Cloth Asset: build the Dataflow graph from a preset, drive it with Transfer Skin Weights + a physics-asset collider — save it as a REUSABLE asset',
    detail:
      'To add clothing physics to a skeletal character in UE 5.8 (the node-based Chaos Cloth Asset editor is now the default/production cloth path, replacing the old per-mesh clothing-data tabs): (1) ALWAYS create the Cloth Asset FROM A PRESET (e.g. "Static Mesh Cloth") — starting empty wires nothing. (2) Static Mesh node: point both the SIMULATION and RENDER mesh at the garment (reuse the same optimized mesh if it is already low-poly). (3) In the editor Preview Scene set the target Skeletal Mesh so what you see matches the character. (4) Transfer Skin Weights node — this auto-skins the garment to the target character and REPLACES most manual weight painting; it has two transfer methods (skinning vs closest-point-on-surface) — closest-point often beats paint on complex garments, so try both. (5) Weight Map node paints WHERE and HOW STRONGLY physics applies (fast recipe: vertex-select half → assign, then Relax-brush the boundary; brush mirroring exists). (6) Set Physics Asset node = the collider the cloth interacts with (reuse the character\'s physics asset; a simpler collider is cheaper). (7) Simulation Solver Config tunes iteration count. (8) Fix cloth clipping INTO the body with a Transform Position node at the END of the chain (nudge the offset) — do not re-author. Reuse: SAVE the asset and it carries every node/param/material preset — duplicate it and only re-point Transfer Skin Weights at a new character to reclothe. For STATIC (no-physics) garments you need only the Transfer Skin Weights (+ optional Transform Position) node — no rig/AccuRig step. Quality checks before calling it done: no body/garment penetration, weight-map coverage matches the intended-flexible region, a physics-asset collider IS set (else the cloth passes through the body), and solver iterations are sane for the material. Headless note: 5.8 Dataflow added Python scripting + the ChaosClothComponent is Python-exposed, so the graph is scriptable — but weight-map painting is brush-interactive (a residual-manual step, like MetaHuman conform\'s keypoint align); the Transfer-Skin-Weights auto-skin is the automatable core.',
    appliesTo: ['ue-python'],
    source: 'research: Easy Clothing with AI (Stefan 3D AI) + UE 5.8 Chaos Cloth docs',
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
    summary: 'AI→MetaHuman conform: input mesh needs an A-pose, separated fingers, armpit/leg clearance, hair+lashes removed, a separate high-poly head, and a NEUTRAL facial expression — or the auto-solve mis-conforms',
    detail:
      "UE 5.8 'Mesh to MetaHuman' conforms an arbitrary-topology human mesh into a fully-rigged MetaHuman via an auto-solve. For a clean solve, prepare the input mesh (from Tripo/Hunyuan/etc.): (1) use an A-pose with clear space between the legs and the arms held away from the torso — tight armpits/legs make the body conform fold. (2) Physically SEPARATE all fingers — fused/close fingers make the solver mis-count (it can place 4 finger markers on 2 fingers), needing a manual fix via Reset Body + hand-placing/adding solve points. (3) REMOVE hair and eyelashes — the body conforms AROUND hair into a distorted skull; generate hair/branches/accessories as SEPARATE meshes to rig on top later. (4) Keep the source HIGH-POLY (an HD mesh, not a smart/low-poly one) — it doubles as the bake reference for normal/color transfer. (5) Model the head as a SEPARATE high-detail mesh (no lashes). (6) Put the face in a NEUTRAL expression (eyes open, mouth relaxed) BEFORE the conform — edit the concept image to neutralize an expressive/damaged face (e.g. re-open a closed or scarred eye via an image edit) rather than conforming it; re-introduce scars/closed eyes AFTER the conform via the head-sculpt control points, or by zeroing that area's skin weights in Blender if it must not animate. (7) Scale the assembled mesh to the free 'MetaHuman conform body' size reference (Fab), apply scale+rotation with transforms zeroed, then export the combined GLB as a static mesh. Auto-solve is a starting point: expect to hand-align points for complex/custom topology.",
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
    id: 'metahuman-body-weight-transfer-garments',
    modules: ['character', '3d'],
    summary: 'Rig garments by TRANSFERRING skin weights from the conformed MetaHuman body — skip AccuRig/Mixamo for clothed characters',
    detail:
      "After a Mesh-to-MetaHuman conform you already own a perfectly-skinned body — use it as the rig source for clothing. Export the created MetaHuman's body+head WITH the skeleton (from the generated MetaHuman assets, in the MetaHuman bind pose), bring them to Blender, pose-align them to where the garments/assets were modeled and baked, then rig each DEFORMING garment/accessory by transferring skin weights from that body mesh (Blender's weight/data transfer), instead of routing through an external auto-rigger (AccuRig / Mixamo). The transferred weights are authored against the exact MetaHuman skeleton, so the garment re-imports onto the MetaHuman blueprint with matching deformation — and the result is better than a generic auto-rig because the MetaHuman body weighting is production-grade. Export per the accessory-FBX rules (disable Add Leaf Bones, armature named 'root', select armature+mesh only) so the skeleton survives the round trip; expect 1-2 iterations verifying weights in-engine. RIGID accessories still take the single-bone weight rule; UE-side simulated cloth takes the Chaos Cloth Transfer Skin Weights node — this Blender-side transfer is the general path for skinned (non-simulated) garments on any conform output.",
    appliesTo: ['ue-python'],
    source: 'research: Pro AI character workflow 2027 (Stefan 3D AI)',
  },
  {
    id: 'ai-lowpoly-generation-not-final',
    modules: ['character', '3d'],
    summary: 'AI low-poly/UV generation is 80-90% there, never final — the quality path is high-poly gen → retopo → deterministic UV → bake',
    detail:
      "Direct low-poly generation (and AI UV unwrapping, e.g. in Hunyuan-class studio tools) is a dice-roll — a clean result one run, an unusable one the next; accept it only for SMALL simple props, with the texture refined afterwards. For anything bake-quality: generate the HIGH-poly per part (separately-generated parts keep sharp local detail; one-mesh full-character generation costs hours of sculpt/separation later), refine the shape in Blender (elastic/shrinkwrap-class brushes handle 80-90% of AI-mesh cleanup — advanced sculpting tools are rarely needed), RETOPOLOGIZE deterministically (algorithmic quad-remesh for small objects; retopo tooling for hero parts — which also surfaces mesh-coverage imperfections), unwrap UVs on the clean topology (algorithmic island packing), then BAKE color/AO/normal from high-poly to low-poly with both aligned in the same position. The low-poly must fully COVER the high-poly or baked detail sinks below the surface in those areas. This bake path is what makes the AI-generated color texture production-usable downstream (pairs with the split-color-vs-PBR texturing practice).",
    appliesTo: ['ue-python'],
    source: 'research: Pro AI character workflow 2027 (Stefan 3D AI)',
  },
  {
    id: 'assembled-character-is-multi-shell',
    modules: ['character', '3d'],
    summary: 'A correct game character is MANY disconnected shells — judge fragmentation by face share, not component count, and know that select_interior_faces cannot see between shells',
    detail:
      "A production character is assembled, not welded: head, lashes, brows, layered eyes, an interior mouth carrying teeth and tongue, body, hands, hair, cape, accessories. Each is its own connected component, and that is CORRECT — the separable shells are the prerequisite for expressions (blend shapes and gaze need eyes/lashes/brows/mouth interior addressable independently) and for modular swap-slots. Two consequences for any tool that inspects such a mesh. (1) A raw connected-component COUNT cannot distinguish an assembled character from a shattered generation; use each component's SHARE OF THE TOTAL FACES — components under ~0.5% of the faces are specks/floaters, the rest are body parts. Measured on real Tripo character output: 375 components resolved to 61 substantial parts plus 314 specks holding 36% of the face budget, which is two separate defects (too many parts AND speck debris) that a single count reported as one. (2) Blender's bpy.ops.mesh.select_interior_faces() selects only faces whose every edge has more than 2 face users — i.e. WELDED interior. Probed on Blender 4.2 headless: a small cube fully enclosed inside a big cube and joined into one object selects 0 of 12 faces, while a welded shared wall selects 1. So it cannot cull the body under a chest plate or the scalp under a helmet — those are separate shells — and a 0 result means 'no welded interior found', never 'nothing is hidden'. Occlusion culling between shells needs visibility testing (raycast/render-based), not this operator.",
    appliesTo: ['ue-python'],
    source: 'research: anime character full 3D workflow (Stefan 3D AI) + live Blender 4.2 + Tripo mesh probes',
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
    id: 'metahuman-footage-ingest-capturemanager',
    modules: ['character', 'animation'],
    summary:
      'Video → MetaHuman markerless mocap: MetaHumanCaptureSource is DEPRECATED (5.7) — ingest a plain .mp4 headless with CaptureManagerIngestBlueprintLibrary.ingest_mono_video_sync, which returns a saved FootageCaptureData',
    detail:
      "To turn ordinary camera (or generated) video into MetaHuman Animator input, do NOT use UMetaHumanCaptureSource / UMetaHumanCaptureSourceSync — both are deprecated in 5.7 with the functionality moved to the CaptureManager modules. The scriptable entry point is unreal.CaptureManagerIngestBlueprintLibrary, whose 'Blocking' variants are explicitly intended for Python: ingest_mono_video_sync(video_path, audio_path, slate, take_number, CaptureManagerConversionParams()) returns a (UFootageCaptureData, error_text) tuple; siblings are ingest_stereo_video_sync / ingest_take_archive_sync / ingest_live_link_face_sync / ingest_calibration_sync. It runs fully headless under -run=pythonscript -nullrhi with -EnablePlugins=MetaHuman,MetaHumanAnimationTools,CaptureManagerCore,CaptureManagerDevices,CaptureManagerApp,CaptureManagerEditor — no Capture Manager / Live Link Hub GUI. It DECODES the video to a PNG image sequence outside the project (…/AppData/Local/CaptureManager/Media/<project>/MonoVideo/<slate>_<take>/Video/frame_000000.png …) and creates /Game/CaptureManager/Imports/<slate>_<take>/CD_<slate>_<take> referencing an ImgMediaSource — so the take's frames are NOT under Content and must be treated as an external dependency. Two follow-through catches: (1) the ingested asset can come back with frame_rate 0 on both FootageCaptureMetadata.frame_rate and ImgMediaSource.frame_rate_override — stamp the real rate (FrameRate(30, 1)) before use, since IsInitialized() rejects an invalid frame rate; (2) MetaHumanPerformance.can_process() for input_type MONO_FOOTAGE does NOT require a MetaHumanIdentity (that requirement is on the DEPTH_FOOTAGE branch) — it needs footage plus EITHER face_tracking OR (body_tracking AND the MetaHumanBodyTracker modular feature), so a BODY-only solve can legitimately skip building a face identity. If can_process() is still false with valid footage, the remaining gates are engine-level, not footage-level: a supported RHI (fails under -nullrhi — use -RenderOffScreen), the MetaHuman authoring objects being present (the MetaHuman Optional Content install), and a processing range whose upper bound exceeds its lower bound (set_processing_range).",
    appliesTo: ['ue-python'],
    source: 'research: MetaHuman Animator human-animation pipeline (Curtis Holt) + live 5.8 headless ingest probe',
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
  {
    id: 'dataflow-rig-transfer-5-8',
    modules: ['character', '3d', 'animation'],
    summary:
      'UE 5.8 Dataflow can TRANSFER a rig (skin weights, morph targets, polygroups) from an existing skeletal mesh onto a new mesh headless — the Zebra→Monster reuse path, scriptable via DataflowEditorBlueprintLibrary',
    detail:
      "5.8 Dataflow gained skeletal-mesh authoring + Python scripting, which makes rig REUSE scriptable: Epic's own Zebra→Monster workflow transfers an entire rig (skin weights, morph targets, DMC polygroups, skeleton) to a different mesh and low-res→high-res via the TransferMeshAttributes node. The chain (all verified headless on 5.8.0 with -EnablePlugins=Dataflow,GeometryCollectionPlugin -nullrhi): create a Dataflow asset via DataflowAssetFactory + AssetTools.create_asset, then author with DataflowEditorBlueprintLibrary — add_dataflow_node(dataflow, node_type_name, base_name, location) requires ALL FOUR args (location is an unreal.Vector2D; omitting it throws) and node_type_name is the full struct name WITH the F prefix: FGetSkeletalMeshDataflowNode → FSkeletalMeshToCollectionDataflowNode → FCollectionToMeshDataflowNode_v2 gives the SOURCE DataflowMesh; FGetStaticMeshDataflowNode → FStaticMeshToMeshDataflowNode_v2 gives the generated TARGET mesh; wire both into FTransferMeshAttributesDataflowNode (pins: SourceMesh = rig donor, Mesh = destination, modified in-place; select what transfers via its AttributeProxies instanced-struct array — SkinWeights/MorphTarget/Polygroup/Skeleton proxies); terminate with FMeshToSkeletalMeshTerminalNode_v2 (set SkeletalMeshAssetPath + SkeletonAssetPath string properties) which WRITES a rigged USkeletalMesh asset. FBindSkeletonToMeshDataflowNode_v2 also exists for binding a skeleton to an unrigged mesh. add_dataflow_node returns the node NAME (a Name, not an object) — pass names to connect_dataflow_nodes/set_dataflow_node_property. Node structs are Experimental; verify transfer QUALITY by evaluating and inspecting the output mesh, not by graph-authoring success.",
    appliesTo: ['ue-python'],
    source:
      'research: State of Rigging & Animation Tools in UE 5.8 (Unreal Fest Chicago 2026) + live 5.8 headless probe',
  },
  {
    id: 'control-rig-dynamics-secondary-motion',
    modules: ['character', 'animation'],
    summary:
      'Control Rig Dynamics (5.8) is the cheap runtime secondary-motion path — one SpawnDynamicsChains node drives multiple jiggle chains (ponytails, pouches, muscle), 5× faster than Control Rig Physics — but chains still need BONES to drive',
    detail:
      "UE 5.8 ships Control Rig Dynamics (Experimental ControlRigDynamics plugin), a particle-based simulation built specifically for character secondary motion — ponytails, hair, pouches, costume bits, muscle jiggle. It runs ~5× faster than Control Rig physics (the full Chaos-solver-in-rig path) and works at RUNTIME through a control-rig node in the Animation Blueprint, so generated characters can get living secondary motion in-game, not just in sequencer. One RigUnit_SpawnDynamicsChains node builds MULTIPLE jiggly chains, with stiffness/damping and per-length curves on the node; colliders/cone-limits/confiners are separate spawn units (RigUnit_SpawnDynamicsCollider etc.), and the whole surface is Python-exposed (verified headless on 5.8.0: RigUnit_SpawnDynamicsChains/SpawnDynamicsSolver/StepDynamicsSolver + RigDynamics* components all resolve). Use Dynamics for cosmetic chains and keep Control Rig PHYSICS for full-body/ragdoll interaction; the two mix in one rig. The catch for AI-generated characters: a dynamics chain drives BONES — a Tripo/Hunyuan character whose auto-rig has no hair/braid/accessory bones gives the solver nothing to move, so insert bone chains along those mesh regions first (Blender chain + weight transfer, or the segment-into-named-parts path). Debug with the dynamics debug window (launchable from the control-rig viewport; works during PIE).",
    appliesTo: ['ue-python'],
    source:
      'research: State of Rigging & Animation Tools in UE 5.8 (Unreal Fest Chicago 2026) + live 5.8 API probe',
  },
  {
    id: 'layered-physics-anim-transition-smoothing',
    modules: ['animation', 'character'],
    summary:
      'Hard pops between animation clips (retargeted/generated mocap): run a physics + full-body IK rig on a LAYERED control rig (5.8) to interpolate through transitions, then bake — sims need warm-up frames',
    detail:
      "Concatenated or swapped animation clips (Mixamo/Tripo/ARDY retargets, mocap takes) meet at HARD POPS — an instant pose discontinuity at the boundary. UE 5.8 Control Rig physics now works on LAYERED control rigs (long-requested), which enables a non-destructive smoothing pass: layer a physics rig + full-body IK (Epic ships a 'biped physics' rig module that sets this up for any biped in a few clicks) over the animation in sequencer, and the physics carries momentum THROUGH the boundary so the character smoothly interpolates between clips instead of popping — Epic calls out motion capture as the target use case. Physics can also be layered over plain animation sequences for natural ragdoll/impact moments and timed per-limb. Then BAKE: simulations re-run on every scrub (unpredictable), so bake to an AnimSequence — via auto bake or a manual bake — and for a simulation add WARM-UP FRAMES in the bake options so the sim settles before frame 0, giving deterministic, scrubbable results. Convex-hull physics bodies (new in 5.8, a shrink-wrapped collision mesh) make those collisions match the actual mesh instead of capsules. This is the in-UE alternative to fixing pops upstream at npz-concat time — prefer upstream re-anchoring when you control the generator, layered physics when you only have the clips.",
    appliesTo: ['ue-python'],
    source:
      'research: State of Rigging & Animation Tools in UE 5.8 (Unreal Fest Chicago 2026)',
  },
  {
    id: 'prop-placement-affordances-not-bounds',
    modules: ['world'],
    summary:
      'Procedural set dressing driven by bounding boxes alone places tables on paint cans — give each prop declared placement affordances (place_floor/surface/any, stack_true/false, copy_N, max_stack_N), fill largest-first, then settle',
    detail:
      "A prop-placement pass that knows only each mesh's bounding box has no idea what an object IS, so it puts large props on thin surfaces and stacks heavy furniture on small clutter — the composition reads mechanically assembled even when nothing intersects. Encode the rules ONCE per asset as UE actor tags and let the generator read them: place_floor (ground only — furniture, big crates), place_surface (only on top of something else — cans, bottles, documents), place_any (either); stack_true / stack_false (may anything rest on this — false for cans, cables, handled canisters, and anything whose top is not flat); copy_N (instances to spawn — clusters read better than singles); max_stack_N (run height, default around 3 — raise it for pallets/crate towers). Author the tags large → medium → small, asking what could realistically sit on what. Then three solver rules do the rest: (1) place LARGEST FIRST so big pieces establish the surfaces smaller props land on; (2) a support's footprint must be >= the prop's footprint, which is what actually prevents the thin-surface failure; (3) apply small random yaw jitter, because perfectly axis-aligned props are the strongest tell of automated placement. Untagged props should default to 'placeable anywhere, load-bearing for nothing' — the safe reading. Finally, prefer a PHYSICS SETTLE over more solver rules for piles, clutter, and filling containers: enable simulate physics on the spawned actors, let them fall, then BAKE the resulting transforms back and disable physics — settling is both cheaper to implement and more believable than analytic rules, and it removes the need for most tags when the arrangement is a pile rather than a deliberate arrangement. PoF ships the solver as src/lib/visual-gen/generators/composition.ts (tags in placement-tags.ts, round-trippable to real actor tags); the settle-and-bake half is UE-side.",
    appliesTo: ['ue-python'],
    source: 'research: Composition Maker for Unreal Engine 5 (Andrew Averkin)',
  },
  {
    id: 'headless-physics-needs-ticking-world',
    modules: ['world'],
    summary:
      'A physics settle cannot run in -run=pythonscript: set_simulate_physics(True) reports is_simulating_physics() False (no physics scene) and LevelEditorSubsystem.editor_play_simulate() FATALLY crashes the commandlet — settle in a -game session, bake transforms from python',
    detail:
      "Live-probed on UE 5.8.0. The whole API surface resolves in the pythonscript commandlet — PrimitiveComponent.set_simulate_physics / is_simulating_physics / put_rigid_body_to_sleep / set_enable_gravity, LevelEditorSubsystem.editor_play_simulate / editor_request_end_play / is_in_play_in_editor, EditorActorSubsystem.spawn_actor_from_class, SystemLibrary.begin_transaction / end_transaction, PhysicsAsset / BodyInstance / ChaosSolverActor — so introspection alone suggests a headless 'simulate then bake' pass is scriptable. It is NOT. Two hard walls: (1) the commandlet's world is a transient /Temp/Untitled_0 with NO physics scene, so set_simulate_physics(True) silently leaves is_simulating_physics() == False and a spawned actor never falls; (2) calling LevelEditorSubsystem.editor_play_simulate() is a FATAL crash (callstack through UnrealEditor-PythonScriptPlugin.dll, process exit code 3), not an exception you can catch — there is no editor loop to enter. There is also no scriptable time-advance: SystemLibrary only offers delay_until_next_tick / set_timer_for_next_tick, which need a tick that never comes. Split the work accordingly: the BAKE half (read/write actor transforms, actor tags, transactions, saving the map) is fully headless; the SETTLE half needs a world that actually ticks — run it in a -game session (the scenario-controller path) or the interactive editor, and have python only stamp the resulting transforms back. Same shape as the headless-render finding: the commandlet is an asset-authoring tool, not a simulation host.",
    appliesTo: ['ue-python'],
    source:
      'research: Composition Maker (Andrew Averkin) + live 5.8 headless physics-settle probe',
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
