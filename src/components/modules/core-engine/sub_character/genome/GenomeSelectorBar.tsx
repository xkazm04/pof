'use client';

import { useState, useMemo } from 'react';
import { Dna, Upload, Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ACCENT_CYAN,
  withOpacity, OPACITY_25, OPACITY_8,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import type { CharacterGenome } from '@/types/character-genome';
import { sanitizeGenome } from '@/lib/genome/defaults';
import { ACCENT } from './field-data';
import { CHARACTER_DIFF_SPECS } from './diff-fields';
import { GenomePill } from './GenomePill';
import { GenomeImportPanel } from '../../unique-tabs/_genome-share/GenomeImportPanel';

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

  const activeGenome = useMemo(
    () => genomes.find((g) => g.id === resolvedActiveId),
    [genomes, resolvedActiveId],
  );

  return (
    <>
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <SectionHeader icon={Dna} label="Character Genomes" color={ACCENT} />
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={onAddGenome} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
              style={{ borderColor: `${withOpacity(ACCENT, OPACITY_25)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}`, color: ACCENT }}><Plus className="w-3 h-3" /> New</button>
            <button onClick={() => setShowImport((v) => !v)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
              style={{ borderColor: `${withOpacity(ACCENT_CYAN, OPACITY_25)}`, backgroundColor: `${withOpacity(ACCENT_CYAN, OPACITY_8)}`, color: ACCENT_CYAN }}><Upload className="w-3 h-3" /> Import</button>
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
          <GenomeImportPanel<CharacterGenome>
            kind="character"
            kindLabel="character"
            accent={ACCENT_CYAN}
            baseline={activeGenome}
            baselineName={activeGenome?.name ?? '—'}
            getName={(g) => g.name}
            sanitize={sanitizeGenome}
            diffSpecs={CHARACTER_DIFF_SPECS}
            onApply={onImportGenome}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
