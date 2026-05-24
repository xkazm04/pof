'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SubTabNavigation } from '@/components/modules/core-engine/unique-tabs/_shared';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { ItemGenome, TraitAxis, DNARollResult } from '@/types/item-genome';
import { rollAffixesWithDNA, inheritGenomes, evolveGenome } from '@/lib/item-dna/rolling-engine';
import { sanitizeItemGenome } from '@/lib/item-dna/defaults';
import {
  ACCENT, PRESET_GENOMES, DEMO_AFFIX_POOL, SUB_TABS,
  createGenome, genomeToRadar,
} from './data';
import { ITEM_DIFF_SPECS } from './diff-fields';
import { EditorTab } from './EditorTab';
import { RollerTab } from './RollerTab';
import { BreedingTab } from './BreedingTab';
import { EvolutionTab } from './EvolutionTab';
import { CodePreview } from './CodePreview';
import { GenomeImportPanel } from '../../unique-tabs/_genome-share/GenomeImportPanel';
import { BuildCodeExportPanel } from '../../unique-tabs/_genome-share/BuildCodeExport';
import { GenomeEditorHeader } from './GenomeEditorHeader';
import { GenomeSelector } from './GenomeSelector';

/* ── Main Component ────────────────────────────────────────────────────── */

interface Props { moduleId: string }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ItemDNAGenomeEditor({ moduleId }: Props) {
  const [genomes, setGenomes] = useState<ItemGenome[]>(PRESET_GENOMES);
  const [selectedId, setSelectedId] = useState(PRESET_GENOMES[0].id);
  const [activeTab, setActiveTab] = useState('editor');
  const [rollRarity, setRollRarity] = useState('Rare');
  const [rollLevel, setRollLevel] = useState(10);
  const [rollResult, setRollResult] = useState<DNARollResult | null>(null);
  const [breedParentA, setBreedParentA] = useState<string | null>(null);
  const [breedParentB, setBreedParentB] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const selected = useMemo(
    () => genomes.find((g) => g.id === selectedId) ?? genomes[0],
    [genomes, selectedId],
  );

  const updateGenome = useCallback((id: string, updater: (g: ItemGenome) => ItemGenome) => {
    setGenomes((prev) => prev.map((g) => g.id === id ? updater(g) : g));
  }, []);

  const updateTrait = useCallback((axis: TraitAxis, weight: number) => {
    updateGenome(selected.id, (g) => ({
      ...g,
      traits: g.traits.map((t) => t.axis === axis ? { ...t, weight } : t),
      updatedAt: new Date().toISOString(),
    }));
  }, [selected.id, updateGenome]);

  const addGenome = useCallback(() => {
    const g = createGenome(`Custom ${genomes.length + 1}`, ACCENT, {});
    setGenomes((prev) => [...prev, g]);
    setSelectedId(g.id);
  }, [genomes.length]);

  const deleteGenome = useCallback((id: string) => {
    setGenomes((prev) => {
      const next = prev.filter((g) => g.id !== id);
      if (selectedId === id && next.length > 0) setSelectedId(next[0].id);
      return next;
    });
  }, [selectedId]);

  const applyImported = useCallback((g: ItemGenome) => {
    setGenomes((prev) => [...prev, g]);
    setSelectedId(g.id);
  }, []);

  const doRoll = useCallback(() => {
    const result = rollAffixesWithDNA(selected, rollRarity, rollLevel, DEMO_AFFIX_POOL);
    setRollResult(result);
  }, [selected, rollRarity, rollLevel]);

  const doBreed = useCallback(() => {
    if (!breedParentA || !breedParentB) return;
    const pA = genomes.find((g) => g.id === breedParentA);
    const pB = genomes.find((g) => g.id === breedParentB);
    if (!pA || !pB) return;
    const result = inheritGenomes(pA, pB);
    const child = createGenome(
      `${pA.name} x ${pB.name}`,
      result.dominantParent === 'A' ? pA.color : pB.color,
      { traits: result.traits, description: `Bred from ${pA.name} + ${pB.name}`, tags: ['bred'] },
    );
    setGenomes((prev) => [...prev, child]);
    setSelectedId(child.id);
  }, [breedParentA, breedParentB, genomes]);

  const doEvolve = useCallback(() => {
    const { evolved, tierChanged } = evolveGenome(selected, 50 + Math.floor(Math.random() * 100));
    updateGenome(selected.id, () => evolved);
    if (tierChanged) setRollResult(null);
  }, [selected, updateGenome]);

  const radarData = useMemo(() => genomeToRadar(selected), [selected]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 p-2"
    >
      {/* Header */}
      <GenomeEditorHeader
        genomesCount={genomes.length}
        onToggleExport={() => { setShowExport((v) => !v); setShowImport(false); }}
        onToggleImport={() => { setShowImport((v) => !v); setShowExport(false); }}
        onAdd={addGenome}
      />

      {/* Build code export / import */}
      <AnimatePresence>
        {showExport && (
          <BuildCodeExportPanel
            key="item-export"
            kind="item"
            genome={selected}
            color={ACCENT_VIOLET}
            onClose={() => setShowExport(false)}
          />
        )}
        {showImport && (
          <GenomeImportPanel<ItemGenome>
            key="item-import"
            kind="item"
            kindLabel="item"
            accent={ACCENT}
            baseline={selected}
            baselineName={selected.name}
            getName={(g) => g.name}
            sanitize={sanitizeItemGenome}
            diffSpecs={ITEM_DIFF_SPECS}
            onApply={applyImported}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>

      {/* Genome selector */}
      <GenomeSelector genomes={genomes} selectedId={selectedId} onSelect={setSelectedId} />

      {/* Sub-tabs */}
      <SubTabNavigation tabs={SUB_TABS} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      {activeTab === 'editor' && (
        <EditorTab
          selected={selected}
          radarData={radarData}
          genomeCount={genomes.length}
          updateGenome={updateGenome}
          updateTrait={updateTrait}
          deleteGenome={deleteGenome}
        />
      )}

      {activeTab === 'roller' && (
        <RollerTab
          selected={selected}
          rollRarity={rollRarity}
          setRollRarity={setRollRarity}
          rollLevel={rollLevel}
          setRollLevel={setRollLevel}
          rollResult={rollResult}
          doRoll={doRoll}
        />
      )}

      {activeTab === 'breeding' && (
        <BreedingTab
          genomes={genomes}
          breedParentA={breedParentA}
          breedParentB={breedParentB}
          setBreedParentA={setBreedParentA}
          setBreedParentB={setBreedParentB}
          doBreed={doBreed}
        />
      )}

      {activeTab === 'evolution' && (
        <EvolutionTab selected={selected} doEvolve={doEvolve} />
      )}

      {/* UE5 C++ Code Preview */}
      <CodePreview selected={selected} />
    </motion.div>
  );
}
