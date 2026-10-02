'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { useProjectStore } from '@/stores/projectStore';
import { getFeatureInitPrompt } from '@/components/modules/core-engine/unique-tabs/feature-init-prompts';
import type { SectionId } from '@/components/modules/core-engine/unique-tabs/feature-map-config';
import {
  sectionScaffoldState,
  scaffoldQueue,
  type ScaffoldGrade,
} from '@/components/modules/core-engine/unique-tabs/sectionScaffold';

/** Why a section a run targeted still is not in the project. */
export type ScaffoldReason = 'run finished, class not found' | 'run failed';

export type SectionScaffoldView = ScaffoldGrade & { reason?: ScaffoldReason };

/**
 * Scaffold Feature Map sections into the UE project, one clicked section per CLI run.
 *
 * `scaffold(id)` dispatches the section's init prompt as a quick-action task on one
 * module session. When that run ends — success or not — the project is rescanned past
 * the cache (`scanProject({ force: true })`) and the section is re-graded from the
 * scanned headers; the CLI's success flag only picks the reason shown when the class is
 * still missing. Nothing here dispatches or scans on mount, and a finished run never
 * starts the next queued section: every run is a click.
 */
export function useSectionScaffold(moduleId: SubModuleId) {
  const dynamicContext = useProjectStore((s) => s.dynamicContext);
  const projectPath = useProjectStore((s) => s.projectPath);
  const isScanning = useProjectStore((s) => s.isScanning);
  const classes = dynamicContext?.classes ?? null;

  const inflightRef = useRef<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Record<string, boolean>>({});

  const onComplete = useCallback((success: boolean) => {
    const id = inflightRef.current;
    if (!id) return; // another Feature Map instance's run on the shared session
    inflightRef.current = null;
    void useProjectStore.getState().scanProject({ force: true }).finally(() => {
      setLastRun((prev) => ({ ...prev, [id]: success }));
      setRunning(null);
    });
  }, []);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: `scaffold-${moduleId}`,
    label: `Scaffold: ${moduleId}`,
    accentColor: MODULE_COLORS.core,
    onComplete,
  });

  const scaffold = useCallback((sectionId: string) => {
    const init = getFeatureInitPrompt(moduleId, sectionId);
    if (!init || inflightRef.current || isRunning) return;
    inflightRef.current = sectionId;
    setRunning(sectionId);
    void execute(TaskFactory.quickAction(moduleId, init.prompt, `Scaffold: ${sectionId}`));
  }, [moduleId, execute, isRunning]);

  const scan = useCallback(() => {
    void useProjectStore.getState().scanProject({ force: true });
  }, []);

  const stateOf = useCallback((sectionId: string): SectionScaffoldView => {
    const grade = sectionScaffoldState(moduleId, sectionId, classes);
    const ran = lastRun[sectionId];
    if (ran === undefined || (grade.state !== 'absent' && grade.state !== 'partial')) return grade;
    return { ...grade, reason: ran ? 'run finished, class not found' : 'run failed' };
  }, [moduleId, classes, lastRun]);

  const queue: SectionId[] = useMemo(() => scaffoldQueue(moduleId, classes), [moduleId, classes]);

  return {
    stateOf,
    queue,
    scaffold,
    scan,
    /** The section whose run (or post-run rescan) is in flight, else null. */
    running,
    busy: running !== null || isRunning,
    isScanning,
    scanned: classes !== null,
    hasProject: projectPath !== '',
  };
}

export type SectionScaffold = ReturnType<typeof useSectionScaffold>;
