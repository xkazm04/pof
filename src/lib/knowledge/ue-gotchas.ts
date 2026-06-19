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
  source: string;
}

export const UE_GOTCHAS: Gotcha[] = [
  {
    id: 'material-const3vector-pin',
    summary: 'Constant3Vector output pin is "" not "RGB"',
    detail:
      'A MaterialExpressionConstant3Vector exposes its output on pin "" — connect_material_property(node, "RGB", ...) silently returns false and yields a black material. Use the empty-string pin name.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: materials',
  },
  {
    id: 'umg-rebuildwidget-timing',
    summary: 'a code-only UUserWidget builds its Slate tree in RebuildWidget(), not NativeConstruct()',
    detail:
      'A C++-only UUserWidget with no UMG asset must construct its widget hierarchy by overriding RebuildWidget(); NativeConstruct() runs too late and the tree is empty. BindWidget members still require a WBP.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: HUD',
  },
  {
    id: 'umg-debug-text-overlay',
    summary: 'AddOnScreenDebugMessage debug text draws over UMG and pins to the top-left',
    detail:
      'GEngine->AddOnScreenDebugMessage prints above all UMG and pins to the top-left corner, colliding with anything placed there and confounding screenshot/vision HUD checks. Either offset HUD elements down (the slice put the player health bar at y=90) or disable it in dev with the DisableAllScreenMessages console command.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: HUD',
  },
  {
    id: 'cmd-quote-wrap',
    summary: 'cmd.exe /c with an embedded quoted command needs windowsVerbatimArguments + an outer-quote wrap',
    detail:
      'Spawning cmd.exe /c "<command with its own quotes>" on Windows requires windowsVerbatimArguments: true AND wrapping the whole command in an extra pair of outer quotes, or the inner quotes are stripped.',
    appliesTo: ['packaging'],
    source: 'vertical-slice: packaging',
  },
  {
    id: 'interchange-fbx-commandlet-crash',
    summary: 'UE 5.7 FBX import via Interchange crashes under -run=pythonscript',
    detail:
      'The Interchange FBX path crashes in the pythonscript commandlet. Import FBX with the full editor via UnrealEditor.exe -ExecutePythonScript= instead of -run=pythonscript.',
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
    summary: 'metre-authored FBX: Blender apply_unit_scale=True + UE import_uniform_scale=1.0',
    detail:
      'For meshes authored in metres, export from Blender with apply_unit_scale=True and import into UE with import_uniform_scale = 1.0 (not 100), or the mesh is 100x off.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: characters',
  },
  {
    id: 'lumen-swrt-thin-geometry',
    summary: 'Lumen software tracing misses thin geometry — raise the mesh Distance Field Resolution Scale',
    detail:
      'With Lumen Software Ray Tracing, thin meshes (walls, ceilings, railings) drop out of the mesh distance field and leak light / lose GI. Fix per-mesh in the Static Mesh Editor build settings: raise Distance Field Resolution Scale (e.g. ~10-20) — costs memory/disk but resolves thin geo — or thicken the mesh. Visualize with Show Flags → Visualize → Mesh Distance Fields.',
    appliesTo: ['ue-python'],
    source: 'research: Lumen in AAA (Karim Yasser)',
  },
  {
    id: 'lumen-swrt-mode-by-scale',
    summary: 'Pick Lumen SWRT mode by world scale: Detail Tracing (per-mesh) vs Global Tracing (large worlds)',
    detail:
      'Lumen Software Ray Tracing has two modes. Detail Tracing uses per-mesh distance fields — accurate, best for focused/interior or small-distance detail. Global Tracing uses the low-res global distance field — cheaper + faster, loses small-distance detail, best for large open-world environments. Choose by project scale, not by default.',
    appliesTo: ['ue-python'],
    source: 'research: Lumen in AAA (Karim Yasser)',
  },
  {
    id: 'lumen-hwrt-reflection-cache',
    summary: 'Lumen HWRT surface-cache gives black/inaccurate reflections on smooth surfaces — use Hit Lighting for Reflections',
    detail:
      'With Hardware Ray Tracing, the default Surface Cache produces black or wrong reflections on smooth/specular surfaces (water, polished floors). Set the post-process Lumen reflection method to "Hit Lighting for Reflections" for accurate reflections at moderate cost. Avoid full "Hit Lighting" in shipping games — it casts far more indirect rays and is too expensive to be reliable.',
    appliesTo: ['ue-python'],
    source: 'research: Lumen in AAA (Karim Yasser)',
  },
  {
    id: 'modular-character-accessory-rigging',
    summary: 'Modular character: weight rigid accessories to ONE bone, hide occluded body mesh, keep swap-slots exclusive',
    detail:
      'For customizable/modular characters: (1) rigid accessories (hats, glasses, held props) must be weighted 100% to a single bone (head; or a hand socket via parenting) — NOT auto-skinned to the body, or they deform with it. (2) Hide/remove body mesh occluded by equipped clothing (do not render the torso under a shirt) to save draw cost. (3) Make swappable slots mutually exclusive (legs vs pants in one category) so they do not co-occupy and clip. (4) Generate the body WITH a placeholder head for proportion, then swap in a higher-detail head (bridge the neck loops). Show holdables only in the matching animation state.',
    appliesTo: ['ue-python'],
    source: 'research: Modular 3D Character (Stefan 3D AI)',
  },
  {
    id: 'niagara-effect-types-significance',
    summary: 'Cap active Niagara systems with Effect Types (significance + max-instance + visibility cull) — hidden systems still TICK',
    detail:
      'A disabled renderer or off-screen Niagara system still TICKS (and GPU sims still cost the render thread via compute dispatch) — hiding it does not save the cost. Use Effect Types (like texture groups, assigned per system): a significance manager (distance/age) + hard max-instance caps + visibility culling (pre-spawn check + a short re-show delay) cull the TICK. This roughly halves active systems with identical visuals (Lyra). Caveat: at very high system counts the significance-manager refresh itself can spike — keep counts sane.',
    appliesTo: ['ue-cpp', 'ue-python'],
    source: 'research: Optimizing Niagara, Unreal Fest 2025 (A. Kurali)',
  },
  {
    id: 'niagara-insights-stat-named-events',
    summary: 'Profiling Niagara in Unreal Insights needs `stat named events` — else Niagara is invisible in the capture',
    detail:
      'Niagara work will NOT appear in an Unreal Insights trace unless `stat named events` is enabled before capturing. For quick triage use stat NiagaraSystems / stat NiagaraEmitters (per-system/emitter cost, with the owning system/actor) and the in-editor Niagara Debugger (effects outliner shows systems ticking while invisible + GPU compute cost).',
    appliesTo: ['ue-cpp', 'ue-python'],
    source: 'research: Optimizing Niagara, Unreal Fest 2025 (A. Kurali)',
  },
  {
    id: 'gas-meta-attribute-damage',
    summary: 'GAS: model damage as a server-only META attribute, apply via GameplayEffect, clamp in PostGameplayEffectExecute — never SetHealth directly',
    detail:
      'Route ALL attribute changes through GameplayEffects (so prediction/stacking/calc work) — never call the attribute setter directly. Model damage as a meta attribute (server-only, not replicated): a GE adds to Damage; in PostGameplayEffectExecute, read Damage, reset it to 0, subtract from Health, and clamp Health to [0, MaxHealth] (clamp in PreAttributeChange too). Health/MaxHealth ARE replicated.',
    appliesTo: ['ue-cpp'],
    source: 'research: GAS in 20 minutes (Danny Goodayle)',
  },
  {
    id: 'gas-repnotify-and-cosmetic-cues',
    summary: 'GAS: replicated attributes need GAMEPLAYATTRIBUTE_REPNOTIFY in OnRep; Gameplay Cues are COSMETIC ONLY',
    detail:
      'Each replicated attribute needs an OnRep_ that calls GAMEPLAYATTRIBUTE_REPNOTIFY(USet, Attribute) — without it the ASC never sees replicated value changes. Use the ATTRIBUTE_ACCESSORS macro set for the getter/setter/init. Gameplay Cues are for COSMETIC feedback only (VFX/SFX/shader), keyed by gameplay tag — never put gameplay logic in a cue.',
    appliesTo: ['ue-cpp'],
    source: 'research: GAS in 20 minutes (Danny Goodayle)',
  },
  {
    id: 'motion-matching-pitfalls',
    summary: 'Motion Matching: anims need root motion even w/o capsule root motion; the Phase channel CRASHES the editor; tune cost bias carefully',
    detail:
      'Source anims in a Pose Search database need root motion ENABLED even when the capsule is driven by velocity (not root motion) — the pose search scores foot velocity/position from it. Do NOT enable the Phase channel in the pose-search schema — it crashes the editor and keeps crashing on reopen. Collected bones (pose history) must match the bones in the pose channel. Do not lower Continuing Pose Cost Bias too far (the character becomes unresponsive / sticks in one animation); if a Chooser will not leave a loop DB for a stop DB, lower the stop DB base cost bias. Reduce foot sliding with a SMALL play-rate window (~0.75-1.25, not 0.5-1.5) or Dead Blending; be cautious with mirroring (foot sliding / tilt). Use Exclude-From-Database (not a manual cut) to drop T-posed lead frames.',
    appliesTo: ['ue-cpp', 'ue-python'],
    source: 'research: Motion Matching Problems & Solutions (Unreal DevOP)',
  },
];

/**
 * Render the gotchas whose `appliesTo` includes `kind` as a markdown
 * `## Known UE Pitfalls` block. Returns '' for `web` or when none match.
 */
export function formatGotchas(kind: PromptKind): string {
  if (kind === 'web') return '';
  const relevant = UE_GOTCHAS.filter((g) => g.appliesTo.includes(kind));
  if (relevant.length === 0) return '';
  const lines = relevant.map((g) => `- **${g.summary}** — ${g.detail} (${g.source})`);
  return `## Known UE Pitfalls\n${lines.join('\n')}`;
}
