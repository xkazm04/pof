'use client';

import { useState, useCallback } from 'react';
import { Download, FolderInput, ExternalLink, Loader2, PersonStanding } from 'lucide-react';
import {
  ACCENT_VIOLET, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_30, withOpacity,
} from '@/lib/chart-colors';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { UE_KNOWN_ASSETS } from '@/lib/knowledge/ue-known-assets';

const ACCENT = ACCENT_VIOLET;

/** Default retarget skeleton — sourced from the known-assets registry, not invented. */
const DEFAULT_SKELETON =
  UE_KNOWN_ASSETS.find((a) => a.id === 'sk-mannequin')?.path ??
  '/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin';

/** The manual download contract — what the operator must do on mixamo.com first. */
const DOWNLOAD_STEPS = [
  'Sign in at mixamo.com and pick (or upload) a character.',
  'Download FBX Binary, 30 FPS — first/character file "With Skin", every animation "Without Skin".',
  'Locomotion (idle/walk/run) → check "In Place"; attacks/dodges keep root motion.',
  'Mixamo bones use the "mixamorig:" prefix — the pipeline handles it on import.',
  'Drop every .fbx into the watched folder below, then run the import.',
];

/**
 * Mixamo import surface (folder-02 §3).
 *
 * Surfaces the manual Mixamo download contract (Mixamo has no API), then
 * dispatches the project's mixamo_pipeline.py via the full editor over a watched
 * folder of FBX files — importing + retargeting them onto the target skeleton.
 */
export function MixamoImport() {
  const projectPath = useProjectStore((s) => s.projectPath);

  const defaultDir = projectPath
    ? `${projectPath.replace(/[\\/]+$/, '')}\\MixamoIncoming`
    : 'MixamoIncoming';

  const [importDir, setImportDir] = useState<string>(defaultDir);
  const [targetSkeleton, setTargetSkeleton] = useState<string>(DEFAULT_SKELETON);

  const { execute, isRunning } = useModuleCLI({
    moduleId: 'animations',
    sessionKey: 'mixamo-import',
    label: 'Mixamo Import',
    accentColor: ACCENT,
  });

  const handleImport = useCallback(() => {
    const dir = importDir.trim();
    const skel = targetSkeleton.trim();
    if (!dir || !skel || isRunning) return;
    execute(
      TaskFactory.mixamoImport(
        'animations',
        { importDir: dir, targetSkeleton: skel },
        getAppOrigin(),
        'Mixamo Import',
      ),
    );
  }, [importDir, targetSkeleton, isRunning, execute]);

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl"
      data-testid="pof-module-animations-mixamo-import"
      style={{
        backgroundColor: withOpacity(ACCENT, OPACITY_8),
        border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-sm font-bold text-text">Import Mixamo Animations</h3>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">
        Mixamo has no API — download the FBX files by hand, drop them in a watched folder, then
        dispatch <code>mixamo_pipeline.py</code> to import + retarget them onto the target skeleton.
      </p>

      {/* Manual download contract */}
      <ol className="space-y-1.5 list-none">
        {DOWNLOAD_STEPS.map((step, i) => (
          <li key={i} className="text-[11px] text-text-muted leading-relaxed flex gap-2">
            <span className="font-mono font-bold" style={{ color: withOpacity(ACCENT, OPACITY_30) }}>
              {String(i + 1).padStart(2, '0')}.
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <a
        href="https://www.mixamo.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium w-fit"
        style={{ color: ACCENT }}
      >
        <ExternalLink className="w-3 h-3" /> Open Mixamo
      </a>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><FolderInput className="w-3 h-3" /> Watched folder (drop FBX here)</span>
        <input
          aria-label="Mixamo import folder"
          value={importDir}
          onChange={(e) => setImportDir(e.target.value)}
          spellCheck={false}
          className="px-2 py-1.5 rounded-lg font-mono text-sm bg-surface-deep/50 text-text outline-none"
          style={{ border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><PersonStanding className="w-3 h-3" /> Target skeleton</span>
        <input
          aria-label="Target skeleton"
          value={targetSkeleton}
          onChange={(e) => setTargetSkeleton(e.target.value)}
          spellCheck={false}
          className="px-2 py-1.5 rounded-lg font-mono text-sm bg-surface-deep/50 text-text outline-none"
          style={{ border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
        />
      </label>

      <button
        type="button"
        onClick={handleImport}
        disabled={isRunning || !importDir.trim() || !targetSkeleton.trim()}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-mono cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          backgroundColor: withOpacity(ACCENT, OPACITY_12),
          border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}`,
          color: ACCENT,
        }}
      >
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        <span>Run Import Pipeline</span>
      </button>
    </div>
  );
}
