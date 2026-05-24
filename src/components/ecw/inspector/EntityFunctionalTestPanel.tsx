'use client';

import { Play, CheckCircle, XCircle } from 'lucide-react';
import { getRecipe } from '@/lib/catalog/recipe';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Functional Test panel. Reads `getRecipe(entity.catalogId).testPath` (the
 * per-section gate set by folder-09 work) plus last test verdict. "Run again"
 * stays disabled until Phase 4 wires CLI Rail dispatch.
 */
export function EntityFunctionalTestPanel({ entity }: Props) {
  const recipe = getRecipe(entity.catalogId);
  const testPath = recipe?.testPath;
  const verdict = entity.lastTestResult;

  return (
    <section className="border-b border-border/40 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Functional Test</span>
        <button
          disabled
          title="Wired in Phase 4 — CLI Rail integration"
          className="focus-ring flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-mono border border-border/50 text-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-3 h-3" />
          <span>Run again</span>
        </button>
      </div>

      {testPath ? (
        <p className="text-2xs font-mono text-text break-all">{testPath}</p>
      ) : (
        <p className="text-xs text-text-muted/70 italic">No functional test wired for this catalog yet.</p>
      )}

      {verdict && (
        <div className="flex items-center gap-2 text-xs">
          {verdict === 'pass' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
          {verdict === 'fail' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
          <span className="font-mono uppercase text-text">{verdict}</span>
          {entity.lastVerifiedAt && (
            <span className="text-text-muted/70">· {new Date(entity.lastVerifiedAt).toLocaleString()}</span>
          )}
        </div>
      )}
    </section>
  );
}
