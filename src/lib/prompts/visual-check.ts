/**
 * Agentic visual-verification prompt section (folder-04 §5 / Phase 2a).
 *
 * Appended to a checklist dispatch when the item has `visualCheck: true`. It
 * instructs the dispatched Claude CLI (which runs in the UE project dir) to,
 * after implementing the item and confirming the build, launch the slice, take
 * a HighResShot, find the newest screenshot, and POST its path to the app's
 * /api/verify/visual route — which runs Gemini and records the verdict.
 *
 * Advisory: a "fail" verdict is reported, not looped on, and never blocks the
 * checklist completion callback.
 */

import type { SubModuleId } from '@/types/modules';

export interface VisualCheckOptions {
  /** UE project root (CLI working directory). Screenshot dir is derived from it. */
  projectPath: string;
  /** App origin for the verification callback (absolute — CLI runs outside the app). */
  appOrigin: string;
  moduleId: SubModuleId;
  itemId: string;
  editorExe?: string;
  map?: string;
  resX?: number;
  resY?: number;
  /**
   * Which server-owned Gemini question to run on the screenshot (folder-05 §5).
   * `'hud'` (default) = the HUD-element check; `'lighting'` = the environment
   * lit/not-black/shadowed smoke check; `'character'` = the humanoid /
   * natural-pose / not-T-posed / enemy-distinct check (folder-02 §6). All reuse
   * the same launch+screenshot step and the same `/api/verify/visual` route —
   * only the `mode` field and the advisory framing differ.
   */
  mode?: 'hud' | 'lighting' | 'character';
}

/** Same defaults as e2e/helpers/ue-verification.ts so the two paths agree. */
const DEFAULT_EDITOR =
  'C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor.exe';
const DEFAULT_MAP = '/Game/Maps/VerticalSlice';

export function buildVisualCheckSection(opts: VisualCheckOptions): string {
  const editorExe = opts.editorExe ?? process.env.POF_UE_EDITOR ?? DEFAULT_EDITOR;
  const map = opts.map ?? process.env.POF_VERIFY_MAP ?? DEFAULT_MAP;
  const resX = opts.resX ?? 1280;
  const resY = opts.resY ?? 720;
  const screenshotDir = `${opts.projectPath}\\Saved\\Screenshots\\WindowsEditor`;

  const isLighting = opts.mode === 'lighting';
  const isCharacter = opts.mode === 'character';
  const heading = isLighting
    ? 'Lighting Verification'
    : isCharacter
      ? 'Character Verification'
      : 'Visual Verification';
  const intro = isLighting
    ? 'verify the environment actually renders LIT on screen (not a black / un-lit scene)'
    : isCharacter
      ? 'verify the character actually renders as a humanoid in a natural pose (not stuck in a default T-pose)'
      : 'verify the result actually renders on screen';
  const modePrefix = isLighting
    ? '"mode": "lighting", '
    : isCharacter
      ? '"mode": "character", '
      : '';
  const geminiAsk = isLighting
    ? `\n   Gemini is asked: is the scene **lit** (surfaces + colour visible) or **black / un-lit**, and are surfaces **shadowed** (graded depth) or **flat-shaded**?`
    : isCharacter
      ? `\n   Gemini is asked: is a **humanoid** character visible in a **natural pose** (idle/standing/walking), NOT a default **T-pose / A-pose** (arms straight out = the AnimBP never drove the mesh), and — if a player + enemy are both on screen — are they clearly **visually distinct**?`
      : '';
  const failExample = isLighting
    ? 'the scene reads as black / un-lit'
    : isCharacter
      ? 'the character is T-posed or no humanoid is visible'
      : 'a bar reads as empty / zero-width';

  return `## ${heading} (advisory — do NOT loop on failure)

After you have implemented this item AND confirmed the C++ build compiles, ${intro}:

1. Launch the slice in a real (rendered) window and capture a screenshot. From the project root, run the editor on the project's \`.uproject\`:
   \`& "${editorExe}" "<the .uproject in ${opts.projectPath}>" ${map} -game -windowed -ResX=${resX} -ResY=${resY} -ExecCmds="HighResShot ${resX}x${resY}"\`
   Let it run ~25 seconds for the level + HUD to settle, then terminate it: \`taskkill /IM UnrealEditor.exe /F\`.
2. Find the newest \`.png\` in:
   \`${screenshotDir}\`
3. POST that screenshot's absolute path to the app so it can run a Gemini vision check and record the verdict:
   \`POST ${opts.appOrigin}/api/verify/visual\`
   Body: \`{ ${modePrefix}"moduleId": "${opts.moduleId}", "itemId": "${opts.itemId}", "screenshotPath": "<absolute path to the newest png>" }\`${geminiAsk}
4. Read the JSON response. On \`success\`, report the returned \`verdict\` and \`notes\` in your summary. This check is **advisory**: if \`verdict\` is \`"fail"\` (e.g. ${failExample}), flag it for the operator but do NOT loop trying to fix it unless asked. On \`success:false\`, surface the \`error\` text.

If the build fails or no screenshot is produced, say so plainly and skip the POST — this step never blocks completing the item.`;
}

export interface TextureCheckOptions {
  /** App origin for the verification callback (absolute — CLI runs outside the app). */
  appOrigin: string;
  /** Records the verdict under this module id (e.g. arpg-materials). */
  moduleId: SubModuleId;
  /** Texture identifier (e.g. tm-floor) — the per-texture record key. */
  itemId: string;
  /**
   * Absolute path to the generated/downloaded texture PNG. If omitted, the CLI
   * is told to locate the freshly generated PNG itself.
   */
  texturePath?: string;
}

/**
 * Texture-quality verification section (folder-06 §6). Appended after a texture
 * generation/fetch step. Unlike the HUD check it inspects the *texture PNG
 * itself* (not a game screenshot) and asks Gemini whether it is a seamless,
 * tileable surface free of visible seams and baked-in lighting. Advisory — a
 * "fail" is reported, never looped on.
 */
export function buildTextureCheckSection(opts: TextureCheckOptions): string {
  const pngRef = opts.texturePath
    ? `the texture PNG at:\n   \`${opts.texturePath}\``
    : `the texture PNG you just generated/downloaded (find the newest \`.png\` under the texture output dir)`;

  return `## Texture Quality (advisory — do NOT loop on failure)

After the texture has been generated/downloaded, verify it is genuinely a seamless tileable surface:

1. Identify ${pngRef}
2. POST that PNG's absolute path to the app so it can run a Gemini vision check on the texture itself and record the verdict:
   \`POST ${opts.appOrigin}/api/verify/visual\`
   Body: \`{ "mode": "texture", "moduleId": "${opts.moduleId}", "itemId": "${opts.itemId}", "screenshotPath": "<absolute path to the texture png>" }\`
   Gemini is asked: is this a **seamless, tileable** texture? Note any obvious **seam**, **baked-in lighting/shadow**, or non-tileable feature.
3. Read the JSON response. On \`success\`, report the returned \`verdict\` (\`pass\`/\`fail\`) and \`notes\`. This check is **advisory**: a \`"fail"\` (e.g. a visible seam or baked lighting) is flagged for the operator but does NOT block completing the item. On \`success:false\`, surface the \`error\` text.

If no PNG is produced, say so plainly and skip the POST — this step never blocks completing the item.`;
}
