'use client';

import { useState, useCallback, useRef } from 'react';
import { Dna, Upload, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_CYAN, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { SectionLabel } from '../_shared';
import type { CharacterGenome } from '@/types/character-genome';
import { createGenome, createId } from '@/stores/genomeStore';
import { ACCENT } from './field-data';
import { GenomePill } from './GenomePill';

/* ── Genome Selector + Import ────────────────────────────────────────── */

interface GenomeSelectorBarProps {
  genomes: CharacterGenome[];
  resolvedActiveId: string;
  onSelectGenome: (id: string) => void;
  onAddGenome: () => void;
  onImportGenome: (genome: CharacterGenome) => void;
  onUpdateGenome: (id: string, updater: (g: CharacterGenome) => CharacterGenome) => void;
}

export function GenomeSelectorBar({
  genomes, resolvedActiveId, onSelectGenome, onAddGenome, onImportGenome, onUpdateGenome,
}: GenomeSelectorBarProps) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importGenome = useCallback((text: string) => {
    try {
      const parsed = JSON.parse(text) as CharacterGenome;
      if (!parsed.name || !parsed.movement || !parsed.combat) {
        setImportError('Invalid genome: missing required fields (name, movement, combat)');
        return;
      }
      onImportGenome({ ...createGenome(parsed.name, parsed.color || ACCENT_CYAN), ...parsed, id: createId(), updatedAt: new Date().toISOString() });
      setShowImport(false); setImportText(''); setImportError('');
    } catch { setImportError('Invalid JSON format'); }
  }, [onImportGenome]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (typeof ev.target?.result === 'string') importGenome(ev.target.result); };
    reader.readAsText(file);
    e.target.value = '';
  }, [importGenome]);

  return (
    <>
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <SectionHeader icon={Dna} label="Character Genomes" color={ACCENT} />
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={onAddGenome} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
              style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}10`, color: ACCENT }}><Plus className="w-3 h-3" /> New</button>
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
              style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}10`, color: ACCENT_CYAN }}><Upload className="w-3 h-3" /> Import</button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {genomes.map((g) => (
            <GenomePill key={g.id} genome={g} isActive={g.id === resolvedActiveId}
              onSelect={() => onSelectGenome(g.id)}
              onColorChange={(color) => onUpdateGenome(g.id, (prev) => ({ ...prev, color, updatedAt: new Date().toISOString() }))} />
          ))}
        </div>
      </BlueprintPanel>

      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <BlueprintPanel color={ACCENT_CYAN} className="p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <SectionLabel icon={Upload} label="Import Genome" color={ACCENT_CYAN} />
                  <button onClick={() => { setShowImport(false); setImportError(''); }} className="text-xs text-text-muted hover:text-text">Cancel</button>
                </div>
                <textarea value={importText} onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                  placeholder="Paste genome JSON here..."
                  className="w-full h-28 text-xs font-mono bg-surface-deep border border-border/40 rounded-lg p-2.5 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50 resize-none custom-scrollbar" />
                {importError && <p className="text-xs font-mono" style={{ color: STATUS_ERROR }}>{importError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => importGenome(importText)} className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors"
                    style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}15`, color: ACCENT_CYAN }}>Import from JSON</button>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border/40 text-text-muted hover:text-text transition-colors">Import from File</button>
                </div>
              </div>
            </BlueprintPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
