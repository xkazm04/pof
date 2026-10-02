'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Loader2,
  Check,
  ExternalLink,
  Wrench,
  Download,
  Upload,
  AlignLeft,
} from 'lucide-react';
import type { ChecklistItem } from './useProjectScan';
import { UI_TIMEOUTS } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { StatusDot } from '@/components/ui/StatusDot';
import { apiFetch } from '@/lib/api-utils';
import {
  installLinkFor,
  parseManifest,
  planManifestImport,
  type EnvironmentManifest,
  type ImportedManifest,
  type ManifestImportPlan,
} from '@/lib/project-setup/toolchain';

/** The toolchain table's install link for a failing requirement (nothing for non-requirement items). */
function InstallLink({ checklistId }: { checklistId: string }) {
  const link = installLinkFor(checklistId);
  if (!link) return null;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs text-accent-core hover:text-accent-core/80 mt-0.5 transition-colors"
    >
      <ExternalLink className="w-2.5 h-2.5" />
      {link.label}
    </a>
  );
}

interface StatusChecklistProps {
  checklist: ChecklistItem[];
  scanning: boolean;
  okCount: number;
  missingToolCount: number;
  isBootstrapping: boolean;
  onScan: () => void;
  onFixAllMissing: () => void;
  onBootstrapFromManifest: (prompt: string) => void;
  onManifestExported: (json: string) => void;
}

export function StatusChecklist({
  checklist,
  scanning,
  okCount,
  missingToolCount,
  isBootstrapping,
  onScan,
  onFixAllMissing,
  onBootstrapFromManifest,
  onManifestExported,
}: StatusChecklistProps) {
  const [manifestCopied, setManifestCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleExportManifest = useCallback(async () => {
    try {
      const data = await apiFetch<{ manifest: EnvironmentManifest }>('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export-manifest' }),
      });
      const json = JSON.stringify(data.manifest, null, 2);
      onManifestExported(json);
      await navigator.clipboard.writeText(json);
      setManifestCopied(true);
      setTimeout(() => setManifestCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch {
      // Non-critical
    }
  }, [onManifestExported]);

  const jsonValidation = useMemo<
    | { status: 'empty' }
    | { status: 'error'; message: string }
    | { status: 'valid'; manifest: ImportedManifest; toolCount: number; categoryCount: number; plan: ManifestImportPlan }
  >(() => {
    const trimmed = importText.trim();
    if (!trimmed) return { status: 'empty' };
    const parsed = parseManifest(trimmed);
    if (!parsed.ok) return { status: 'error', message: parsed.error };
    const { tools } = parsed.data;
    const categories = new Set(tools.map((t) => t?.category ?? 'uncategorized'));
    // Diff the teammate's installed set against THIS machine's scan.
    const plan = planManifestImport(parsed.data, checklist);
    return { status: 'valid', manifest: parsed.data, toolCount: tools.length, categoryCount: categories.size, plan };
  }, [importText, checklist]);

  const handleFormatJson = useCallback(() => {
    if (jsonValidation.status !== 'valid') return;
    setImportText(JSON.stringify(jsonValidation.manifest, null, 2));
  }, [jsonValidation]);

  const handleImportManifest = useCallback(() => {
    if (jsonValidation.status !== 'valid' || !jsonValidation.plan.prompt) return;
    onBootstrapFromManifest(jsonValidation.plan.prompt);
    setShowImport(false);
    setImportText('');
  }, [jsonValidation, onBootstrapFromManifest]);

  return (
    <div data-testid="pof-setup-wizard-checklist" className="w-56 shrink-0 border-r border-border bg-background/50 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Status
        </h2>
        {scanning ? (
          <Loader2 className="w-3 h-3 text-text-muted animate-spin" />
        ) : (
          <button
            data-testid="pof-setup-wizard-scan-btn"
            onClick={onScan}
            className="p-0.5 text-text-muted hover:text-text transition-colors"
            title="Re-scan"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-3 flex-1">
        {checklist.map((item, i) => (
          <div
            key={item.id}
            data-testid={`pof-setup-wizard-checklist-item-${item.id}`}
            className="flex items-start gap-2.5"
          >
            <div className="relative mt-[2px] shrink-0">
              <StatusDot
                state={item.ok ? 'ok' : 'fail'}
                size="md"
                title={`${item.label}: ${item.ok ? 'OK' : 'Missing'}`}
              />
              {i < checklist.length - 1 && (
                <div className="absolute top-3.5 left-[5px] w-px h-4 bg-border" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-text leading-none block">
                {item.label}
              </span>
              <span
                className={`text-xs leading-tight block mt-0.5 truncate ${
                  item.ok ? 'text-accent-setup/70' : 'text-red-400/70'
                }`}
                title={item.detail}
              >
                {item.detail}
              </span>
              {!item.ok && <InstallLink checklistId={item.id} />}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {checklist.length > 0 && (
        <div className="pt-3 mt-3 border-t border-border">
          <span className="text-xs text-text-muted">
            {okCount}/{checklist.length} checks passing
          </span>
        </div>
      )}

      {/* Fix All Missing Tools */}
      {missingToolCount > 0 && (
        <div className="pt-3 mt-2">
          <Button
            intent="info"
            size="sm"
            onClick={onFixAllMissing}
            disabled={scanning}
            loading={isBootstrapping}
            loadingLabel="Installing..."
            leftIcon={<Wrench className="w-3 h-3" />}
            className="w-full justify-center"
          >
            Fix {missingToolCount} Missing
          </Button>
        </div>
      )}

      {/* Export / Import Manifest */}
      {checklist.length > 0 && (
        <div className="pt-2 mt-2 border-t border-border space-y-1.5">
          <button
            onClick={handleExportManifest}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-text hover:bg-surface transition-colors"
          >
            {manifestCopied ? (
              <Check className="w-3 h-3 text-accent-setup" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            {manifestCopied ? 'Copied!' : 'Export Manifest'}
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-text hover:bg-surface transition-colors"
          >
            <Upload className="w-3 h-3" />
            Import Manifest
          </button>
          {showImport && (
            <div className="space-y-1.5">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste manifest JSON..."
                className={`w-full px-2 py-1.5 bg-surface rounded-md text-xs text-text placeholder-text-muted outline-none transition-colors resize-none font-mono ${
                  jsonValidation.status === 'error'
                    ? 'border border-red-400/60 focus:border-red-400'
                    : jsonValidation.status === 'valid'
                      ? 'border border-accent-setup/40 focus:border-accent-setup/70'
                      : 'border border-border focus:border-border-bright'
                }`}
                rows={4}
              />
              {/* Validation feedback */}
              {jsonValidation.status === 'error' && (
                <p className="text-2xs text-red-400 leading-snug">{jsonValidation.message}</p>
              )}
              {jsonValidation.status === 'valid' && (
                <p className="text-2xs text-accent-setup/80 leading-snug">
                  {jsonValidation.toolCount} tool{jsonValidation.toolCount !== 1 ? 's' : ''} detected
                  {jsonValidation.categoryCount > 1 ? ` across ${jsonValidation.categoryCount} categories` : ''}
                  {jsonValidation.plan.installs.length > 0
                    ? ` · ${jsonValidation.plan.installs.length} to install`
                    : jsonValidation.plan.skipped.some((s) => s.reason === 'not-scanned')
                      ? ' · re-scan this machine first'
                      : ' · nothing missing here'}
                </p>
              )}
              <div className="flex items-center gap-1.5">
                <Button
                  intent="info"
                  size="sm"
                  onClick={handleImportManifest}
                  disabled={jsonValidation.status !== 'valid' || jsonValidation.plan.installs.length === 0 || isBootstrapping}
                  leftIcon={<Wrench className="w-3 h-3" />}
                  className="flex-1 justify-center"
                >
                  Install from Manifest
                </Button>
                <button
                  onClick={handleFormatJson}
                  disabled={jsonValidation.status !== 'valid'}
                  className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="Format JSON"
                >
                  <AlignLeft className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
