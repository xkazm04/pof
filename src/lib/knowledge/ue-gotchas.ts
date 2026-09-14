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
    id: 'plugin-content-not-in-registry-headless',
    modules: ['character', 'animation'],
    summary: 'engine-PLUGIN content (/MoverTests, /MoverExamples) is missing from the asset registry under -run=pythonscript until the paths are scanned — does_asset_exist lies',
    detail:
      'In a `-run=pythonscript -nullrhi` commandlet, `EditorAssetLibrary.does_asset_exist("/MoverTests/Characters/Mannequins/Meshes/SKM_Manny")` returns False even though the .uasset is plainly on disk under Engine/Plugins/Experimental/MoverTests/Content/ AND the plugin is enabled in the .uproject. The asset registry simply has not scanned engine-plugin mount points yet, so an existence check over plugin content reports absence rather than "not indexed" — a retarget script then fails with a misleading "no Manny mesh found" while the mesh is right there. Fix (proven 2026-08-20): call `unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous(["/MoverTests", "/MoverExamples"], True)` first, then `load_asset(path)` DIRECTLY and test the returned object — never gate plugin content on does_asset_exist. Project content under /Game is unaffected; this only bites paths that live in a plugin mount.',
    appliesTo: ['ue-python'],
    source: 'ardy verify-retarget: fresh clips onto Manny',
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
    id: 'known-geometry-beats-generated-landmarks',
    modules: ['character', '3d'],
    summary: 'Insert the mouth interior (teeth/tongue) as AUTHORED geometry instead of generating it — a generated one is inconsistent and leaves the auto-rigger nothing to measure against',
    detail:
      "Image-to-3D generators produce a mouth interior whose topology AND placement vary from one character to the next, so every downstream script that needs to find the mouth has to re-infer it from the surface, per character, and fails silently when it infers wrong. Authoring teeth and a tongue ONCE and inserting them at a known local transform inverts the problem: they become predictable geometry that gives the auto-rigger a fixed landmark for the mouth line, the jaw pivot and the lip corners, and gives a deform check a known object to test lip/teeth intersection against. The general rule this instances is the load-bearing one for any automated asset pipeline: REMOVE THE THINGS THE PIPELINE MUST GUESS. A generated detail that a later step must locate is a per-asset inference with a silent failure mode; the same detail supplied as a known asset is a constant, and constants are what make an automated chain reliable rather than merely lucky. Apply it wherever a script must find a feature on generated geometry — eye sockets, weapon grips, attachment sockets, the ground plane. It composes with `ai-mesh-segment-before-rig`: segment what the generator made, and INSERT what it makes unreliably.",
    appliesTo: ['ue-python'],
    source: 'research: Can GPT-6 Astra Make AI Characters Game Ready? (Building Aeon)',
  },
  {
    id: 'separated-shell-exposes-baked-artifacts',
    // NOT tagged 'materials', though it is a texture defect: 'materials' also routes to the
    // world modules, and the golden rail caught this landing in the biome-scatter and
    // procgen-dungeon prompts, where a rule about hair shells is noise.
    modules: ['character', '3d'],
    summary: 'Splitting hair/brows off a fused AI mesh EXPOSES skin texture that was baked as occluded — inpaint the revealed region or it ships as visible dirt',
    detail:
      "An image-to-3D generator textures the body surface as it appeared at generation time, which means the skin UNDER hair, eyebrows, a collar or a strap is never a clean surface: it carries baked shadow, colour bleed from the covering piece, and outright garbage, because nothing was ever going to look at it. Separating those pieces into their own objects is the right move (it is what makes a character riggable and its parts swappable — see `ai-mesh-segment-before-rig`), and on a well-organised mesh it is nearly free: the shells come out as connected components, so a single linked-geometry selection lifts the whole hairstyle without taking the scalp with it. But separation is exactly what makes the dirty region VISIBLE. This is the inverse of the usual occlusion worry — the concern is not hidden geometry wasting budget, it is hidden TEXTURE becoming visible — and it is invisible to every mesh statistic: poly counts, watertightness and UV checks all pass on a scalp covered in baked shadow. It surfaces only in a render from an angle that sees the newly exposed skin, and in production the moment the hair is swapped, removed, or animated away from the head. After separating a shell, either inpaint the exposed region (clone/heal from adjacent clean skin) or re-run texturing with the shells hidden, and verify with a render of the base mesh alone, not of the assembled character.",
    appliesTo: ['ue-python'],
    source: 'research: Can GPT-6 Astra Make AI Characters Game Ready? (Building Aeon)',
  },
  {
    id: 'retarget-refpose-inherits-open-jaw',
    modules: ['character', 'animation'],
    summary: 'A head whose jaw bone RESTS open bakes an open mouth into the retarget reference pose — the character then idles slack-jawed in clips that never touch the jaw',
    detail:
      "When a facial rig is built on a mesh whose jaw bone's rest position is not the closed neutral, humanoid retargeting takes that rest pose to BE the character's neutral and applies every clip as a delta from it — so the character stands around with its mouth hanging open, in animations that contain no jaw animation at all. What makes this expensive is that it is invisible at all three places you would look: the source asset is fine in bind pose, the source clip is correct relative to its own neutral, and the import succeeds. It appears only in the retargeted RESULT, and reads as a character-art problem rather than a rig-configuration one. Fix at the source — close the jaw (and the eyelids, which fail the same way) in the rest/bind pose before export. When the rig must be authored open, re-anchor the reference instead: import with `use_t0_as_ref_pose` so frame 0 of a chosen animation becomes the reference pose rather than the authored bind. Verify by rendering the retargeted IDLE and looking at the mouth — never by inspecting the source asset, which is where this defect is not. Observed in Unity humanoid retargeting; the mechanism is the retarget reference pose rather than any one engine, and UE's IK Retargeter reads the same thing.",
    appliesTo: ['ue-python'],
    source: 'research: Can GPT-6 Astra Make AI Characters Game Ready? (Building Aeon)',
  },
  {
    id: 'ai-3d-model-tier-and-budget-shaping',
    modules: ['character', '3d'],
    summary: 'Pick an image-to-3D model by TIER, not by date — and treat the face budget as a SHAPING parameter, not a ceiling; text never survives as geometry at any budget',
    detail:
      "Three separate traps when driving an image/text-to-3D generator (Tripo and its peers). (1) MODEL TIER, NOT DATE: the vendor ships parallel families, not a single improving line. Tripo's P-series ('Smart Mesh': P1, P2) is a low-poly TOPOLOGY tier — quad output, a caller-controlled poly budget, seconds per mesh, and topology ONLY (texturing is a second pass) — while the v3.x line is the high-detail hero tier. PoF's own arena graded 'P1-20260311' a FAIL as a hero model DESPITE carrying the newest date (3MB, shard hair) and 'v3.1-20260211' a PASS (45MB, woven braids), so choosing the newest id is how you get a low-poly tier answering a hero-tier request. Pin the model explicitly per asset class; the same arena graded the silent account default a FAIL too. (2) BUDGET SHAPES, IT DOES NOT ONLY CAP: a generator spends the budget it is given, so an over-generous budget makes output WORSE, not merely heavier. Observed on hair: 1,500 quads produced a mess, 3,000 produced individually-resolved strands, and 6,000 made the generator invent a whole head that should not have existed — the budget had nowhere legitimate to go. A budget is therefore a per-asset authoring decision, not a class ceiling to max out; a simple asset given a big budget is a defect risk, and the good generators SKIP spending it on flat surfaces rather than adding loops. (3) TEXT IS NEVER GEOMETRY: lettering on a sign, a coin or an engraved blade is ignored or scrambled at every budget (verified up to 10,000 quads). Author text as a TEXTURE/decal in the material, never as a modelled feature, and do not spend budget trying to force it.",
    appliesTo: ['ue-python'],
    source: 'research: Tripo P2 quad-topology walkthrough (Stefan 3D AI) + PoF character-pipeline model arena',
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
  {
    id: 'warning-vs-error-policy',
    summary:
      'Pick failure severity by consequence: cosmetic load failures warn-and-continue; gameplay-invariant violations hard-fail — and never fabricate the missing object to keep running',
    detail:
      "When generated code handles a failed load or lookup, choose severity by what the failure breaks, not by habit. A COSMETIC asset that fails (a mesh, VFX, audio cue) should log a warning and continue — stopping everyone because pretty_tree_03 didn't load is wrong. A GAMEPLAY-INVARIANT violation must hard-fail fast (check(), UE_LOG Fatal, or ensure + early-return): the classic case is a locked door/gate actor failing to spawn — the dungeon behind it assumes quest state that 'cannot' be missing, so warn-and-continue surfaces days later as an inexplicable bug in unrelated code, downstream of the real cause. And never 'fix' a failure by fabricating the missing state (constructing an empty list/table/object so execution can proceed) — that converts a loud caller bug into silent corruption.",
    appliesTo: ['ue-cpp'],
    source: 'research: T. Cain code standards (WildStar/Outer Worlds notes)',
  },
  {
    id: 'ai-mesh-unit-normalized',
    modules: ['3d', 'character', 'world'],
    summary:
      'AI-generated meshes arrive normalised to a ~1 m box (hero AND sword hilt alike) — set a per-asset ImportUniformScale from the intended real-world size, or the hero imports at 100 cm',
    detail:
      "Every image/text-to-3D generator (Tripo, TripoSR, Hunyuan…) normalises its output so the longest bounding-box extent is ~1.0 in glTF metres, whatever the asset is: measured over PoF's own generated/ library a hero character is 1.00 m tall, a crate 1.00 m, a sword HILT 1.02 m long. The unit is right (metres → the importer's own m→cm conversion applies), so the `fbx-import-scale` rule (import_uniform_scale = 1.0, not 100) still holds — but the SIZE is not, and a scale of 1.0 ships the hero at 100 cm next to the 180 cm UE5 Mannequin and the hilt at a metre. Do the pro workflow's manual step (export the UE reference skeleton into Blender as a size reference) automatically: know the intended longest extent per asset (character = 1.8 m Mannequin; weapons/props from the design spec — never a class-wide guess), measure the delivered bbox, and import with ImportUniformScale = target / measured (or rescale + apply transforms in Blender before export). PoF's Tier-1 mesh gate grades this (`scale` on the scorecard, `world-scale.ts`) and reports the exact factor; a static-mesh import that skips it silently mis-scales every generated asset.",
    appliesTo: ['ue-python'],
    source: 'research: Souls-like in 3 days (Stefan 3D AI) — UE reference-skeleton size check + measured generated/ library 2026-08-17',
  },
  {
    id: 'arena-kit-composition',
    modules: ['world'],
    summary:
      'Compose an arena/level from primitives + tiling PBR + procedurally-placed kit pieces; generate only the unique hero props — never the whole space as one AI mesh',
    detail:
      "Generating a whole arena, courtyard or room as ONE image-to-3D mesh fails twice: it is uncontrollable (no gap for a gate, no second ring of walls without a re-roll) and its texel density collapses — even an 8K bake goes blurry once the player walks up to a wall. Build the space the way the pro workflow does: (1) big surfaces (floor, ring, road, cliffs) are primitives or simple hand-built shapes with SEAMLESS tiling PBR materials, UV-tiled so density stays constant at any size (a circular arena floor UV-loops the tile around the ring); a flat one-off feature (a carved floor emblem) is a single generated image PROJECTED onto a primitive with a derived normal/AO, not a mesh; (2) repeated architecture (wall segments, pillars, rock rings, ruined outer ring) is a small generated modular KIT placed procedurally — Blender array+curve, a UE spline mesh, PCG, or a scripted radial placement — so a ring of 20 walls is one kit piece × a placement rule with a controllable gap; (3) only UNIQUE hero pieces (the boss throne, a statue, the gate) are individually generated, high-poly → retopo → bake per `ai-lowpoly-generation-not-final`; (4) scatter the small debris (dropped stones, rubble) with the engine's foliage/PCG tools, not as baked-in mesh detail. Weather + lighting (fog, sky, volumetrics) then carry half the read — spend budget there, not on more unique meshes.",
    appliesTo: ['ue-python'],
    source: 'research: Souls-like in 3 days (Stefan 3D AI) — arena built from primitives + tiles + array/curve wall kits',
  },
  {
    id: 'kit-from-one-concept-split',
    modules: ['world', '3d'],
    summary:
      'Cut an asset kit OUT of one concept image (crop the regions you need, extract each as its own clean plate) — never prompt each prop independently',
    detail:
      "`arena-kit-composition` says build the space from a modular KIT; this is how the kit is made to match. Prompting each prop on its own — one call for the crate, one for the barrel, one for the rope coil — produces props that are individually fine and collectively wrong: different palettes, different light directions, different wear levels and different stylisation, because nothing constrains them to each other. Style DNA (`style-dna.ts`) narrows the drift but cannot remove it; the prompts are still independent samples. The pro workflow inverts the order: generate ONE concept image of the whole scene first, then go back into it and extract the kit from that single image — circle or crop each region ('I need this stone, this pier section, this barrel') and have the image model re-emit it as an isolated plate on a plain background. Every member is then a crop of one lighting setup and one palette, so the kit is coherent BY CONSTRUCTION rather than by luck, and each plate is already the clean single-subject input image-to-3D wants. Practical rules: (1) group small repeated objects (planks, stones, coins) into ONE plate and mesh them together — it saves calls and they are placed as a cluster anyway; (2) choose the crop granularity by how much placement control you want, since a region extracted as one piece can only be placed as one piece; (3) do not try to predict the full list up front — circle back to the same concept image for anything missing, which stays coherent because the source image has not changed; (4) generate the tiling material plates (fishnet, rope, rock) from that same concept too, so surfaces match the props standing on them.",
    appliesTo: ['ue-python'],
    source: 'research: AI environment asset-kit workflow (Stefan 3D AI, youtube wknRD5g-vvk) — concept image split into circled building blocks',
  },
  {
    id: 'hard-surface-garment-subassembly-gen',
    modules: ['3d', 'character'],
    summary:
      'Complex HARD-SURFACE objects and realistic GARMENTS fail single-shot image-to-3D — generate them as named sub-assemblies and combine, the same rule characters already follow',
    detail:
      "The part-by-part rule (`ai-lowpoly-generation-not-final`, `ai-mesh-segment-before-rig`) is usually stated for characters and for environments (`arena-kit-composition`), which leaves the two classes that break the current generation frontier hardest completely uncovered. (1) HARD SURFACE — a rifle, a mechanism, a full armour set, a vehicle: single-shot generation resolves the silhouette but wrecks the wireframe exactly where hard-surface reads, on the panel breaks, bolts, barrels and hinges, and no face budget fixes it because the generator spends the budget on the blob rather than the break. Generate each rigid sub-assembly separately (barrel / receiver / stock / magazine; pauldron / cuirass / greave), each with its own reference view, then combine — every part keeps its own sharp local detail and its own clean topology, and the parts are separately swappable and separately budgetable afterwards. (2) REALISTIC GARMENTS are the same failure with a softer surface: a layered coat, a belted robe or a cape generated as one mesh produces fused, non-manifold folds that neither retopologise nor skin, and a single-shot character wearing them fuses the garment INTO the body. Generate the garment as its OWN mesh, separate from the body it covers (which also gives the Chaos-Cloth and weight-transfer paths something to bind to; see `metahuman-body-weight-transfer-garments`). Stylised/simple props are the exception and remain fine single-shot — the rule is triggered by INTERNAL STRUCTURE (distinct rigid parts or layered cloth), not by size or by how detailed the concept art looks.",
    appliesTo: ['ue-python'],
    source: 'research: 3D AI News #18 (Stefan 3D AI) — top-tier model still fails realistic garments/hard-surface wireframes; "splitting into the parts you\'re gonna get far"',
  },
  {
    id: 'creature-rig-not-biped',
    modules: ['3d', 'character'],
    summary:
      'A humanoid auto-rigger RETURNS A RIG for a non-humanoid creature instead of failing — check the anatomy BEFORE rigging, and rig a hybrid in two halves',
    detail:
      "Every auto-rig path PoF drives assumes a biped and none of them refuse a creature. `scripts/visual-gen/pof_tripo_animate.mjs` sends `rig_type: 'biped'` as its default (its own docstring lists `check_riggable` in parentheses — the prerigcheck step was never implemented), `RIG_PRESETS` in `rig-presets.ts` is three entries and all three are humanoid (ue5-mannequin / metahuman / minimal-humanoid), and Mixamo's uploader is humanoid-only by construction. The failure mode is the dangerous one: a biped rigger handed a spider, a quadruped or a winged creature does not error — it fits a human skeleton to whatever silhouette it was given and returns a rig, so the task succeeds, a skeletal mesh imports, and the defect only appears as limbs that follow the wrong bones once a clip plays. Three rules. (1) GATE ON ANATOMY FIRST: call the provider's prerigcheck (Tripo `animate_prerigcheck` → `riggable` + `rig_type`) and refuse when the returned type is not the type you asked for, rather than reading a returned rig as success. (2) A HYBRID CREATURE RIGS IN TWO HALVES: cut the mesh at a clean seam, close the hole so neither half is hollow, rig the humanoid half with the humanoid path and the non-humanoid half against an animal/insect template, then join the skeletons in Blender — the join itself is cheap, and the real cost is re-weighting the transition band across the seam, which is manual and must be budgeted rather than assumed away. (3) A HUMANOID SKELETON CAN STILL BE THE ANSWER WITHOUT THE AUTO-RIGGER: exporting a Mixamo skeleton in T-pose, positioning its bones onto the creature by hand and using Blender's parent-with-automatic-weights succeeds on shapes the same vendor's automatic uploader rejects outright, and costs nothing. Rigid accessories (hair, ornaments, shells) are weighted to a single parent bone rather than skinned — see `ai-mesh-segment-before-rig` for the segmentation that makes that possible.",
    appliesTo: ['ue-python'],
    source: 'research: creature/monster 3D AI workflow (Stefan 3D AI, youtube URjhE8QEhJU) — Mixamo failed the spider hybrid; verified against pof_tripo_animate.mjs:75 + rig-presets.ts',
  },
  {
    id: 'construct-hard-surface-dont-generate',
    modules: ['3d', 'world'],
    summary:
      'A hard-surface or architectural asset whose form IS primitives should be CONSTRUCTED by script, not generated — an agent that can drive Blender has a third option the part-split rule never names',
    detail:
      "`arena-kit-composition` and `hard-surface-and-garment-part-split` both end in 'ask a generator' — for a whole space, or for one sub-assembly at a time — and `polycount-presets.ts` encodes only WHERE the face budget is spent (`budgeted` vs `max-then-finish`), never whether to spend a generation at all. Before dispatching one, ask whether the form decomposes into primitives: boxes, cylinders, arcs, extrusions, revolves and arrayed repeats. Crates, doors, shrines, walls, stairs, pillars, furniture, signage, mechanisms, vehicles and most modular kit pieces do; that is exactly the class whose wireframe a generator wrecks, and it is unfixable by budget because the generator spends the budget on the blob rather than on the panel break. Constructing it instead buys five things a generation cannot: (1) topology that lands ON the hard edges, because the edges are where the primitives meet; (2) polygon economy an order of magnitude below a generated equivalent — one demonstration built an entire shrine location, animated flames included, in the tens of thousands of faces, less than a single generated hero prop; (3) determinism — the script is re-runnable, diffable and parameterizable, so the asset becomes a FUNCTION with presets rather than N provider rolls, and a variant costs nothing; (4) no retopo/bake/UV stage and no credits at all; (5) LEGIBLE lettering and numerals — a generator smears text into gibberish on signage, dials, panels and book spines, while constructed geometry (or real text projected onto a primitive) reads correctly, which also makes a glance at the lettering the cheapest way to tell which path produced a surface. The boundary is sharp and must not be crossed: ORGANIC form — characters, creatures, faces, foliage, cloth, terrain detail — does not survive primitive construction. An agent asked for one anyway returns a blocky proxy that reads as a placeholder, so those stay on the generate → retopo → bake path. Build in the same order a blockout does: coarse proxy at correct world scale first, then refine per part, rendering between passes so each refinement is judged rather than assumed. PoF's existing construct path is `src/lib/blender-mcp/scripts/level-blockout.ts` plus `src/lib/visual-gen/generators/*`; nothing currently routes an asset class to it. MEASURED BOUNDARY (2026-09-14, a structural render proof over Blender-scripting agents): construction ALONE does not deliver (1) or (2). Four independent agents each scripted the same two briefs - a ruined stairs kit piece and a two-handed warhammer - in headless Blender. The two briefed only on look and feel ('game-ready', spec-driven) produced primitives that INTERPENETRATE rather than join: 33-235 shells per asset with 58-394 intersecting shell pairs, 4-8x the triangles, and invented sizes (a 7-10 m footprint for a 4 m kit tile, a 1.74-1.83 m hammer). The two given a commissioning contract - an exact target extent on the kit grid, a TRIANGLE request under a ceiling, and 'one closed surface: boolean-union or trim wherever parts meet' - each produced ONE closed shell at the commissioned size (4.000 m; 1.596-1.600 m) in 2.3-4.2k triangles, and both measured their own output and caught a 6 mm and a 29 mm length error the unbriefed agents had no number to miss. So route hard-surface assets to construction AND hand the constructing agent the numbers: target extent, triangle budget, a closed-surface rule and a self-measurement step - without them 'topology on the hard edges' becomes boxes pushed through boxes. Scope of the evidence: structural only, n=2 agents per brief; the perceptual comparison (turntables, a proxy hold, an engine pass) did not reach a verdict.",
    appliesTo: ['ue-python'],
    source:
      'research: GPT-6 Astra Blender test (Stefan 3D AI, youtube 8MUk-tQTiwE) — a shrine location and a car built from primitives in one prompt, legible signage, while "building characters from primitives is not really working well"',
  },
  {
    id: 'gltf-roundtrip-nonmanifold-blocks-remesh',
    modules: ['3d', 'character', 'world'],
    summary:
      'Every mesh imported from .glb arrives NON-MANIFOLD (glTF splits vertices at UV/normal seams) — weld and re-normal before any remesher, and never trust a remesh operator that returns FINISHED',
    detail:
      "Measured live on Blender 4.2.1 (2026-08-23). glTF 2.0 stores attributes per-vertex, so the exporter SPLITS every vertex lying on a UV or normal seam. A watertight, manifold mesh therefore comes back non-manifold purely from the round trip: a clean displaced ico-sphere exported to .glb and re-imported showed 61,434 non-manifold edges — an artefact of the format, not a defect in the model. Two consequences. (1) PREPARE BEFORE ANY REMESH: clear custom split normals, weld by distance (~1e-5), and make normals consistent. That took the sphere to 0 non-manifold edges and Blender's QuadriFlow then produced an all-quad mesh; without it QuadriFlow did nothing at all. Clearing custom normals is safe HERE specifically because a remesher replaces the topology, so normals authored against doomed vertices carry nothing forward — this is the opposite of the re-shading case, where clearing them destroys better information (`shadingSkippedReason`). (2) NEVER TRUST THE RETURN VALUE: `bpy.ops.object.quadriflow_remesh` logs a warning, changes nothing, and STILL returns {'FINISHED'} on non-manifold input. Judged by its return code it 'succeeded' while delivering a 43 MB unreduced mesh labelled as retopologised. Judge a remesh by the ARTIFACT — face count changed and quad count > 0 — never by the operator's status. Residual non-manifold edges AFTER the repair are a real defect in the model rather than a format artefact (real Tripo character output kept 198, and correctly could not be quad-remeshed); that is the same condition the Tier-1 gate reports as `not-watertight`, so a mesh failing that gate cannot be quad-retopologised until it is repaired.",
    appliesTo: ['ue-python'],
    source: 'research: 3D AI News #18 (Stefan 3D AI) — live Blender 4.2.1 A/B while wiring mesh-finish --retopo quadriflow',
  },
  {
    id: 'replication-authority-completeness',
    summary:
      'a client-visible change needs BOTH a replicated source property (DOREPLIFETIME) and an OnRep — an OnRep alone updates nothing, and controller-local state needs an IsLocalController guard',
    detail:
      "The single largest class of structurally-plausible-but-wrong generated UE C++. Two halves, and generated code reliably writes one without the other. (1) SOURCE STATE: adding UFUNCTION() OnRep_X and marking a property ReplicatedUsing=OnRep_X does nothing unless the property is ALSO registered in GetLifetimeReplicatedProps with DOREPLIFETIME(AClass, X) and the actor/component actually replicates (bReplicates, plus SetIsReplicated(true) on a component). It compiles, the server mutates the value, the HUD never moves, and nothing errors — so a build-only gate passes it. Mutate replicated state on the SERVER only (HasAuthority()); a client-side write is overwritten on the next update. (2) LOCALITY: state belonging to ONE player — an open menu, a browsing index, local playback, an input-mode change, a camera shake — must be guarded by IsLocalController() (controller) / IsLocallyControlled() (pawn), or it runs on the wrong controller instance. RPC direction is the same check: a Server RPC needs WithValidation and runs on the server, a Client RPC targets one owning connection, a Multicast reaches everyone — a cosmetic cue is Multicast, never a replicated gameplay property. VERIFY BY RUNNING: a listen-server PIE session with 2 clients is what exposes this, which is why a build-green replication change is unproven.",
    appliesTo: ['ue-cpp'],
    source: 'research: GameEngineBench (arXiv 2607.03525) — recurring authority/replication failure class across 110 runtime-verified UE5 tasks',
  },
  {
    id: 'actor-lifecycle-init-and-teardown',
    summary:
      'the constructor runs at CDO time (no world, no other actors) — defaults there, wiring in BeginPlay, and every BeginPlay acquisition needs its EndPlay release',
    detail:
      "The second recurring structural failure class in generated UE C++, and it is an ORDERING bug rather than a syntax one. The constructor executes when the Class Default Object is built — during cook and editor load, before any world exists — so it may only set defaults, create subobjects (CreateDefaultSubobject) and attach components. Anything touching the world, other actors, the game mode, a subsystem, replicated data or an asset load belongs in BeginPlay (or PostInitializeComponents / OnRegister for component wiring); in the constructor it either crashes the cook or silently bakes a stale value into the CDO that every instance shares. Activation timing is the same trap from the other side: a component created but never activated (bAutoActivate false with no Activate()), a timer set before the subsystem it calls exists, or a delegate bound in the constructor to an actor that has not spawned — all compile, all do nothing. TEARDOWN MUST BE SYMMETRIC: every BeginPlay acquisition — AddDynamic bindings, SetTimer handles, spawned actors, registrations with a subsystem or manager — needs its release in EndPlay (and call Super::EndPlay), or a PIE session leaks it into the NEXT one and the second run of the same test behaves differently from the first. That is exactly the shared-world hazard the functional-test rule names: state surviving EndPlay is state the next test inherits.",
    appliesTo: ['ue-cpp'],
    source: 'research: GameEngineBench (arXiv 2607.03525) — constructor-default / activation-timing / teardown failure cluster',
  },
  {
    id: 'cross-system-persistence-consistency',
    summary:
      'save/load, streaming and spawning are ONE contract — a persistence change that touches only the save struct silently loses destroyed actors and streamed-in state',
    detail:
      "The hardest unsolved class in the runtime-verified benchmark: the tasks no agent configuration solved needed coordination BETWEEN runtime systems rather than any single API call, and persistence is the canonical case. A correct save/load pass keeps five things consistent at once. (1) STABLE ACTOR IDENTITY across sessions — a name or GUID that survives a reload, never a pointer, an array index or spawn order. (2) DESTROYED actors recorded EXPLICITLY, because a level reload respawns everything the map placed and an absent entry reads as 'still alive'. (3) The serialized property set matching the class as it is TODAY — add a SaveGame-tagged field and old saves must still load, so version the struct and handle the missing field rather than invalidating every existing save. (4) LEVEL STREAMING order — an actor in a sublevel that has not streamed in yet cannot be restored when the save is applied; restore on the level-loaded callback, not on BeginPlay of the persistent level. (5) The SAVE/LOAD LIFECYCLE itself — an async AsyncSaveGameToSlot completing after the actor that requested it was torn down. Write the change against all five or the feature is correct in a single fresh session and wrong on the second load, which is precisely the shape a one-shot smoke test cannot see. The same 'several systems must agree' warning applies to inventory-to-UI, ability-to-animation and streaming-to-AI changes.",
    appliesTo: ['ue-cpp'],
    source: 'research: GameEngineBench (arXiv 2607.03525) — 31/110 tasks unsolved by every configuration, clustered on cross-system coordination',
  },
  {
    id: 'generated-mesh-arrives-without-collision',
    modules: ['3d', 'character', 'world'],
    summary:
      'a generated .glb carries NO collision and glTF has no UCX_ convention — set collision AFTER import in python, or the asset is non-blocking geometry',
    detail:
      "Every AI-generated mesh PoF delivers is render geometry only, and two facts have to be held together. (1) THE UCX_ CONVENTION IS FBX-ONLY: the classic pipeline names a collision hull UCX_<MeshName>_01 as a sibling object in the FBX and the FBX importer consumes it. PoF's executing path writes GLB (mesh-finish, every generator, GlbViewer, the trimesh Tier-1 gate) and the glTF importer has no such convention — a UCX_ object exported into a .glb imports as a second VISIBLE mesh, not as collision. Do not emit UCX_ unless the delivery format is genuinely FBX. (2) SET IT POST-IMPORT INSTEAD, which is fully headless: on the imported UStaticMesh call unreal.EditorStaticMeshLibrary.add_simple_collisions(mesh, unreal.ScriptingCollisionShapeType.BOX / SPHERE / CAPSULE / NDOP10_X) for a primitive fit, or set_convex_decomposition_collisions(mesh, hull_count, max_hull_verts, hull_precision) for a concave shape — then read mesh.get_editor_property('body_setup') to verify aggregate geometry actually exists, and save the asset. Choose by USE: a prop the player collides with wants ONE primitive or a handful of hulls (start around 4–8 hulls / 16 verts and raise only if the silhouette blocks wrongly); a weapon or a wall decoration wants NO collision rather than a bad one; complex-as-simple (the render mesh as collision) is a last resort and is forbidden for anything that moves. bAutoGenerateCollision on the import UI is a coarse one-box fallback and is NOT a substitute. VERIFY BY OBSERVATION: an asset whose body_setup has zero aggregate elements passes every import check and falls through the world.",
    appliesTo: ['ue-python'],
    source: 'research: game-ready cleanup standards (strayspark 2026) + repo audit — no UCX_/collision handling outside a template view',
  },
  {
    id: 'gltf-import-returns-many-assets',
    modules: ['3d', 'character', 'world'],
    summary:
      'a glTF import yields textures and materials too, and imported_object_paths is NOT mesh-first — select the StaticMesh by isinstance, and save every asset if you suppressed task.save',
    detail:
      "Measured on a live UE 5.8 import of a generated .glb (2026-09-07). Two defects, both invisible to any test that does not actually run the editor. (1) ORDERING: AssetImportTask.imported_object_paths returned the TEXTURE first, so load_asset(paths[0]) handed a Texture2D to EditorStaticMeshLibrary.add_simple_collisions and the run died on \"TypeError: NativizeObject: Cannot nativize 'Texture2D' as 'Object' (allowed Class type: 'StaticMesh')\" — and any asset path reported from paths[0] names a texture, not the mesh. Never index into imported_object_paths: loop it, load_asset each entry, and take the first isinstance(o, unreal.StaticMesh) (mind that a multi-mesh glTF yields several — pick deliberately). Log a separate marker for 'assets imported but none was a StaticMesh', because that state has the same import marker as success and a completely different cause. (2) SAVING: any post-import edit (collision, LODs, material assignment) has to run BEFORE the asset is written, so task.save must be False — and then NOTHING is saved automatically. Saving only the mesh persists a .uasset that references textures and materials still living in memory: the first live run wrote exactly one .uasset and the whole material set vanished. After the edit, loop imported_object_paths and save_loaded_asset EVERY object, not just the one you edited.",
    appliesTo: ['ue-python'],
    source: 'research: live UE 5.8 glTF import of props__crate.glb through /api/visual-gen/ue-import',
  },
  {
    id: 'editor-python-capture-needs-frames',
    modules: ['3d', 'world'],
    summary:
      'An editor-session python capture pass needs FRAMES: take_high_res_screenshot is asynchronous, a post-tick callback is re-entered by imports, and -ExecutePythonScript exits after the script - run it as a guarded tick loop from the start-up script and verify every file',
    detail:
      "Live-probed on UE 5.8.0 in a GUI editor session (2026-09-14), importing generated FBX meshes and screenshotting them beside the stock mannequin. Every defect below resolved cleanly at the call site and failed only in its effect. (1) AutomationLibrary.take_high_res_screenshot is ASYNCHRONOUS: the call returns immediately and the file is written on a later frame, so a script that quits after calling it saves nothing (probe: called true, file absent). Drive the pass frame by frame and verify the file exists before advancing, and wait in SECONDS, not ticks - 150 editor ticks is one to two seconds, a first capture with shaders compiling takes longer, and a tick-counted wait records shots as missing while they are still being written. (2) A callback registered with unreal.register_slate_post_tick_callback is NOT exclusive: an AssetImportTask import pumps the UI loop and re-enters the callback, so a state machine that imports inside its own tick ran new_level nested inside the in-progress import and crashed the editor within 200 ms. Guard the callback with a busy flag, and reuse one level across assets rather than creating a level per asset. (3) -ExecutePythonScript runs the file and then EXITS the editor, so a callback registered for later frames gets a single tick; for a session that keeps ticking until the script itself quits, install the script as the project start-up script (Content/Python/init_unreal.py) and launch the editor normally. (4) Ground-truthed signatures in this build: Actor.set_actor_relative_rotation requires sweep and teleport positionally, and LevelEditorSubsystem.set_level_viewport_camera_info requires a viewport_config_key. NOT SOLVED: with frame-driven, file-verified capture and forced viewport redraws, an unattended run still saved 7 of 16 requested captures, and WHICH ones varied between runs - a pipeline that needs every capture from an unattended editor session needs its own retry-until-present loop and a completeness check. NOT ESTABLISHED: attach_to_component to the mannequin hand_r bone with SNAP_TO_TARGET left every weapon at the world origin in this session, but the call was not isolated from its surrounding sequence; placing the actor from get_socket_transform and verifying the distance to the socket did work.",
    appliesTo: ['ue-python'],
    source:
      'research: registry render proof over a Blender-scripting agent (youtube 3yXYIXczKXI) - live UE 5.8 GUI editor session importing generated FBX beside SKM_Manny_Simple',
  },
  {
    id: 'generated-mesh-rig-weld-and-separate-parts',
    modules: ['3d', 'character'],
    summary:
      'Rigging a generated mesh: automatic weights FAIL on the seam-split import (weld a copy, transfer weights back), and parts fused across bones TEAR - separate them at generation, because fixing after the fact moves the damage',
    detail:
      "Measured on Blender 4.2.1 (2026-09-14) by an agent rigging generated/meshes/bestiary_grunt_v2.glb (a brute with axe and shield) on the bundled basic-human metarig. Three findings, in the order a rigging pass meets them. (1) THE WEIGHT SOLVE FAILS OUTRIGHT: parent-with-automatic-weights on the imported mesh reported failed to find solution and left 27,001 of 27,001 vertices unweighted - the import is split along its seams into 571 pieces (the same glTF seam split as gltf-roundtrip-nonmanifold-blocks-remesh), and bone heat cannot solve disconnected islands. What worked: weld a COPY within 1 mm (19,645 vertices, 6 unweighted), solve automatic weights on the copy, and transfer the weights back to the untouched mesh by vertex position (max match distance 0.99 mm), which keeps the original topology and UVs. Then set rigid parts explicitly (axe 100% on hand.R, shield 100% on forearm.L) and strip arm weight that bone heat spread down the legs. (2) PARTS FUSED ACROSS BONES TEAR, AND NO WEIGHTING FIXES IT: the source mesh has the right fist welded to the thigh armour by a strip of faces, so raising the arm stretched ~500 edges past twice their length into a sheet from forearm to hip, visible at the top of every overhead action. (3) A POST-HOC SPLIT MOVED THE DAMAGE: splitting the 396 joining faces thinned the tear only (507 -> 475 stretched edges), renumbered the vertices, and left a few dozen axe-haft vertices weighted ~0.6 to thigh.R, so the axe now drags a spike to the leg instead. The durable fix is upstream: generate the character in parts with weapons and hands as separable objects (see creature-rig-not-biped and the part-split entries) rather than repairing a fused mesh. VERIFY RIGIDITY PER VERTEX, NOT BY REPORT: the rigger's written report said the attempt-3 axe was 100% on the hand, and a per-vertex probe of the saved file at a raised pose found 733 of 765 axe vertices below 95% hand weight and 718 displaced more than 5 cm from the rigid hand transform. Measure each weapon vertex's weight share and its distance from where the bone transform puts it; never accept a rigidity claim from the pass that made it.",
    appliesTo: ['ue-python'],
    source:
      'research: registry render proof over an agent creature-animation workflow (Stefan 3D AI, youtube h_mR2BRibZ8) - live Blender 4.2.1 rigging of bestiary_grunt_v2.glb, four attempts, per-vertex axe probe',
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
