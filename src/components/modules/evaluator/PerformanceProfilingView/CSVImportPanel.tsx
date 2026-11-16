'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_ERROR } from '@/lib/chart-colors';

// ── CSV Import Panel ────────────────────────────────────────────────────────

export function CSVImportPanel({ onImport, isImporting }: {
  onImport: (csv: string, name: string) => Promise<void>;
  isImporting: boolean;
}) {
  const [csvText, setCsvText] = useState('');
  const [name, setName] = useState('');
  const [readError, setReadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    // Clear the picker so choosing the same path again (re-export, failed read) fires change.
    // The File object stays valid after the value is reset.
    input.value = '';
    if (!file) return;
    setName(file.name.replace(/\.(csv|txt)$/i, ''));
    setReadError(null);
    const reader = new FileReader();
    reader.onload = () => setCsvText(reader.result as string);
    // A failed read must not leave the previous file's text armed under the new name.
    reader.onerror = () => {
      setCsvText('');
      setReadError(`Could not read ${file.name} — pick the file again or export a fresh CSV.`);
    };
    reader.readAsText(file);
  }, []);

  return (
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-muted hover:text-text transition-colors"
        >
          <Upload className="w-3 h-3" />
          Choose File
        </button>
        <input
          type="text"
          placeholder="Session name"
          aria-label="Session name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-rose-500/40"
        />
        <button
          onClick={() => onImport(csvText, name || 'Imported Session')}
          disabled={!csvText || isImporting}
          className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
        >
          Import & Analyze
        </button>
      </div>
      {readError && (
        <div role="alert" className="text-2xs" style={{ color: STATUS_ERROR }}>
          {readError}
        </div>
      )}
      {csvText && (
        <div className="text-2xs text-text-muted">
          Loaded {csvText.replace(/\r?\n$/, '').split('\n').length} lines · {(csvText.length / 1024).toFixed(1)}KB
        </div>
      )}
      <p className="text-2xs text-text-muted/60">
        Choose a UE5 stat dump CSV or .txt file (stat dumpframe, Unreal Insights CSV export)
      </p>
    </SurfaceCard>
  );
}
