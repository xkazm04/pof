/**
 * The Transpile pane must state how much of the graph it actually translated.
 *
 * It rendered a warning count only when `> 0`, so a body assembled entirely
 * from pin names and unquoted defaults presented as a clean transpile. The
 * fidelity line is always present and is derived from the warning list.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

function renderPane(r: TranspileResult) {
  return render(
    <TranspilePane
      blueprintJson="{}"
      setBlueprintJson={() => {}}
      onTranspile={() => {}}
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
      projectPath=""
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
