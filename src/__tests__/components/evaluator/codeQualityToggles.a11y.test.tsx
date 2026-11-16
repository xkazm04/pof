/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): the context's selectable chips and rows
 * (oracle severity filter chips, deep-eval module picker, dependency-explorer type chips and
 * node rows) showed selection only by background/border colour. Each now exposes aria-pressed
 * (WCAG 4.1.2, and 1.4.1: state is not colour alone).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { FilterChip } from '@/components/modules/evaluator/AssetCodeOracleView/ViolationRow';
import { DependencyExplorer } from '@/components/modules/evaluator/AssetCodeOracleView/DependencyExplorer';
import { ModuleSelectorPanel } from '@/components/modules/evaluator/DeepEvalResults/ModuleSelectorPanel';
import { getEvaluableModuleIds } from '@/lib/evaluator/module-eval-prompts';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { DependencyNode } from '@/lib/asset-code-oracle';

afterEach(cleanup);
const noop = () => {};

describe('code-quality-evaluation toggles expose aria-pressed', () => {
  it('oracle filter chip', () => {
    const { container, rerender } = render(<FilterChip label="Errors" count={2} active={false} onClick={noop} />);
    expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
    rerender(<FilterChip label="Errors" count={2} active onClick={noop} />);
    expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('deep-eval module picker', () => {
    const [first, second] = getEvaluableModuleIds();
    render(
      <ModuleSelectorPanel showModuleSelector selectedModuleIds={new Set([first])} setSelectedModuleIds={noop} toggleSelectedModule={noop} />,
    );
    const label = (id: string) => (MODULE_LABELS as Record<string, string>)[id] ?? id;
    expect(screen.getByRole('button', { name: label(first) }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: label(second) }).getAttribute('aria-pressed')).toBe('false');
  });

  it('dependency explorer type chips and node rows', () => {
    const nodes = [
      { id: 'Env/SM_A.uasset', label: 'SM_A', type: 'mesh', inDegree: 0, outDegree: 1 },
    ] as unknown as DependencyNode[];
    render(<DependencyExplorer nodes={nodes} edges={[]} />);
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'mesh' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTitle('Env/SM_A.uasset').getAttribute('aria-pressed')).toBe('false');
  });
});
