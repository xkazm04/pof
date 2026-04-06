'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COLORS, STATUS_NEUTRAL, OPACITY_20, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from './_design';
import { SubTabNavigation } from './_shared';
import type { SubTab } from './_shared';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';
import { getTabGroups, getAllSectionIds } from './feature-map-config';
import { FeatureCard } from '@/components/shared/FeatureCard';
import { FeatureCardGrid } from '@/components/shared/FeatureCardGrid';
import { LayoutGrid } from 'lucide-react';

const ACCENT = MODULE_COLORS.core;

/* ── Main component ────────────────────────────────────────────────────────── */

export default function FeatureMapTab({ moduleId, renderMetric }: { moduleId: SubModuleId; renderMetric?: (sectionId: string) => ReactNode }) {
  const groups = useMemo(() => getTabGroups(moduleId), [moduleId]);
  const allIds = useMemo(() => getAllSectionIds(moduleId), [moduleId]);
  const { isVisible, toggle, setMany } = useFeatureVisibility(moduleId);

  const [activeColumn, setActiveColumn] = useState(() => groups[0]?.tabId ?? '');

  const tabs: SubTab[] = useMemo(
    () => groups.map((g) => ({ id: g.tabId, label: g.tabLabel })),
    [groups],
  );

  const activeGroup = useMemo(
    () => groups.find((g) => g.tabId === activeColumn),
    [groups, activeColumn],
  );

  const totalActive = useMemo(
    () => allIds.filter((id) => isVisible(id)).length,
    [allIds, isVisible],
  );

  const progressPct = allIds.length > 0 ? (totalActive / allIds.length) * 100 : 0;

  const handleEnableAll = useCallback(() => setMany(allIds, true), [allIds, setMany]);
  const handleDisableAll = useCallback(() => setMany(allIds, false), [allIds, setMany]);

  const grpIds = useMemo(
    () => activeGroup?.sections.map((s) => s.id) ?? [],
    [activeGroup],
  );

  const handleGroupOn = useCallback(() => setMany(grpIds, true), [grpIds, setMany]);
  const handleGroupOff = useCallback(() => setMany(grpIds, false), [grpIds, setMany]);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-text-muted">
        No feature map configured for this module.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Global controls + NeonBar progress ─────────────────────────── */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              Feature Map
            </span>
            <span
              className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded"
              style={{ backgroundColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}
            >
              {totalActive}/{allIds.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            <MiniBtn label="Enable All" onClick={handleEnableAll} />
            <MiniBtn label="Disable All" onClick={handleDisableAll} muted />
          </div>
        </div>
        <NeonBar pct={progressPct} color={ACCENT} glow />
      </BlueprintPanel>

      {/* ── Tab navigation ──────────────────────────────────────────────── */}
      <SubTabNavigation tabs={tabs} activeTabId={activeColumn} onChange={setActiveColumn} accent={ACCENT} />

      {/* ── Card grid for active tab group ──────────────────────────────── */}
      {activeGroup && (
        <BlueprintPanel color={ACCENT} className="p-3">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader label={activeGroup.tabLabel} color={ACCENT} />
            <div className="flex items-center gap-1.5">
              <MiniBtn label="All On" onClick={handleGroupOn} />
              <MiniBtn label="All Off" onClick={handleGroupOff} muted />
            </div>
          </div>

          <FeatureCardGrid label={`${activeGroup.tabLabel} features`}>
            {activeGroup.sections.map((sec) => (
              <FeatureCard
                key={sec.id}
                name={sec.label}
                active={isVisible(sec.id)}
                onToggle={() => toggle(sec.id)}
                accent={ACCENT}
                summary={sec.summary}
              >
                {renderMetric?.(sec.id)}
              </FeatureCard>
            ))}
          </FeatureCardGrid>
        </BlueprintPanel>
      )}
    </div>
  );
}

/* ── Tiny action button ────────────────────────────────────────────────────── */

function MiniBtn({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors hover:brightness-125"
      style={{
        backgroundColor: withOpacity(muted ? STATUS_NEUTRAL : ACCENT, OPACITY_20),
        color: muted ? STATUS_NEUTRAL : ACCENT,
      }}
    >
      {label}
    </button>
  );
}
