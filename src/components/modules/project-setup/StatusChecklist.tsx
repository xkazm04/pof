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

const INSTALL_URLS: Record<string, { url: string; label: string }> = {
  engine: { url: 'https://www.unrealengine.com/download', label: 'Get Epic Launcher' },
  'tool-vs': { url: 'https://visualstudio.microsoft.com/downloads/', label: 'Get Visual Studio' },
  'tool-msvc': { url: 'https://visualstudio.microsoft.com/visual-cpp-build-tools/', label: 'Get C++ Build Tools' },
  'tool-wsdk': { url: 'https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/', label: 'Get Windows SDK' },
  'tool-dotnet': { url: 'https://dotnet.microsoft.com/en-us/download/dotnet/8.0', label: 'Get .NET 8.0 Runtime' },
};

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
      const res = await fetch('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export-manifest' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const json = JSON.stringify(data.manifest, null, 2);
      onManifestExported(json);
      await navigator.clipboard.writeText(json);
      setManifestCopied(true);
      setTimeout(() => setManifestCopied(false), 2000);
    } catch {
      // Non-critical
    }
  }, [onManifestExported]);

  const jsonValidation = useMemo<
    | { status: 'empty' }
    | { status: 'error'; message: string }
    | { status: 'valid'; manifest: { tools: { installed: boolean; name: string; installCommand?: string; category?: string }[] }; toolCount: number; categoryCount: number; missingCount: number }
  >(() => {
    const trimmed = importText.trim();
    if (!trimmed) return { status: 'empty' };

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed.tools || !Array.isArray(parsed.tools)) {
        return { status: 'error', message: 'Missing "tools" array in manifest' };
      }
      const tools = parsed.tools as { installed: boolean; name: string; installCommand?: string; category?: string }[];
      const categories = new Set(tools.map((t) => t.category ?? 'uncategorized'));
      const missingCount = tools.filter((t) => !t.installed && t.installCommand).length;
      return { status: 'valid', manifest: parsed, toolCount: tools.length, categoryCount: categories.size, missingCount };
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON';
      return { status: 'error', message: msg };
    }
  }, [importText]);

  const handleFormatJson = useCallback(() => {
    if (jsonValidation.status !== 'valid') return;
    setImportText(JSON.stringify(jsonValidation.manifest, null, 2));
  }, [jsonValidation]);

  const handleImportManifest = useCallback(() => {
    if (jsonValidation.status !== 'valid') return;
    const missing = jsonValidation.manifest.tools
      .filter((t) => !t.installed && t.installCommand)
      .map((t) => `- ${t.name}: \`${t.installCommand}\``)
      .join('\n');
    if (!missing) return;

    const prompt = `A teammate shared their environment manifest. Install the following missing tools:\n\n${missing}\n\nRun each command and report the result. Do NOT use TodoWrite.`;
    onBootstrapFromManifest(prompt);
    setShowImport(false);
    setImportText('');
  }, [jsonValidation, onBootstrapFromManifest]);

  return (
    <div className="w-56 shrink-0 border-r border-border bg-background/50 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Status
        </span>
        {scanning ? (
          <Loader2 className="w-3 h-3 text-text-muted animate-spin" />
        ) : (
          <button
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
          <div key={item.id} className="flex items-start gap-2.5">
            <div className="relative mt-[3px] shrink-0">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  item.ok ? 'bg-[#00ff88]' : 'bg-red-400'
                }`}
              />
              {i < checklist.length - 1 && (
                <div className="absolute top-3 left-[4px] w-px h-4 bg-border" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-text leading-none block">
                {item.label}
              </span>
              <span
                className={`text-xs leading-tight block mt-0.5 truncate ${
                  item.ok ? 'text-[#00ff88]/70' : 'text-red-400/70'
                }`}
                title={item.detail}
              >
                {item.detail}
              </span>
              {!item.ok && INSTALL_URLS[item.id] && (
                <a
                  href={INSTALL_URLS[item.id].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#3b82f6] hover:text-[#60a5fa] mt-0.5 transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {INSTALL_URLS[item.id].label}
                </a>
              )}
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
          <button
            onClick={onFixAllMissing}
            disabled={isBootstrapping || scanning}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: '#3b82f615',
              color: '#3b82f6',
              border: '1px solid #3b82f630',
            }}
          >
            {isBootstrapping ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wrench className="w-3 h-3" />
            )}
            {isBootstrapping ? 'Installing...' : `Fix ${missingToolCount} Missing`}
          </button>
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
              <Check className="w-3 h-3 text-[#00ff88]" />
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
                      ? 'border border-[#00ff88]/40 focus:border-[#00ff88]/70'
                      : 'border border-border focus:border-border-bright'
                }`}
                rows={4}
              />
              {/* Validation feedback */}
              {jsonValidation.status === 'error' && (
                <p className="text-2xs text-red-400 leading-snug">{jsonValidation.message}</p>
              )}
              {jsonValidation.status === 'valid' && (
                <p className="text-2xs text-[#00ff88]/80 leading-snug">
                  {jsonValidation.toolCount} tool{jsonValidation.toolCount !== 1 ? 's' : ''} detected
                  {jsonValidation.categoryCount > 1 ? ` across ${jsonValidation.categoryCount} categories` : ''}
                  {jsonValidation.missingCount > 0 ? ` · ${jsonValidation.missingCount} to install` : ' · all installed'}
                </p>
              )}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleImportManifest}
                  disabled={jsonValidation.status !== 'valid' || jsonValidation.missingCount === 0 || isBootstrapping}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: '#3b82f615',
                    color: '#3b82f6',
                    border: '1px solid #3b82f630',
                  }}
                >
                  <Wrench className="w-3 h-3" />
                  Install from Manifest
                </button>
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
