'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COLORS, STATUS_NEUTRAL, OPACITY_20, OPACITY_30, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from './_design';
import { SubTabNavigation } from './_shared';
import type { SubTab } from './_shared';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';
import { getTabGroups } from './feature-map-config';
import { sectionToggleModel, type SectionToggleEntry } from '@/components/modules/core-engine/unique-tabs/featureSectionModel';
import { FeatureCard } from '@/components/shared/FeatureCard';
import { FeatureCardGrid } from '@/components/shared/FeatureCardGrid';
import { LayoutGrid } from 'lucide-react';
import { hasInitPrompts } from '@/components/modules/core-engine/unique-tabs/feature-init-prompts';
import { useSectionScaffold } from '@/components/modules/core-engine/unique-tabs/useSectionScaffold';
import { ScaffoldChip, ScaffoldPanel } from '@/components/modules/core-engine/unique-tabs/ScaffoldPanel';

const ACCENT = MODULE_COLORS.core;

/* ── Main component ────────────────────────────────────────────────────────── */

export default function FeatureMapTab({ moduleId, renderMetric }: { moduleId: SubModuleId; renderMetric?: (sectionId: string) => ReactNode }) {
  const groups = useMemo(() => getTabGroups(moduleId), [moduleId]);
  const { isVisible, toggle, setMany, _raw: vis } = useFeatureVisibility(moduleId);
  // Only gated sections are toggles; sub-panels follow their parent, no-gate ones always show.
  const model = useMemo(() => sectionToggleModel(moduleId, vis), [moduleId, vis]);
  const entryById = useMemo(() => new Map(model.map((e) => [e.id as string, e])), [model]);
  const allIds = useMemo(() => model.filter((e) => e.toggleable).map((e) => e.id as string), [model]);
  // Project state per section: graded from the scanned UE headers; runs only on a click.
  const scaffold = useSectionScaffold(moduleId);
  const showScaffold = hasInitPrompts(moduleId);
  const cardBody = (id: string): ReactNode => {
    const view = showScaffold ? scaffold.stateOf(id) : null;
    const chip = view && view.state !== 'no-prompt'
      ? <ScaffoldChip view={view} running={scaffold.running === id} />
      : null;
    const metric = renderMetric?.(id);
    return chip || metric ? <>{chip}{metric}</> : undefined;
  };

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
    () => activeGroup?.sections.filter((s) => s.gated).map((s) => s.id as string) ?? [],
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
            {grpIds.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MiniBtn label="All On" onClick={handleGroupOn} />
                <MiniBtn label="All Off" onClick={handleGroupOff} muted />
              </div>
            )}
          </div>

          <FeatureCardGrid label={`${activeGroup.tabLabel} features`}>
            {activeGroup.sections.map((sec) => {
              const entry = entryById.get(sec.id);
              if (entry && !entry.toggleable) {
                return (
                  <SectionInfoCard key={sec.id} entry={entry} parentLabel={entry.parentId ? entryById.get(entry.parentId)?.label : undefined}>
                    {cardBody(sec.id)}
                  </SectionInfoCard>
                );
              }
              return (
                <FeatureCard
                  key={sec.id}
                  name={sec.label}
                  active={isVisible(sec.id)}
                  onToggle={() => toggle(sec.id)}
                  accent={ACCENT}
                  summary={sec.summary}
                >
                  {cardBody(sec.id)}
                </FeatureCard>
              );
            })}
          </FeatureCardGrid>
          {showScaffold && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <ScaffoldPanel scaffold={scaffold} sections={activeGroup.sections} />
            </div>
          )}
        </BlueprintPanel>
      )}
    </div>
  );
}

/* ── Non-toggle section card ───────────────────────────────────────────────── */

/**
 * A section no gate of its own hides: a sub-panel reads "in <Parent>" and follows the
 * parent's toggle; a no-gate section reads "always shown". Not a button, so it offers
 * no toggle that would do nothing.
 */
function SectionInfoCard({ entry, parentLabel, children }: { entry: SectionToggleEntry; parentLabel?: string; children?: ReactNode }) {
  const on = entry.effectiveVisible;
  const note = entry.parentId ? `in ${parentLabel ?? entry.parentId}` : 'always shown';
  return (
    <div
      data-section-card={entry.id}
      data-effective-visible={String(on)}
      title={entry.parentId ? `Shown and hidden with ${parentLabel ?? entry.parentId}` : 'No toggle: this section is always shown'}
      className="relative rounded-lg border border-dashed p-3"
      style={{ borderColor: withOpacity(on ? ACCENT : STATUS_NEUTRAL, OPACITY_30) }}
    >
      <span className="block text-xs font-mono font-bold truncate text-text-muted" title={entry.label}>{entry.label}</span>
      <span className="block text-xs font-mono truncate leading-tight mt-0.5" style={{ color: on ? ACCENT : STATUS_NEUTRAL }}>
        {note}
      </span>
      {children && <div className="mt-2" style={{ filter: on ? 'none' : 'saturate(0.3)' }}>{children}</div>}
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
