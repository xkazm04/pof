'use client';

import { useState, useCallback } from 'react';
import { SubTabNavigation, type SubTab } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SquadChoreographyEditor } from '@/components/modules/game-systems/SquadChoreographyEditor';
import { AttackRingVisualizer } from '@/components/modules/game-systems/AttackRingVisualizer';
import { FlankAngleHeatmap } from '@/components/modules/game-systems/FlankAngleHeatmap';
import { TacticalCoverAnalysis } from '@/components/modules/game-systems/TacticalCoverAnalysis';
import { PatrolPointsDistribution } from '@/components/modules/game-systems/PatrolPointsDistribution';
import { EQSPipelineDiagram } from '@/components/modules/game-systems/EQSPipelineDiagram';
import { EQSComponentInventory } from '@/components/modules/game-systems/EQSComponentInventory';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { getModuleChecklist } from '@/lib/module-registry';
import { buildSquadBuildPrompt } from '@/lib/ai-director/squad-build-prompt';
import { logger } from '@/lib/logger';
import type { DirectorConfig } from '@/types/squad-tactics';
import { SYSTEMS_ACCENT } from './constants';

/** The checklist item the authored squad is built through (group AI coordination). */
const SQUAD_ITEM_ID = 'ai-5';

const TOOLS: SubTab[] = [
  { id: 'squad', label: 'Squad Choreography' },
  { id: 'attack-ring', label: 'Attack Ring' },
  { id: 'flank-heatmap', label: 'Flank Heatmap' },
  { id: 'cover', label: 'Cover Analysis' },
  { id: 'patrol', label: 'Patrol Points' },
  { id: 'pipelines', label: 'EQS Pipelines' },
  { id: 'inventory', label: 'EQS Inventory' },
];

/**
 * "EQS & Squad Tactics" tab of the AI Behavior module: the EQS / squad design tools
 * behind one sub-nav, only the active one mounted. The squad editor's Build button
 * feeds the tuned formation into the ai-5 checklist task — dispatched on click only.
 */
export function EqsSquadTab() {
  const [tool, setTool] = useState('squad');

  const squadCli = useModuleCLI({
    moduleId: 'ai-behavior',
    sessionKey: 'ai-squad-build',
    label: 'Squad Build',
    accentColor: SYSTEMS_ACCENT,
  });
  const { execute } = squadCli;

  const handleBuild = useCallback((config: DirectorConfig) => {
    const item = getModuleChecklist('ai-behavior').find((c) => c.id === SQUAD_ITEM_ID);
    if (!item) {
      logger.warn(`[EqsSquadTab] checklist item ${SQUAD_ITEM_ID} missing; squad build not dispatched`);
      return;
    }
    const prompt = buildSquadBuildPrompt(config, item.prompt);
    if (!prompt.ok) {
      logger.warn(`[EqsSquadTab] squad build refused: ${prompt.error.message}`);
      return;
    }
    void execute(TaskFactory.checklist(
      'ai-behavior', SQUAD_ITEM_ID, prompt.data, `Build Squad: ${config.formation.name}`, getAppOrigin(),
    ));
  }, [execute]);

  return (
    <div className="flex flex-col h-full" data-testid="eqs-squad-tab">
      <SubTabNavigation
        tabs={TOOLS}
        activeTabId={tool}
        onChange={setTool}
        accent={SYSTEMS_ACCENT}
        ariaLabel="EQS & squad tools"
      />
      <div className="flex-1 min-h-0">
        {tool === 'squad' && <SquadChoreographyEditor onBuild={handleBuild} isBuilding={squadCli.isRunning} />}
        {tool === 'attack-ring' && <AttackRingVisualizer />}
        {tool === 'flank-heatmap' && <FlankAngleHeatmap />}
        {tool === 'cover' && <TacticalCoverAnalysis />}
        {tool === 'patrol' && <PatrolPointsDistribution />}
        {tool === 'pipelines' && <EQSPipelineDiagram />}
        {tool === 'inventory' && <EQSComponentInventory />}
      </div>
    </div>
  );
}
