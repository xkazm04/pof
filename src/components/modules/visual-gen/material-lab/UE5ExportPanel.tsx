'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { buildUE5MaterialInstance } from '@/lib/visual-gen/ue5-material-instance';
import { useMaterialStore } from './useMaterialStore';

/**
 * The "Export to UE5" affordance the module description, the `ml-3` quick action
 * and the `mat-ue5` checklist item all promised and nothing implemented.
 *
 * It states what it PRODUCED (a script, in the browser) and what the user must
 * do next (run it in the editor). PoF does not reach into the UE project from
 * here, so there is deliberately no "exported!" message — a success banner for a
 * file nobody wrote is exactly the lie this panel exists to avoid. Copy and
 * Download are real: the browser writes the file the user chooses.
 */
export function UE5ExportPanel() {
  const params = useMaterialStore((s) => s.params);
  const albedoTexture = useMaterialStore((s) => s.albedoTexture);
  const normalTexture = useMaterialStore((s) => s.normalTexture);
  const metallicTexture = useMaterialStore((s) => s.metallicTexture);
  const roughnessTexture = useMaterialStore((s) => s.roughnessTexture);
  const aoTexture = useMaterialStore((s) => s.aoTexture);

  const [name, setName] = useState('LabMaterial');

  const emitted = useMemo(
    () =>
      buildUE5MaterialInstance({
        name,
        params,
        textures: {
          albedo: albedoTexture,
          normal: normalTexture,
          metallic: metallicTexture,
          roughness: roughnessTexture,
          ao: aoTexture,
        },
      }),
    [name, params, albedoTexture, normalTexture, metallicTexture, roughnessTexture, aoTexture],
  );

  return (
    <div className="space-y-3" data-testid="ue5-export-panel">
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-muted" htmlFor="ue5-asset-name">
          Asset name
        </label>
        <input
          id="ue5-asset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="focus-ring px-2 py-1 text-xs rounded border border-border bg-transparent text-text"
        />
        <span className="text-xs font-mono text-text-muted truncate">{emitted.assetPath}</span>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-text-muted bg-[var(--surface-deep)] rounded px-2 py-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          <p>
            PoF generated this script here in the browser — <span className="font-medium">nothing has been written
            to your UE project.</span> To apply it: download or copy it, then in the UE5 editor open{' '}
            <span className="font-mono">Window &gt; Developer Tools &gt; Output Log</span>, switch the console to
            Python and run <span className="font-mono">py &quot;&lt;path&gt;/{emitted.fileName}&quot;</span>.
          </p>
          <p className="mt-1">
            It creates a <span className="font-mono">MaterialInstanceConstant</span> of{' '}
            <span className="font-mono">{emitted.parentMaterial}</span>, authoring a minimal stand-in master if the
            project has none, and warns for any parameter that master does not expose.
          </p>
        </div>
      </div>

      {emitted.notExported.length > 0 && (
        <div
          data-testid="ue5-export-dropped"
          className="flex items-start gap-1.5 text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Not included in the script:</p>
            <ul className="mt-0.5 space-y-0.5">
              {emitted.notExported.map((dropped) => (
                <li key={dropped.label}>
                  <span className="font-medium">{dropped.label}</span> — {dropped.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-text-muted mb-1.5">
          Parameters set: {emitted.parameters.map((p) => p.name).join(', ')}
        </p>
        <CodeViewer code={emitted.script} fileName={emitted.fileName} lang="python" languageLabel="UE Python" />
      </div>
    </div>
  );
}
