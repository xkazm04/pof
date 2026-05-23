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
    id: 'fbx-import-scale',
    summary: 'metre-authored FBX: Blender apply_unit_scale=True + UE import_uniform_scale=1.0',
    detail:
      'For meshes authored in metres, export from Blender with apply_unit_scale=True and import into UE with import_uniform_scale = 1.0 (not 100), or the mesh is 100x off.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: characters',
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
