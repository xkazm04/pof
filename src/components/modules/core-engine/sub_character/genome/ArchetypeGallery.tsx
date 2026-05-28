'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, GitFork, X } from 'lucide-react';
import {
  withOpacity, OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_20,
  OPACITY_30, OPACITY_50,
  ACCENT_CYAN,
} from '@/lib/chart-colors';
import type { CharacterGenome } from '@/types/character-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { RadarChart } from '../../unique-tabs/_shared';
import {
  ARCHETYPE_TEMPLATES, type ArchetypeTemplate,
  forkTemplate, getAllTemplateTags,
} from '@/lib/genome/archetype-templates';
import { ACCENT, OVERVIEW_AXES } from './field-data';

const ALL_TAG = '__all__';

function templateToRadar(template: ArchetypeTemplate): RadarDataPoint[] {
  const g = template.blueprint as unknown as CharacterGenome;
  return OVERVIEW_AXES.map((axis) => ({
    axis: axis.label,
    value: Math.min(axis.getValue(g) / axis.max, 1),
  }));
}

/* ── Tag chip ───────────────────────────────────────────────────────────── */

function TagChip({ label, isActive, onClick, count }: {
  label: string; isActive: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="focus-ring px-2 py-0.5 rounded-md text-xs font-mono font-bold border transition-colors hover:brightness-110"
      style={{
        borderColor: isActive ? withOpacity(ACCENT, OPACITY_30) : withOpacity(ACCENT_CYAN, OPACITY_15),
        backgroundColor: isActive ? withOpacity(ACCENT, OPACITY_15) : 'transparent',
        color: isActive ? ACCENT : 'var(--text-muted)',
      }}
    >
      {label}{typeof count === 'number' && <span className="opacity-60 ml-1">{count}</span>}
    </button>
  );
}

/* ── Single card ────────────────────────────────────────────────────────── */

function ArchetypeCard({ template, onFork }: {
  template: ArchetypeTemplate;
  onFork: (t: ArchetypeTemplate) => void;
}) {
  const radarData = useMemo(() => templateToRadar(template), [template]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex flex-col gap-2 p-3 rounded-lg border bg-surface-deep/40 overflow-hidden"
      style={{ borderColor: withOpacity(template.color, OPACITY_20) }}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: template.color, boxShadow: `0 0 10px ${withOpacity(template.color, OPACITY_50)}` }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-bold" style={{ color: template.color }}>{template.name}</span>
          <span className="text-xs text-text-muted leading-snug mt-0.5">{template.feel}</span>
        </div>
      </div>

      <div className="flex items-center justify-center py-1">
        <RadarChart data={radarData} accent={template.color} size={140} showLabels />
      </div>

      <div className="flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border"
            style={{
              color: template.color,
              borderColor: withOpacity(template.color, OPACITY_15),
              backgroundColor: withOpacity(template.color, OPACITY_8),
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <button
        onClick={() => onFork(template)}
        className="focus-ring mt-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
        style={{
          color: template.color,
          borderColor: withOpacity(template.color, OPACITY_30),
          backgroundColor: withOpacity(template.color, OPACITY_10),
        }}
        aria-label={`Fork ${template.name} into your genome list`}
      >
        <GitFork className="w-3.5 h-3.5" />
        Fork to Edit
      </button>
    </motion.div>
  );
}

/* ── Gallery ────────────────────────────────────────────────────────────── */

export interface ArchetypeGalleryProps {
  onFork: (genome: CharacterGenome, template: ArchetypeTemplate) => void;
  onClose?: () => void;
}

export function ArchetypeGallery({ onFork, onClose }: ArchetypeGalleryProps) {
  const [activeTag, setActiveTag] = useState<string>(ALL_TAG);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of ARCHETYPE_TEMPLATES) for (const tag of t.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, []);

  const allTags = useMemo(() => getAllTemplateTags(), []);

  const visible = useMemo(() => {
    if (activeTag === ALL_TAG) return ARCHETYPE_TEMPLATES;
    return ARCHETYPE_TEMPLATES.filter((t) => t.tags.includes(activeTag));
  }, [activeTag]);

  const handleFork = (template: ArchetypeTemplate) => {
    onFork(forkTemplate(template), template);
  };

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <SectionHeader icon={LayoutGrid} label="Archetype Templates" color={ACCENT} />
        {onClose && (
          <button
            onClick={onClose}
            className="focus-ring ml-auto p-1 rounded-md border transition-colors hover:brightness-110"
            style={{ borderColor: withOpacity(ACCENT_CYAN, OPACITY_20), color: 'var(--text-muted)' }}
            aria-label="Close template gallery"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-text-muted mb-3">
        Curated play-style presets. Fork-to-Edit clones a template into your genome list and stamps a
        <code className="px-1 mx-0.5 rounded bg-surface text-text-muted/80 font-mono">based-on:</code>
        lineage tag so you can trace it.
      </p>

      <div role="group" aria-label="Filter templates by tag" className="flex flex-wrap items-center gap-1.5 mb-3">
        <TagChip
          label="All"
          count={ARCHETYPE_TEMPLATES.length}
          isActive={activeTag === ALL_TAG}
          onClick={() => setActiveTag(ALL_TAG)}
        />
        {allTags.map((tag) => (
          <TagChip
            key={tag}
            label={tag}
            count={tagCounts.get(tag)}
            isActive={activeTag === tag}
            onClick={() => setActiveTag(tag)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map((t) => (
          <ArchetypeCard key={t.id} template={t} onFork={handleFork} />
        ))}
        {visible.length === 0 && (
          <p className="col-span-full text-xs text-text-muted italic text-center py-6">
            No templates match this tag.
          </p>
        )}
      </div>

      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted/60 mt-3 text-right">
        {visible.length} of {ARCHETYPE_TEMPLATES.length} templates
      </p>
    </BlueprintPanel>
  );
}
