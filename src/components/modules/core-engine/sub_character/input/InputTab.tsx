'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Layers } from 'lucide-react';
import {
  ACCENT_VIOLET, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_30, withOpacity,
} from '@/lib/chart-colors';
import { VisibleSection } from '../../unique-tabs/VisibleSection';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import {
  ABILITY_CATEGORIES, CHARACTER_ABILITIES,
  type AbilitySortKey, type AbilitySortDir,
} from '../_shared/data';
import { AbilityCategoryGroup } from './AbilityCategoryGroup';
import { InputBindingsTable } from './InputBindingsTable';
import { KeyboardVisualization } from './KeyboardVisualization';
import { AbilityQuickPicker } from './AbilityQuickPicker';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

interface Props {
  moduleId: SubModuleId;
  featureMap: Map<string, FeatureRow>;
}

const SORT_KEYS: ReadonlyArray<{ key: AbilitySortKey; label: string }> = [
  { key: 'tier',   label: 'Tier' },
  { key: 'damage', label: 'Damage' },
  { key: 'name',   label: 'Name' },
];

export function InputTab({ moduleId, featureMap }: Props) {
  const [sortKey, setSortKey] = useState<AbilitySortKey>('tier');
  const [sortDir, setSortDir] = useState<AbilitySortDir>('asc');

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof CHARACTER_ABILITIES>();
    for (const cat of ABILITY_CATEGORIES) map.set(cat.key, []);
    for (const a of CHARACTER_ABILITIES) map.get(a.category)!.push(a);
    return map;
  }, []);

  return (
    <VisibleSection moduleId={moduleId} sectionId="bindings">
      <div className="space-y-5">
        {/* ── Categorized abilities (Phase 2 F3) ─────────────────────── */}
        <BlueprintPanel className="p-4" color={ACCENT_VIOLET}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <SectionHeader icon={Layers} label="Abilities by Category" color={ACCENT_VIOLET} />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted mr-1">Sort</span>
              {SORT_KEYS.map((s) => {
                const active = sortKey === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSortKey(s.key)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer"
                    style={{
                      color: active ? ACCENT_VIOLET : 'var(--text-muted)',
                      borderColor: active ? withOpacity(ACCENT_VIOLET, OPACITY_30) : withOpacity(ACCENT_VIOLET, OPACITY_12),
                      backgroundColor: active ? withOpacity(ACCENT_VIOLET, OPACITY_12) : 'transparent',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
              <button
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label={`Sort direction: ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
                className="ml-1 p-1 rounded border cursor-pointer transition-colors"
                style={{
                  color: ACCENT_VIOLET,
                  borderColor: withOpacity(ACCENT_VIOLET, OPACITY_20),
                  backgroundColor: withOpacity(ACCENT_VIOLET, OPACITY_8),
                }}
              >
                {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
            {ABILITY_CATEGORIES.map((cat) => (
              <AbilityCategoryGroup
                key={cat.key}
                category={cat.key}
                abilities={byCategory.get(cat.key) ?? []}
                sortKey={sortKey}
                sortDir={sortDir}
              />
            ))}
          </div>
        </BlueprintPanel>

        {/* ── Existing key bindings + keyboard ───────────────────────── */}
        <InputBindingsTable featureMap={featureMap} />
        <KeyboardVisualization />
        <AbilityQuickPicker />
      </div>
    </VisibleSection>
  );
}
