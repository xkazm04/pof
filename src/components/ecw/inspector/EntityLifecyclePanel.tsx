'use client';

import { Copy, CheckCircle, XCircle } from 'lucide-react';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

function copyToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(value);
  }
}

/**
 * Lifecycle + UE Assets panel. Generic — every catalog entity has these
 * fields. Reads `entity.lifecycle`, `entity.ueAssets`, `entity.lastTestResult`,
 * `entity.lastVerifiedAt`. Per-asset copy-to-clipboard for fast UE editor
 * paste.
 */
export function EntityLifecyclePanel({ entity }: Props) {
  const verdictPass = entity.lastTestResult === 'pass';
  const verdictFail = entity.lastTestResult === 'fail';

  return (
    <section className="border-b border-border/40 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
          Lifecycle &amp; UE Assets
        </span>
        <LifecycleBadge state={entity.lifecycle} />
      </div>

      <div>
        {(!entity.ueAssets || entity.ueAssets.length === 0) ? (
          <p className="text-xs text-text-muted/70 italic">No UE assets generated yet.</p>
        ) : (
          <ul className="space-y-1">
            {entity.ueAssets.map((path) => (
              <li key={path} className="flex items-center gap-2 text-xs font-mono">
                <span className="flex-1 truncate text-text">{path}</span>
                <button
                  onClick={() => copyToClipboard(path)}
                  className="focus-ring p-1 text-text-muted hover:text-text rounded"
                  aria-label={`copy ${path}`}
                  title="Copy path"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entity.lastTestResult && (
        <div className="flex items-center gap-2 text-xs">
          {verdictPass && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
          {verdictFail && <XCircle className="w-3.5 h-3.5 text-red-500" />}
          <span className="font-mono uppercase text-text">{entity.lastTestResult}</span>
          {entity.lastVerifiedAt && (
            <span className="text-text-muted/70">· {new Date(entity.lastVerifiedAt).toLocaleString()}</span>
          )}
        </div>
      )}
    </section>
  );
}
