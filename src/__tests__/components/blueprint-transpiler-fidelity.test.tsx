/**
 * The Transpile pane must state how much of the graph it actually translated.
 *
 * It rendered a warning count only when `> 0`, so a body assembled entirely
 * from pin names and unquoted defaults presented as a clean transpile. The
 * fidelity line is always present and is derived from the warning list.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TranspilePane } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/TranspilePane';
import type { TranspileResult } from '@/types/blueprint';

function result(partial: Partial<TranspileResult> = {}): TranspileResult {
  return {
    headerCode: '#pragma once',
    sourceCode: '// body',
    className: 'AHero',
    parentClass: 'ACharacter',
    includes: ['CoreMinimal.h', 'AHero.generated.h'],
    warnings: [],
    nodeCount: 5,
    functionCount: 1,
    replication: { hasReplication: false, properties: [] },
    ...partial,
  };
}

function renderPane(r: TranspileResult, extra: { stale?: boolean; onTranspile?: () => void; projectPath?: string } = {}) {
  return render(
    <TranspilePane
      blueprintJson="{}"
      setBlueprintJson={() => {}}
      onTranspile={extra.onTranspile ?? (() => {})}
      onLoadSample={() => {}}
      isLoading={false}
      error={null}
      asset={null}
      summary={null}
      result={r}
      showCode="header"
      setShowCode={() => {}}
      moduleName="PoF"
      onModuleChange={() => {}}
      projectPath={extra.projectPath ?? ''}
      stale={extra.stale}
    />,
  );
}

describe('TranspilePane — fidelity readout', () => {
  afterEach(() => cleanup());

  it('states how many nodes were translated and how many are left as TODO', () => {
    renderPane(result({
      nodeCount: 5,
      warnings: [
        { nodeId: 'n2', message: 'needs manual translation', severity: 'info' },
        { nodeId: 'f2', message: 'needs manual translation', severity: 'info' },
      ],
    }));
    expect(screen.getByTestId('transpile-fidelity').textContent)
      .toBe('3 of 5 nodes translated · 2 left as TODO');
  });

  it('still states fidelity when nothing warned (the readout is never absent)', () => {
    renderPane(result({ nodeCount: 4, warnings: [] }));
    expect(screen.getByTestId('transpile-fidelity').textContent)
      .toBe('4 of 4 nodes translated');
  });
});

describe('TranspilePane — a result for a Blueprint that has since changed', () => {
  afterEach(() => cleanup());

  it('hides Write to Project and offers a re-transpile that calls onTranspile once', () => {
    const onTranspile = vi.fn();
    renderPane(result(), { stale: true, onTranspile, projectPath: 'C:/proj' });
    expect(screen.queryByText('Write to Project')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Blueprint changed - re-transpile/ }));
    expect(onTranspile).toHaveBeenCalledTimes(1);
  });

  it('[guard] a fresh result keeps Write to Project', () => {
    renderPane(result(), { stale: false, projectPath: 'C:/proj' });
    expect(screen.getByText('Write to Project')).toBeTruthy();
    expect(screen.queryByText(/Blueprint changed/)).toBeNull();
  });
});
