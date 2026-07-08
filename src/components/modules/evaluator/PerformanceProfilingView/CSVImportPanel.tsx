'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

// ── CSV Import Panel ────────────────────────────────────────────────────────

export function CSVImportPanel({ onImport, isImporting }: {
  onImport: (csv: string, name: string) => Promise<void>;
  isImporting: boolean;
}) {
  const [csvText, setCsvText] = useState('');
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name.replace(/\.(csv|txt)$/i, ''));
    const reader = new FileReader();
    reader.onload = () => setCsvText(reader.result as string);
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
      {csvText && (
        <div className="text-2xs text-text-muted">
          Loaded {csvText.split('\n').length} lines · {(csvText.length / 1024).toFixed(1)}KB
        </div>
      )}
      <p className="text-2xs text-text-muted/60">
        Paste or upload a UE5 stat dump CSV (stat dumpframe, Unreal Insights CSV export)
      </p>
    </SurfaceCard>
  );
}
