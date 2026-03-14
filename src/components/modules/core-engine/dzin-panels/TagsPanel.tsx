'use client';

import { useState } from 'react';
import { Tags } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import {
  FeatureCard,
  STATUS_COLORS,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

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
  Ability: '#a855f7',
  State: '#ef4444',
  Damage: '#f97316',
  Input: '#06b6d4',
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

function statusDotColor(status: FeatureStatus | undefined): string {
  if (!status) return STATUS_COLORS.unknown.dot;
  return STATUS_COLORS[status].dot;
}

/* -- Micro density --------------------------------------------------------- */

function TagsMicro() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <Tags className="w-5 h-5 text-amber-400" />
      <span className="font-mono text-xs text-text">{TOTAL_TAG_COUNT}</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function TagsCompact({ featureMap }: TagsPanelProps) {
  const tagStatus = featureMap.get('Gameplay Tags hierarchy')?.status;
  const dotColor = statusDotColor(tagStatus);

  return (
    <div className="space-y-1.5 p-2 text-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span className="font-medium text-text">Tag Hierarchy</span>
      </div>
      {TAG_TREE.map((cat) => (
        <div key={cat.name} className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: TAG_CATEGORY_COLORS[cat.name] ?? '#64748b' }}
          />
          <span className="text-text-muted">{cat.name}</span>
          <span className="ml-auto font-mono text-text-muted">({cat.children?.length ?? 0})</span>
        </div>
      ))}
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function TagsFull({ featureMap, defs }: TagsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className="space-y-2.5">
      <FeatureCard
        name="Gameplay Tags hierarchy"
        featureMap={featureMap}
        defs={defs}
        expanded={expanded}
        onToggle={onToggle}
        accent="#f59e0b"
      />

      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
          <Tags className="w-4 h-4 text-amber-400" /> Tag Hierarchy
        </div>

        <div className="space-y-2">
          {TAG_TREE.map((category, ci) => {
            const catColor = TAG_CATEGORY_COLORS[category.name] ?? '#64748b';
            return (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: ci * 0.08 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: catColor }}
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
                          className="w-1 h-1 rounded-full flex-shrink-0"
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
      {density === 'micro' && <TagsMicro />}
      {density === 'compact' && <TagsCompact featureMap={featureMap} defs={defs} />}
      {density === 'full' && <TagsFull featureMap={featureMap} defs={defs} />}
    </PanelFrame>
  );
}
