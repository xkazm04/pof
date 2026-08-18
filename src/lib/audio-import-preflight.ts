/**
 * Preflight for the audio-import dispatch.
 *
 * The import task instructs the CLI to run `Content/Python/import_audio_set.py`
 * inside the UE project. PoF does not ship that script, so on a project that
 * lacks it the dispatch spends a CLI session and fails at runtime with no prior
 * warning. This resolves the UE root and reports whether the dependency is
 * actually there — checked BEFORE the CLI is spawned, with the reason.
 *
 * Never claims the script exists: an unresolvable UE root is reported as
 * "cannot verify", which is a blocking condition, not a pass.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveUeRoot } from '@/lib/catalog/acceptance/ueStaticCheckers';
import type { AudioImportPreflight } from '@/lib/audio-import-status';

/** Project-relative path of the UE-side importer the task drives. */
export const AUDIO_IMPORT_SCRIPT_REL = 'Content/Python/import_audio_set.py';

export type { AudioImportPreflight };

export interface PreflightDeps {
  resolveUeRoot: () => string | null;
  exists: (p: string) => boolean;
  join: (...parts: string[]) => string;
}

const DEFAULT_DEPS: PreflightDeps = { resolveUeRoot, exists: existsSync, join };

/** Resolve the UE root and check the importer script. Pure over injected deps. */
export function checkAudioImportPreflight(deps: PreflightDeps = DEFAULT_DEPS): AudioImportPreflight {
  const ueRoot = deps.resolveUeRoot();
  if (!ueRoot) {
    return {
      ok: false,
      ueRoot: null,
      scriptRelPath: AUDIO_IMPORT_SCRIPT_REL,
      scriptAbsPath: null,
      scriptPresent: false,
      reason:
        'No UE project root could be resolved (set POF_UE_ROOT), so the importer script ' +
        `\`${AUDIO_IMPORT_SCRIPT_REL}\` cannot be verified. Import not dispatched.`,
    };
  }
  const scriptAbsPath = deps.join(ueRoot, AUDIO_IMPORT_SCRIPT_REL);
  const scriptPresent = deps.exists(scriptAbsPath);
  return {
    ok: scriptPresent,
    ueRoot,
    scriptRelPath: AUDIO_IMPORT_SCRIPT_REL,
    scriptAbsPath,
    scriptPresent,
    reason: scriptPresent
      ? `Importer script found at ${scriptAbsPath}.`
      : `Missing UE dependency: ${scriptAbsPath} does not exist. PoF does not ship this script — ` +
        'author it in the UE project (or run the Sound Forge authoring task) before importing. ' +
        'Import not dispatched.',
  };
}
