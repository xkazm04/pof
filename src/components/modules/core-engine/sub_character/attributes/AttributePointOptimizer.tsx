'use client';

import { useMemo, useState, useCallback } from 'react';
import { Target, TrendingUp } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { OPACITY_10, OPACITY_20, withOpacity } from '@/lib/chart-colors';
import { SubTabNavigation } from '../../unique-tabs/_shared';
import type { SubTab } from '../../unique-tabs/_shared';
import type { SubModuleId } from '@/types/modules';
import {
  UE5, OPT_PRESETS, ACCENT,
  calcStats, objectiveScore, optimize,
  type Allocation, type OptTarget, type OptWeights,
} from './data';
import { UniqueTabHeader } from './design';
import { OptimizerTab } from './OptimizerTab';
import { ComparisonTab } from './ComparisonTab';

/* ── Attribute Point Optimizer ────────────────────────────────────────────── */

interface AttributePointOptimizerProps {
  moduleId: SubModuleId;
}

export function AttributePointOptimizer({ moduleId: _moduleId }: AttributePointOptimizerProps) {
  const [activeTab, setActiveTab] = useState('optimizer');
  const [target, setTarget] = useState<OptTarget>('max-dps');
  const [level, setLevel] = useState<number>(UE5.maxLevel);
  const [customWeights, setCustomWeights] = useState<OptWeights>({ dps: 0.4, ehp: 0.3, mana: 0.3 });

  const [currentAlloc, setCurrentAlloc] = useState<Allocation>({ str: 49, dex: 49, int: 49 });

  const totalAvailable = useMemo(() => Math.max(0, level - 1) * UE5.attributePointsPerLevel, [level]);
  const currentUsed = currentAlloc.str + currentAlloc.dex + currentAlloc.int;
  const remaining = totalAvailable - currentUsed;

  const tabs: SubTab[] = useMemo(() => [
    { id: 'optimizer', label: 'Optimizer', icon: Target },
    { id: 'comparison', label: 'Comparison', icon: TrendingUp },
  ], []);

  const activeWeights = useMemo(() => {
    if (target === 'custom') return customWeights;
    return OPT_PRESETS.find(p => p.id === target)!.weights;
  }, [target, customWeights]);

  const optimalAlloc = useMemo(() => optimize(totalAvailable, level, activeWeights), [totalAvailable, level, activeWeights]);
  const currentStats = useMemo(() => calcStats(currentAlloc, level), [currentAlloc, level]);
  const optimalStats = useMemo(() => calcStats(optimalAlloc, level), [optimalAlloc, level]);

  const updateAlloc = useCallback((attr: keyof Allocation, value: number) => {
    setCurrentAlloc(prev => {
      const otherSum = (attr === 'str' ? 0 : prev.str) + (attr === 'dex' ? 0 : prev.dex) + (attr === 'int' ? 0 : prev.int);
      const clamped = Math.min(value, totalAvailable - otherSum);
      return { ...prev, [attr]: Math.max(0, clamped) };
    });
  }, [totalAvailable]);

  const applyOptimal = useCallback(() => setCurrentAlloc(optimalAlloc), [optimalAlloc]);

  const resetAlloc = useCallback(() => {
    const even = Math.floor(totalAvailable / 3);
    const remainder = totalAvailable - even * 3;
    setCurrentAlloc({ str: even + (remainder > 0 ? 1 : 0), dex: even + (remainder > 1 ? 1 : 0), int: even });
  }, [totalAvailable]);

  const activePreset = OPT_PRESETS.find(p => p.id === target);
  const accentColor = activePreset?.color ?? ACCENT;

  const currentScore = objectiveScore(currentStats, activeWeights);
  const optimalScore = objectiveScore(optimalStats, activeWeights);
  const efficiency = optimalScore > 0 ? Math.round((currentScore / optimalScore) * 100) : 100;

  return (
    <div className="space-y-4">
      <UniqueTabHeader
        icon={Target}
        title="Attribute Optimizer"
        color={ACCENT}
        subtitle={<><span style={{ color: ACCENT }}>{totalAvailable}</span> points at Lv.{level}</>}
        action={
          <div className="px-2.5 py-1 rounded-md text-xs font-mono border" style={{ borderColor: withOpacity(accentColor, OPACITY_20), backgroundColor: `${accentColor}${OPACITY_10}`, color: accentColor }}>
            {efficiency}% efficient
          </div>
        }
      />

      <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      <AnimatePresence mode="sync">
        {activeTab === 'optimizer' && (
          <OptimizerTab
            target={target} setTarget={setTarget}
            level={level} setLevel={setLevel}
            customWeights={customWeights} setCustomWeights={setCustomWeights}
            currentAlloc={currentAlloc} optimalAlloc={optimalAlloc}
            totalAvailable={totalAvailable} remaining={remaining}
            accentColor={accentColor}
            currentStats={currentStats} optimalStats={optimalStats}
            updateAlloc={updateAlloc} applyOptimal={applyOptimal} resetAlloc={resetAlloc}
          />
        )}
        {activeTab === 'comparison' && (
          <ComparisonTab
            currentAlloc={currentAlloc} optimalAlloc={optimalAlloc}
            currentStats={currentStats} optimalStats={optimalStats}
            efficiency={efficiency}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
