'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Terminal, Cpu, Database, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { SectionHeader, BlueprintPanel } from '../_design';
import { SectionLabel, FeatureCard, PipelineFlow, LoadingSpinner, SubTabNavigation, type SubTab } from '../_shared';
import { SchemaTree } from './schema/SchemaTree';
import { MemoryBanks } from './schema/MemoryBanks';
import { FileSizeBreakdown } from './schema/FileSizeBreakdown';
import { BudgetAlerting } from './schema/BudgetAlerting';
import { SaveDiffSection } from './schema/SaveDiffViewer';
import { IntegrityValidator } from './slots/IntegrityValidator';
import { MigrationPathGraph } from './versions/MigrationPathGraph';
import { CloudSyncSection } from './advanced/CloudSyncStatus';
import { SlotManagement } from './slots/SlotManagement';
import { SerializationProfiler } from './advanced/SerializationProfiler';
import { AutoSaveConfigPanel } from './advanced/AutoSaveConfig';
import { VersionHistory } from './versions/VersionHistory';
import { DataRecoveryTool } from './advanced/DataRecoveryTool';
import { ACCENT, VERSIONS, FEATURE_NAMES } from './data';
import FeatureMapTab from '../FeatureMapTab';
import { VisibleSection } from '../VisibleSection';
import type { SubModuleId } from '@/types/modules';

import { withOpacity, OPACITY_90, OPACITY_25, OPACITY_12, OPACITY_5, GLOW_MD } from '@/lib/chart-colors';
interface SaveDataSchemaProps { moduleId: SubModuleId }

export function SaveDataSchema({ moduleId }: SaveDataSchemaProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['character', 'inventory']));
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('schema');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    { id: 'schema', label: 'Schema' },
    { id: 'slots', label: 'Slots' },
    { id: 'versions', label: 'Versions' },
    { id: 'advanced', label: 'Advanced' },
  ], []);

  const [cursorVisible, setCursorVisible] = useState(true);
  useSuspendableEffect(() => {
    const i = setInterval(() => setCursorVisible(v => !v), 500);
    return () => clearInterval(i);
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature(prev => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      {/* Terminal header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <BlueprintPanel color={ACCENT} className="p-2 grid place-items-center">
          <Terminal className="w-5 h-5" style={{ color: ACCENT }} />
        </BlueprintPanel>
        <div className="flex flex-col">
          <span className="text-base font-bold font-mono tracking-widest uppercase"
            style={{ color: `${withOpacity(ACCENT, OPACITY_90)}`, textShadow: `${GLOW_MD} ${withOpacity(ACCENT, OPACITY_25)}` }}>
            Save.Data_Schema <span style={{ color: ACCENT }}>{cursorVisible ? '_' : ' '}</span>
          </span>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-0.5">
            Protocol: UARPG_SYS_{stats.implemented}/{stats.total}
          </span>
        </div>
      </div>

      <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      {/* Pipeline */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label="Runtime Serialization Pipeline" icon={Cpu} color={ACCENT} />
        <PipelineFlow steps={['Gather State', 'Serialize', 'SaveGame Object', 'Deserialize', 'Restore State']} accent={ACCENT} />
      </BlueprintPanel>

      {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} />}

      {activeTab === 'schema' && (
        <VisibleSection moduleId={moduleId} sectionId="groups">
          {/* Schema tree + Memory banks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SchemaTree expandedGroups={expandedGroups} toggleGroup={toggleGroup} />
            <MemoryBanks />
          </div>

          <FileSizeBreakdown />
          <BudgetAlerting />
          <SaveDiffSection />

          {/* Features list */}
          <div className="space-y-1.5 pt-2">
            <SectionLabel label="Engine Subsystems" />
            {FEATURE_NAMES.map(name => (
              <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs}
                expanded={expandedFeature} onToggle={toggleFeature} accent={ACCENT} />
            ))}
          </div>
        </VisibleSection>
      )}

      {activeTab === 'slots' && (
        <VisibleSection moduleId={moduleId} sectionId="preview">
          <SlotManagement />
          <IntegrityValidator />
        </VisibleSection>
      )}

      {activeTab === 'versions' && (
        <VisibleSection moduleId={moduleId} sectionId="history">
          <VersionHistory />

          {/* Migration chain log */}
          <BlueprintPanel color={ACCENT} className="p-3 font-mono">
            <SectionHeader label="MIGRATION_HISTORY.log" icon={Database} color={ACCENT} />
            <div className="flex flex-wrap items-center gap-3">
              {VERSIONS.map((v, i, arr) => (
                <motion.div key={v.ver} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }} className="flex items-center gap-3">
                  <div className="flex flex-col border rounded-sm px-3 py-2 text-xs hover:border-border/60 transition-colors"
                    style={{ borderColor: `${withOpacity(ACCENT, OPACITY_12)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
                    <span className="font-bold" style={{ color: ACCENT }}>{v.ver}</span>
                    <span className="text-xs text-text-muted mt-1">{v.diff}</span>
                  </div>
                  {i < arr.length - 1 && <span className="text-text-muted text-sm">--&gt;</span>}
                </motion.div>
              ))}
            </div>
          </BlueprintPanel>

          <MigrationPathGraph />
        </VisibleSection>
      )}

      {activeTab === 'advanced' && (
        <VisibleSection moduleId={moduleId} sectionId="breakdown">
          <CloudSyncSection />
          <SerializationProfiler />
          <AutoSaveConfigPanel />
          <DataRecoveryTool />
        </VisibleSection>
      )}
    </div>
  );
}
