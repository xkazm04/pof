'use client';

import { useState } from 'react';
import { Tags } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCENT_PURPLE_BOLD, ACCENT_RED, ACCENT_ORANGE, ACCENT_CYAN, STATUS_SUBDUED,
} from '@/lib/chart-colors';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING, DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { useDzinSelection } from '@/lib/dzin/selection-context';
import { ENTITY_RELATIONS, isRelatedToSelection } from '@/lib/dzin/entity-relations';
import {
  FeatureCard,
  statusInfo,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow } from '@/types/feature-matrix';

/* -- Props ----------------------------------------------------------------- */

export interface TagsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* -- Constants ------------------------------------------------------------- */

interface TagNode {
  name: string;
  children?: TagNode[];
}

const TAG_TREE: TagNode[] = [
  {
    name: 'Ability', children: [
      { name: 'Ability.MeleeAttack' },
      { name: 'Ability.Dodge' },
      { name: 'Ability.Spell' },
    ],
  },
  {
    name: 'State', children: [
      { name: 'State.Dead' },
      { name: 'State.Invulnerable' },
      { name: 'State.Stunned' },
    ],
  },
  {
    name: 'Damage', children: [
      { name: 'Damage.Physical' },
      { name: 'Damage.Magical' },
      { name: 'Damage.Fire' },
    ],
  },
  {
    name: 'Input', children: [
      { name: 'Input.Attack' },
      { name: 'Input.Dodge' },
      { name: 'Input.Interact' },
    ],
  },
];

const TAG_CATEGORY_COLORS: Record<string, string> = {
  Ability: ACCENT_PURPLE_BOLD,
  State: ACCENT_RED,
  Damage: ACCENT_ORANGE,
  Input: ACCENT_CYAN,
};

/* -- Helpers --------------------------------------------------------------- */

function countAllTags(nodes: TagNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children) count += countAllTags(node.children);
  }
  return count;
}

const TOTAL_TAG_COUNT = countAllTags(TAG_TREE);

/* -- Micro density --------------------------------------------------------- */

function TagsMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Tags className="w-5 h-5 text-amber-400" />
      <span className="font-mono text-xs text-text">{TOTAL_TAG_COUNT}</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function TagsCompact({ featureMap }: TagsPanelProps) {
  const tagStatus = featureMap.get('Gameplay Tags hierarchy')?.status;
  const { color: dotColor, label: dotLabel } = statusInfo(tagStatus);
  const { selection, setSelection } = useDzinSelection();

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 0 3px ${dotColor}33` }}
          title={dotLabel}
        />
        <span className="font-medium text-text">Tag Hierarchy</span>
      </div>
      {TAG_TREE.map((cat) =>
        cat.children?.map((child) => {
          const isRelated = isRelatedToSelection('tag', child.name, selection, ENTITY_RELATIONS);
          const isSelected = selection?.type === 'tag' && selection.id === child.name;
          return (
            <motion.div
              key={child.name}
              className={`flex items-center gap-2 cursor-pointer ${isSelected ? 'ring-1 ring-blue-500/50 rounded' : ''}`}
              animate={{ opacity: selection && !isRelated ? 0.4 : 1 }}
              transition={{ duration: DZIN_TIMING.HIGHLIGHT }}
              onClick={() => setSelection({ type: 'tag', id: child.name })}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: TAG_CATEGORY_COLORS[cat.name] ?? STATUS_SUBDUED }}
              />
              <span className="text-text-muted">{child.name}</span>
            </motion.div>
          );
        })
      )}
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function TagsFull({ featureMap, defs }: TagsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <FeatureCard
        name="Gameplay Tags hierarchy"
        featureMap={featureMap}
        defs={defs}
        expanded={expanded}
        onToggle={onToggle}
        accent="#f59e0b"
      />

      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className={`text-xs font-bold uppercase text-text-muted ${DZIN_SPACING.full.sectionMb} flex items-center gap-2`}>
          <Tags className="w-4 h-4 text-amber-400" /> Tag Hierarchy
        </div>

        <div className="space-y-2">
          {TAG_TREE.map((category, ci) => {
            const catColor = TAG_CATEGORY_COLORS[category.name] ?? STATUS_SUBDUED;
            return (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: ci * 0.08 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: catColor, boxShadow: `0 0 0 3px ${catColor}33` }}
                    title={category.name}
                  />
                  <span className="text-xs font-bold text-text" style={{ color: catColor }}>
                    {category.name}
                  </span>
                  <span className="text-2xs font-mono text-text-muted">
                    ({category.children?.length ?? 0})
                  </span>
                </div>
                {category.children && (
                  <div className="ml-4 space-y-0.5 border-l border-border/40 pl-3">
                    {category.children.map((child, i) => (
                      <motion.div
                        key={child.name}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: ci * 0.08 + i * 0.03 }}
                        className="flex items-center gap-2 text-xs text-text-muted py-0.5"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: catColor, opacity: 0.6 }}
                        />
                        <span className="font-mono">{child.name}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* -- Main TagsPanel -------------------------------------------------------- */

export function TagsPanel({ featureMap, defs }: TagsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Tags" icon={<Tags className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <TagsMicro />}
          {density === 'compact' && <TagsCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <TagsFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
