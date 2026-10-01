'use client';

import { useState } from 'react';
import { Download, Copy, Check, ClipboardPaste } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { exportStats } from './themeSchema';
import { parseUE5Config, type HudImportResult } from './helpers';
import type { HudTheme } from './types';

const btn = 'focus-ring flex items-center gap-1 px-2 py-1 text-2xs font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors';

/** What the last import did — every unapplied line is named, never dropped silently. */
function ImportReport({ result }: { result: HudImportResult }) {
  const { applied, unknown, warnings, malformed } = result;
  return (
    <div className="space-y-1 text-2xs" role="status" data-testid="hud-theme-import-report">
      <div style={{ color: applied.length ? STATUS_SUCCESS : STATUS_ERROR }}>
        {applied.length
          ? `Applied ${applied.length} UPROPERTY${applied.length === 1 ? '' : 's'}`
          : 'Nothing applied: no HUD theme UPROPERTY recognised'}
      </div>
      {unknown.length > 0 && (
        <div style={{ color: STATUS_WARNING }}>Unknown (not applied): {unknown.join(', ')}</div>
      )}
      {warnings.map((w, i) => (
        <div key={`w${i}`} style={{ color: STATUS_WARNING }}>
          {w.name}{w.component ? `.${w.component.toUpperCase()}` : ''} clamped from {w.clampedFrom}
        </div>
      ))}
      {malformed.map(m => (
        <div key={`m${m.line}`} style={{ color: STATUS_ERROR }}>
          Line {m.line} not applied ({m.reason}): <code className="font-mono">{m.text}</code>
        </div>
      ))}
    </div>
  );
}

function ImportBox({ theme, onImport, onClose }: {
  theme: HudTheme;
  onImport: (theme: HudTheme) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<HudImportResult | null>(null);
  const runImport = () => {
    const r = parseUE5Config(text, theme);
    setResult(r);
    if (r.applied.length > 0) onImport(r.theme);
  };
  return (
    <div className="space-y-2" data-testid="hud-theme-import">
      <textarea
        aria-label="Paste a HUD theme .h"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="float FadeOutDelay = 4.5f;"
        rows={5}
        className="focus-ring w-full p-2 text-xs font-mono rounded-md bg-black/50 border border-border/40 text-text"
      />
      <div className="flex items-center gap-1">
        <button type="button" onClick={runImport} disabled={!text.trim()} className={btn}>
          <span className="text-text-muted">Import</span>
        </button>
        <button type="button" onClick={onClose} className={btn}>
          <span className="text-text-muted">Close</span>
        </button>
      </div>
      {result && <ImportReport result={result} />}
    </div>
  );
}

export function ExportPanel({
  theme,
  exportConfig,
  copied,
  handleCopy,
  handleDownload,
  onImport,
}: {
  theme: HudTheme;
  exportConfig: string;
  copied: boolean;
  handleCopy: () => void;
  handleDownload: () => void;
  onImport: (theme: HudTheme) => void;
}) {
  const [importing, setImporting] = useState(false);
  const stats = exportStats(theme);
  return (
    <SurfaceCard level={2} className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-text-muted uppercase">
          UE5 UMG Configuration
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setImporting(v => !v)}
            className={btn}
            title="Paste a .h to load its values"
            aria-expanded={importing}
          >
            <ClipboardPaste className="w-3 h-3 text-text-muted" />
            <span className="text-text-muted">Paste .h</span>
          </button>
          <button type="button" onClick={handleCopy} className={btn} title="Copy to clipboard">
            {copied ? (
              <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
            ) : (
              <Copy className="w-3 h-3 text-text-muted" />
            )}
            <span className="text-text-muted">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button type="button" onClick={handleDownload} className={btn} title="Download .h file">
            <Download className="w-3 h-3 text-text-muted" />
            <span className="text-text-muted">.h</span>
          </button>
        </div>
      </div>

      {importing && <ImportBox theme={theme} onImport={onImport} onClose={() => setImporting(false)} />}

      <div className="relative rounded-md bg-black/50 border border-border/40 overflow-hidden">
        <pre className="p-3 text-xs font-mono text-text-muted leading-relaxed overflow-auto max-h-[400px] whitespace-pre">
          {exportConfig}
        </pre>
      </div>

      {/* Quick stats — counted from the parameter table, not typed in */}
      <div className="grid grid-cols-3 gap-2" data-testid="hud-theme-export-stats">
        {[
          [stats.uproperties, 'UPROPERTYs'],
          [stats.widgetClasses, 'Widget Classes'],
          [stats.elements, 'Elements'],
        ].map(([n, label]) => (
          <div key={label} className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
            <div className="text-xs font-bold text-text">{n}</div>
            <div className="text-2xs text-text-muted">{label}</div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
