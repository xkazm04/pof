'use client';

import { useState } from 'react';
import { User, Swords, Plus, Check, Sparkles } from 'lucide-react';
import { useGenomeStore } from '@/stores/genomeStore';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';
import type { SubGenreId } from '@/types/telemetry';
import type { TraitAxis } from '@/types/item-genome';
import {
  getGenreTemplateSet, instantiateCharacterTemplate, instantiateItemTemplate,
  dominantAxis, type ItemArchetypeTemplate,
} from '@/lib/genome/genre-genome-templates';
import type { ArchetypeTemplate } from '@/lib/genome/archetype-templates';

const AXIS_LABEL: Record<TraitAxis, string> = {
  offensive: 'Offensive',
  defensive: 'Defensive',
  utility: 'Utility',
  economic: 'Economic',
};

interface GenreTemplateGalleryProps {
  subGenre: SubGenreId;
  /** Accent color of the host sub-genre (drives card highlights). */
  accentColor: string;
}

/**
 * One-click genome starting points for a detected sub-genre. Imports a curated
 * character archetype into the character genome store and a high-coherence
 * weapon genome into the item genome store — turning an "Evolve toward X"
 * recommendation into instant momentum.
 */
export function GenreTemplateGallery({ subGenre, accentColor }: GenreTemplateGalleryProps) {
  const importCharacter = useGenomeStore((s) => s.importGenome);
  const importItem = useItemGenomeStore((s) => s.importGenome);
  const [imported, setImported] = useState<Set<string>>(() => new Set());

  const set = getGenreTemplateSet(subGenre);
  if (!set || (set.characters.length === 0 && set.items.length === 0)) return null;

  const markImported = (id: string) =>
    setImported((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const handleCharacter = (t: ArchetypeTemplate) => {
    importCharacter(instantiateCharacterTemplate(t));
    markImported(t.id);
  };

  const handleItem = (t: ItemArchetypeTemplate) => {
    importItem(instantiateItemTemplate(t));
    markImported(t.id);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-2.5 h-2.5" style={{ color: accentColor }} />
        <span className="text-2xs text-text-muted font-semibold uppercase tracking-wider">
          Genome Templates
        </span>
      </div>
      <p className="text-2xs text-text-muted mb-2 leading-relaxed">
        Pre-tuned starting points for this direction — one click drops them into your genome editors.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {set.characters.map((t) => (
          <TemplateCard
            key={t.id}
            kind="character"
            color={t.color}
            name={t.name}
            feel={t.feel}
            chips={characterChips(t)}
            isImported={imported.has(t.id)}
            onImport={() => handleCharacter(t)}
            importLabel={`Import ${t.name} character archetype into the genome editor`}
          />
        ))}
        {set.items.map((t) => (
          <TemplateCard
            key={t.id}
            kind="item"
            color={t.color}
            name={t.name}
            feel={t.feel}
            chips={itemChips(t)}
            isImported={imported.has(t.id)}
            onImport={() => handleItem(t)}
            importLabel={`Import ${t.name} weapon genome into the item DNA editor`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Single template card ──────────────────────────────────────────────────── */

function TemplateCard({
  kind, color, name, feel, chips, isImported, onImport, importLabel,
}: {
  kind: 'character' | 'item';
  color: string;
  name: string;
  feel: string;
  chips: string[];
  isImported: boolean;
  onImport: () => void;
  importLabel: string;
}) {
  const KindIcon = kind === 'character' ? User : Swords;
  return (
    <div
      className="flex flex-col gap-2 p-2.5 rounded-lg bg-surface border"
      style={{ borderColor: `${color}25` }}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}12`, border: `1px solid ${color}25` }}
        >
          <KindIcon className="w-3 h-3" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-text block truncate">{name}</span>
          <span className="text-2xs text-text-muted uppercase tracking-wider">
            {kind === 'character' ? 'Character archetype' : 'Weapon genome'}
          </span>
        </div>
      </div>

      <p className="text-2xs text-text-muted-hover leading-relaxed line-clamp-3">{feel}</p>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${color}10`, color }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onImport}
        aria-label={importLabel}
        className="mt-auto flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-2xs font-medium transition-all hover:brightness-110"
        style={{
          backgroundColor: isImported ? 'var(--surface-deep)' : `${color}15`,
          color: isImported ? 'var(--text-muted)' : color,
          border: `1px solid ${isImported ? 'var(--border)' : `${color}30`}`,
        }}
      >
        {isImported ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        {isImported ? 'Added — import again' : 'Import'}
      </button>
    </div>
  );
}

/* ── Chip builders ─────────────────────────────────────────────────────────── */

function characterChips(t: ArchetypeTemplate): string[] {
  const { combat, attributes, dodge } = t.blueprint;
  return [
    `${attributes.baseHP} HP`,
    `${combat.attackSpeed}× atk`,
    `${attributes.baseStamina} stam`,
    `${dodge.iFrameDuration}s i-frames`,
  ];
}

function itemChips(t: ItemArchetypeTemplate): string[] {
  const dom = dominantAxis(t.blueprint.traits);
  return [
    `${t.blueprint.itemType} · ${t.blueprint.minRarity}`,
    `${AXIS_LABEL[dom.axis]} ${Math.round(dom.weight * 100)}%`,
    `${Math.round(t.blueprint.mutation.mutationRate * 100)}% mutate`,
  ];
}
