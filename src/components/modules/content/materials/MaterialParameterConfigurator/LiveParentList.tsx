'use client';

import { Plug, Check, X } from 'lucide-react';
import type { MaterialEntry } from '@/types/pof-bridge';
import type { ParentMaterialRef } from './types';

/**
 * The live project's master materials (from the UE bridge manifest), each a
 * one-click "Instance this": adopting one parents the generated instance to it
 * and makes its real scalar parameters the sliders. Nothing dispatches here —
 * the CLI runs only from the Generate button.
 */

interface LiveParentListProps {
  masters: MaterialEntry[];
  materialCount: number;
  parent: ParentMaterialRef | null;
  onAdopt: (entry: MaterialEntry) => void;
  onClear: () => void;
}

function assetName(path: string): string {
  return path.split('/').pop() ?? path;
}

export function LiveParentList({ masters, materialCount, parent, onAdopt, onClear }: LiveParentListProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
        <Plug className="w-3 h-3 text-green-400" />
        Live from Bridge
        <span className="text-green-400 font-normal">
          ({materialCount} materials &middot; {masters.length} masters)
        </span>
      </h4>

      {parent && (
        <div
          role="status"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-green-500/10 border border-green-500/30 text-2xs"
        >
          <span className="min-w-0 flex-1 truncate text-text">
            Instancing <span className="font-mono">{assetName(parent.path)}</span>
            <span className="text-text-muted">
              {' '}&middot; {parent.scalars.length} scalars &middot; {parent.vectors.length} vectors &middot;{' '}
              {parent.textures.length} textures &middot; {parent.switches.length} switches
            </span>
          </span>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear parent material"
            className="focus-ring flex items-center gap-1 px-1.5 py-0.5 rounded text-text-muted hover:text-text"
          >
            <X className="w-3 h-3" aria-hidden="true" />
            Clear
          </button>
        </div>
      )}

      {masters.length === 0 ? (
        <p className="text-2xs text-text-muted px-1">No master materials in the live project — only instances.</p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
          {masters.map((mat) => {
            const selected = parent?.path === mat.path;
            const name = assetName(mat.path);
            return (
              <button
                key={mat.path}
                type="button"
                onClick={() => onAdopt(mat)}
                aria-pressed={selected}
                aria-label={`Instance ${name}`}
                title={`Generate a Material Instance of ${mat.path} using its own parameters`}
                className={`focus-ring w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left border transition-colors ${
                  selected ? 'bg-green-500/10 border-green-500/40' : 'bg-surface-deep border-border hover:border-green-500/30'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-2xs text-text flex items-center gap-1 truncate font-mono">
                    {selected && <Check className="w-3 h-3 flex-shrink-0 text-green-400" aria-hidden="true" />}
                    {name}
                  </span>
                  <span className="text-2xs text-text-muted">{mat.domain} &middot; {mat.shadingModel}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-2xs text-text-muted">
                  <span>{mat.parameters.length} params</span>
                  <span>{mat.materialInstances.length} inst</span>
                  <span className="text-green-400">{selected ? 'Parent' : 'Instance this'}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
