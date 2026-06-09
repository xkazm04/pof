import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// The panel now delegates the code body to the shared CodeViewer (Shiki). Stub
// it so the test asserts the *wiring* (which file/lang it receives) without
// loading WASM grammars — CodeViewer has its own coverage in code-viewer.test.
vi.mock('@/components/ui/CodeViewer', () => ({
  CodeViewer: ({ fileName, lang, languageLabel, code }: {
    fileName: string; lang?: string; languageLabel?: string; code: string;
  }) => (
    <div
      data-testid="code-viewer"
      data-filename={fileName}
      data-lang={lang}
      data-label={languageLabel}
    >
      {code}
    </div>
  ),
}));

// Selector-based store mock: every call passes a selector over a static state.
const FILES = [
  { filename: 'EconomyConfig.h', language: 'h' as const, content: 'struct FEconomyConfig {};', description: 'Economy data tables header' },
  { filename: 'EconomyConfig.cpp', language: 'cpp' as const, content: 'void Init() {}', description: 'Economy config source' },
];
const STATE = {
  result: { config: { philosophy: 'balanced', maxLevel: 60, agentCount: 100 } },
  codeGenResult: {
    files: FILES,
    generatedAt: '2026-06-03T00:00:00Z',
    config: { philosophy: 'balanced', maxLevel: 60, agentCount: 100 },
  },
  isGenerating: false,
  generateCode: vi.fn(),
};
vi.mock('@/stores/economySimulatorStore', () => ({
  useEconomySimulatorStore: (selector: (s: typeof STATE) => unknown) => selector(STATE),
}));

import { EconomyCodeGenPanel } from '@/components/modules/evaluator/EconomyCodeGenPanel';

/** Expand the collapsed panel by clicking its header toggle. */
function renderExpanded() {
  const utils = render(<EconomyCodeGenPanel />);
  fireEvent.click(utils.getByText('UE5 Code Generator'));
  return utils;
}

describe('EconomyCodeGenPanel', () => {
  it('renders the generated code through the shared CodeViewer, not a hand-rolled <pre>', () => {
    const { getByTestId, container } = renderExpanded();

    const viewer = getByTestId('code-viewer');
    // First file is the active tab → its content/filename/lang reach CodeViewer.
    expect(viewer.getAttribute('data-filename')).toBe('EconomyConfig.h');
    expect(viewer.getAttribute('data-lang')).toBe('h');
    expect(viewer.getAttribute('data-label')).toBe('Header');
    expect(viewer.textContent).toContain('struct FEconomyConfig {};');

    // The old monochrome <pre> + manual line-number gutter is gone.
    expect(container.querySelector('pre')).toBeNull();
  });

  it('keeps the file description as a context line above the viewer', () => {
    const { getByText } = renderExpanded();
    expect(getByText('Economy data tables header')).toBeTruthy();
  });

  it('keeps the file-tab strip and swaps the active file on tab click', () => {
    const { getByText, getByTestId } = renderExpanded();

    // Switch to the .cpp tab (label includes the line-count suffix, so match the filename node).
    fireEvent.click(getByText('EconomyConfig.cpp'));

    const viewer = getByTestId('code-viewer');
    expect(viewer.getAttribute('data-filename')).toBe('EconomyConfig.cpp');
    expect(viewer.getAttribute('data-lang')).toBe('cpp');
    expect(viewer.getAttribute('data-label')).toBe('Source');
  });

  it('keeps the summary footer with the generation config', () => {
    const { getByText } = renderExpanded();
    expect(getByText('2 files generated')).toBeTruthy();
    expect(getByText('Philosophy: balanced')).toBeTruthy();
    expect(getByText('Max Level: 60')).toBeTruthy();
  });
});
