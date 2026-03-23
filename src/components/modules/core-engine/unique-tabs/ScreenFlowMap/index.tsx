'use client';

import { useMemo, useState, useCallback } from 'react';
import { Monitor, Network, Layers, Component, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_PINK, STATUS_WARNING } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, LoadingSpinner, SubTabNavigation } from '../_shared';
import type { SubTab } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import { FlowNodesTab } from './FlowNodesTab';
import { SystemsTab } from './SystemsTab';
import { UIBindingsTab } from './UIBindingsTab';
import { AccessibilityTab } from './AccessibilityTab';

const ACCENT = ACCENT_PINK;

interface ScreenFlowMapProps {
  moduleId: SubModuleId;
}

export function ScreenFlowMap({ moduleId }: ScreenFlowMapProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('flow');
  const [highlightedFlowNode, setHighlightedFlowNode] = useState<string | null>(null);

  const tabs: SubTab[] = useMemo(() => [
    { id: 'flow', label: 'Flow & Nodes', icon: Network },
    { id: 'systems', label: 'Systems & Constraints', icon: Layers },
    { id: 'ui', label: 'UI Bindings', icon: Component },
    { id: 'a11y', label: 'Accessibility', icon: Globe },
  ], []);

  const toggleNode = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  const toggleFlowNode = useCallback((id: string) => {
    setHighlightedFlowNode(prev => prev === id ? null : id);
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Monitor} title="Screen Flow Map" implemented={stats.implemented} total={stats.total} accent={ACCENT}>
          {stats.partial > 0 && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md border border-amber-500/20 shadow-sm">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_WARNING, boxShadow: `0 0 6px ${STATUS_WARNING}80` }} />
              {stats.partial} partial
            </motion.span>
          )}
        </TabHeader>
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'flow' && (
            <FlowNodesTab
              featureMap={featureMap}
              defs={defs}
              expandedNode={expandedNode}
              onToggleNode={toggleNode}
              highlightedFlowNode={highlightedFlowNode}
              onToggleFlowNode={toggleFlowNode}
            />
          )}
          {activeTab === 'systems' && <SystemsTab />}
          {activeTab === 'ui' && <UIBindingsTab />}
          {activeTab === 'a11y' && <AccessibilityTab />}
        </AnimatePresence>
      </div>
    </div>
  );
}
