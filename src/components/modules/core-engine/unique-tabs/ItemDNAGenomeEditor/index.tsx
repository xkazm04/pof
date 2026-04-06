'use client';

import { useState, useMemo, useCallback } from 'react';
import { Dna, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_50, OPACITY_37, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { SubTabNavigation } from '@/components/modules/core-engine/unique-tabs/_shared';
import type { ItemGenome, TraitAxis, DNARollResult } from '@/types/item-genome';
import { rollAffixesWithDNA, inheritGenomes, evolveGenome } from '@/lib/item-dna/rolling-engine';
import {
  ACCENT, PRESET_GENOMES, DEMO_AFFIX_POOL, SUB_TABS,
  createGenome, genomeToRadar,
} from './data';
import { EditorTab } from './EditorTab';
import { RollerTab } from './RollerTab';
import { BreedingTab } from './BreedingTab';
import { EvolutionTab } from './EvolutionTab';
import { CodePreview } from './CodePreview';

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
      <BlueprintPanel color={ACCENT} className="p-3" noBrackets>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg relative overflow-hidden group">
              <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
              <Dna className="w-4 h-4 relative z-10" style={{ color: ACCENT, filter: `drop-shadow(0 0 4px ${withOpacity(ACCENT, OPACITY_50)})` }} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text tracking-wide">Item DNA Genome System</span>
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                <span className="font-medium" style={{ color: ACCENT }}>{genomes.length}</span>
                <span className="opacity-60"> genomes defined</span>
              </span>
            </div>
          </div>
          <button
            onClick={addGenome}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
          >
            <Plus className="w-3 h-3" /> New Genome
          </button>
        </div>
      </BlueprintPanel>

      {/* Genome selector */}
      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        {genomes.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedId(g.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              g.id === selectedId ? 'ring-1 text-white' : 'text-text-muted hover:text-text'
            }`}
            style={{
              backgroundColor: g.id === selectedId ? `${g.color}${OPACITY_20}` : undefined,
              border: g.id === selectedId ? `1px solid ${withOpacity(g.color, OPACITY_37)}` : '1px solid transparent',
              boxShadow: g.id === selectedId ? `0 0 0 1px ${withOpacity(g.color, OPACITY_25)}` : undefined,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
            {g.name}
            {g.evolution && g.evolution.tier > 0 && (
              <span className="text-xs font-mono" style={{ color: STATUS_SUCCESS }}>+{g.evolution.tier}</span>
            )}
          </button>
        ))}
      </div>

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
