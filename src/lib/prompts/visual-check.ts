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

  return `## Visual Verification (advisory — do NOT loop on failure)

After you have implemented this item AND confirmed the C++ build compiles, verify the result actually renders on screen:

1. Launch the slice in a real (rendered) window and capture a screenshot. From the project root, run the editor on the project's \`.uproject\`:
   \`& "${editorExe}" "<the .uproject in ${opts.projectPath}>" ${map} -game -windowed -ResX=${resX} -ResY=${resY} -ExecCmds="HighResShot ${resX}x${resY}"\`
   Let it run ~25 seconds for the level + HUD to settle, then terminate it: \`taskkill /IM UnrealEditor.exe /F\`.
2. Find the newest \`.png\` in:
   \`${screenshotDir}\`
3. POST that screenshot's absolute path to the app so it can run a Gemini vision check and record the verdict:
   \`POST ${opts.appOrigin}/api/verify/visual\`
   Body: \`{ "moduleId": "${opts.moduleId}", "itemId": "${opts.itemId}", "screenshotPath": "<absolute path to the newest png>" }\`
4. Read the JSON response. On \`success\`, report the returned \`verdict\` and \`notes\` in your summary. This check is **advisory**: if \`verdict\` is \`"fail"\` (e.g. a bar reads as empty / zero-width), flag it for the operator but do NOT loop trying to fix it unless asked. On \`success:false\`, surface the \`error\` text.

If the build fails or no screenshot is produced, say so plainly and skip the POST — this step never blocks completing the item.`;
}
