'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Library, Sparkles, Copy, Trash2, GitMerge, Lock, RotateCcw } from 'lucide-react';
import {
  ACCENT_PINK, STATUS_SUCCESS, STATUS_WARNING,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_37,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import type { ItemGenome } from '@/types/item-genome';
import { ACCENT } from './data';

interface LibraryTabProps {
  genomes: ItemGenome[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onResetPresets: () => void;
}

/* ── Library / Gallery + Lineage View ──────────────────────────────────── */

export function LibraryTab({
  genomes, selectedId, onSelect, onDuplicate, onDelete, onResetPresets,
}: LibraryTabProps) {
  const presets = useMemo(() => genomes.filter((g) => g.isPreset), [genomes]);
  const custom = useMemo(
    () => genomes.filter((g) => !g.isPreset && (!g.parents || g.parents.length === 0)),
    [genomes],
  );
  const bred = useMemo(
    () => genomes.filter((g) => g.parents && g.parents.length > 0),
    [genomes],
  );

  return (
    <div className="space-y-3">
      <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader icon={Library} label="Saved Genome Library" color={ACCENT} />
          <button
            onClick={onResetPresets}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: withOpacity(STATUS_WARNING, OPACITY_10),
              color: STATUS_WARNING,
              border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_20)}`,
            }}
          >
            <RotateCcw className="w-3 h-3" /> Reset to Presets
          </button>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Every genome you create, breed, or evolve is persisted locally. Presets are sticky and
          cannot be deleted &mdash; duplicate them to make a custom copy.
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <Stat label="Presets" value={presets.length} color={STATUS_SUCCESS} />
          <Stat label="Custom" value={custom.length} color={ACCENT} />
          <Stat label="Bred" value={bred.length} color={ACCENT_PINK} />
        </div>
      </BlueprintPanel>

      <Section title="Presets" icon={Sparkles} color={STATUS_SUCCESS}>
        <GenomeGrid
          genomes={presets}
          selectedId={selectedId}
          onSelect={onSelect}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </Section>

      <Section title="Custom Genomes" icon={Library} color={ACCENT}>
        {custom.length === 0 ? (
          <EmptyHint text="Click New Genome in the header to author your first custom item." />
        ) : (
          <GenomeGrid
            genomes={custom}
            selectedId={selectedId}
            onSelect={onSelect}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        )}
      </Section>

      <Section title="Bred Lineage" icon={GitMerge} color={ACCENT_PINK}>
        {bred.length === 0 ? (
          <EmptyHint text="Use the Breeding Lab to combine two parents into a new offspring." />
        ) : (
          <div className="space-y-2">
            {bred.map((g) => (
              <LineageRow
                key={g.id}
                genome={g}
                selected={g.id === selectedId}
                onSelect={() => onSelect(g.id)}
                onDuplicate={() => onDuplicate(g.id)}
                onDelete={() => onDelete(g.id)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-baseline gap-1.5 px-2 py-1.5 rounded-md"
      style={{ backgroundColor: withOpacity(color, OPACITY_10), border: `1px solid ${withOpacity(color, OPACITY_20)}` }}
    >
      <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="uppercase tracking-[0.15em] text-text-muted">{label}</span>
    </div>
  );
}

function Section({
  title, icon, color, children,
}: { title: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; children: React.ReactNode }) {
  return (
    <BlueprintPanel color={color} className="p-3 space-y-2.5">
      <SectionHeader icon={icon} label={title} color={color} />
      {children}
    </BlueprintPanel>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-xs text-text-muted italic px-2 py-3 text-center bg-surface-deep/30 rounded-md">
      {text}
    </div>
  );
}

function GenomeGrid({
  genomes, selectedId, onSelect, onDuplicate, onDelete,
}: {
  genomes: ItemGenome[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {genomes.map((g) => (
        <GenomeCard
          key={g.id}
          genome={g}
          selected={g.id === selectedId}
          onSelect={() => onSelect(g.id)}
          onDuplicate={() => onDuplicate(g.id)}
          onDelete={() => onDelete(g.id)}
        />
      ))}
    </div>
  );
}

function GenomeCard({
  genome, selected, onSelect, onDuplicate, onDelete,
}: {
  genome: ItemGenome;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const tier = genome.evolution?.tier ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-md p-2 border transition-colors"
      style={{
        backgroundColor: selected ? withOpacity(genome.color, OPACITY_10) : 'transparent',
        borderColor: selected
          ? withOpacity(genome.color, OPACITY_37)
          : withOpacity(genome.color, OPACITY_20),
      }}
    >
      <button onClick={onSelect} className="w-full text-left space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: genome.color }} />
          <span className="text-xs font-bold text-text truncate flex-1">{genome.name}</span>
          {genome.isPreset && (
            <Lock className="w-3 h-3 text-text-muted/60" aria-label="Preset" />
          )}
          {tier > 0 && (
            <span className="text-xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>+{tier}</span>
          )}
        </div>
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted flex items-center gap-2">
          <span>{genome.itemType}</span>
          <span className="opacity-50">&middot;</span>
          <span>{genome.minRarity}</span>
        </div>
        {genome.description && (
          <p className="text-xs text-text-muted line-clamp-2 leading-snug">{genome.description}</p>
        )}
      </button>
      <div className="flex items-center gap-1 mt-1.5 justify-end">
        <IconButton
          icon={Copy}
          label="Duplicate"
          color={genome.color}
          onClick={onDuplicate}
        />
        {!genome.isPreset && (
          <IconButton
            icon={Trash2}
            label="Delete"
            color={STATUS_WARNING}
            onClick={onDelete}
          />
        )}
      </div>
    </motion.div>
  );
}

function IconButton({
  icon: Icon, label, color, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="p-1 rounded-md transition-colors hover:bg-surface/60"
      style={{ color }}
    >
      <Icon className="w-3 h-3" />
    </button>
  );
}

function LineageRow({
  genome, selected, onSelect, onDuplicate, onDelete,
}: {
  genome: ItemGenome;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const parents = genome.parents ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md border"
      style={{
        backgroundColor: selected ? withOpacity(genome.color, OPACITY_10) : 'transparent',
        borderColor: selected
          ? withOpacity(genome.color, OPACITY_37)
          : withOpacity(ACCENT_PINK, OPACITY_20),
      }}
    >
      <div className="flex items-center gap-1.5 min-w-[180px]">
        {parents.map((p, i) => (
          <span key={`${p.id}-${i}`} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-xs font-mono truncate max-w-[80px]" title={p.name} style={{ color: p.color }}>
              {p.name}
            </span>
            {i < parents.length - 1 && <span className="text-text-muted/50 text-xs">+</span>}
          </span>
        ))}
      </div>
      <span className="text-text-muted text-xs">&rarr;</span>
      <button onClick={onSelect} className="flex items-center gap-1.5 flex-1 text-left min-w-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: genome.color }} />
        <span className="text-xs font-bold text-text truncate">{genome.name}</span>
        {genome.evolution && genome.evolution.tier > 0 && (
          <span className="text-xs font-mono" style={{ color: STATUS_SUCCESS }}>+{genome.evolution.tier}</span>
        )}
      </button>
      <IconButton icon={Copy} label="Duplicate" color={genome.color} onClick={onDuplicate} />
      <IconButton icon={Trash2} label="Delete" color={STATUS_WARNING} onClick={onDelete} />
    </motion.div>
  );
}

