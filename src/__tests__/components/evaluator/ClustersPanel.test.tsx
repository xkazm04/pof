import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ClustersPanel } from '@/components/modules/evaluator/PromptEvolutionView/ClustersPanel';
import type { PromptCluster } from '@/types/prompt-evolution';

const cluster = (sessions: number, successRate: number): PromptCluster => ({
  label: 'melee', keywords: ['melee'], representative: 'r', successRate, avgLength: 10,
  sessionIds: Array.from({ length: sessions }, (_, i) => i),
});

afterEach(() => cleanup());

const badgeClass = () => screen.getByText(/% success/).className;
const baseline = (sessions: number, rate: number) => {
  const { unmount } = render(
    <ClustersPanel clusters={[cluster(sessions, rate)]} selectedModuleId="m" isClustering={false} handleCluster={() => {}} />,
  );
  const c = badgeClass();
  unmount();
  return c;
};

describe('ClustersPanel — a cluster is not graded below the trial floor', () => {
  it('one session at 100% does not read like ten at 100%', () => {
    expect(baseline(1, 1)).not.toBe(baseline(10, 1));
  });

  it('one session at 0% does not read like ten at 0%', () => {
    expect(baseline(1, 0)).not.toBe(baseline(10, 0));
  });
});
