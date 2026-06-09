import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Mermaid needs a real browser layout engine (getBBox) that jsdom lacks, so we
// mock the module and drive `render` per-test. vi.hoisted lets the (hoisted)
// vi.mock factory reference our spy.
const { renderMock, initMock } = vi.hoisted(() => ({ renderMock: vi.fn(), initMock: vi.fn() }));
vi.mock('mermaid', () => ({ default: { initialize: initMock, render: renderMock } }));

import { MermaidDiagram } from '@/components/ui/MermaidDiagram';

const NODE_SVG =
  '<svg id="g"><g class="node" id="flowchart-arpg_combat-1"><text>Combat</text></g></svg>';

beforeEach(() => {
  renderMock.mockReset();
  initMock.mockReset();
});

describe('MermaidDiagram', () => {
  it('shows the diagram source as a readable fallback before/if rendering fails', async () => {
    renderMock.mockRejectedValue(new Error('no bbox in jsdom'));
    const { container } = render(<MermaidDiagram code="pie title Status" ariaLabel="Status pie" />);
    await waitFor(() => {
      expect(container.querySelector('pre')?.textContent).toContain('pie title Status');
    });
  });

  it('swaps in the rendered SVG once mermaid resolves', async () => {
    renderMock.mockResolvedValue({ svg: NODE_SVG });
    const { container } = render(<MermaidDiagram code="graph TD; A-->B" ariaLabel="Arch" />);
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
    expect(container.querySelector('pre')).toBeNull();
  });

  it('labels a non-interactive diagram as role="img"', () => {
    const { container } = render(<MermaidDiagram code="x" ariaLabel="Pie chart" />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Pie chart');
  });

  it('labels an interactive diagram as role="group" and wires node clicks', async () => {
    renderMock.mockResolvedValue({ svg: NODE_SVG });
    const onNodeClick = vi.fn();
    const { container } = render(
      <MermaidDiagram code="graph TD" ariaLabel="Architecture" onNodeClick={onNodeClick} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('role')).toBe('group');

    await waitFor(() => expect(container.querySelector('.node')).toBeTruthy());
    const node = container.querySelector('.node') as HTMLElement;
    expect(node.getAttribute('role')).toBe('button');
    expect(node.getAttribute('tabindex')).toBe('0');
    fireEvent.click(node);
    expect(onNodeClick).toHaveBeenCalledWith('flowchart-arpg_combat-1');
  });

  it('activates a node on Enter/Space for keyboard users', async () => {
    renderMock.mockResolvedValue({ svg: NODE_SVG });
    const onNodeClick = vi.fn();
    const { container } = render(
      <MermaidDiagram code="graph TD" ariaLabel="Architecture" onNodeClick={onNodeClick} />
    );
    await waitFor(() => expect(container.querySelector('.node')).toBeTruthy());
    fireEvent.keyDown(container.querySelector('.node') as HTMLElement, { key: 'Enter' });
    expect(onNodeClick).toHaveBeenCalledWith('flowchart-arpg_combat-1');
  });

  it('only wires nodes the isNodeInteractive predicate accepts', async () => {
    renderMock.mockResolvedValue({ svg: NODE_SVG });
    const onNodeClick = vi.fn();
    const { container } = render(
      <MermaidDiagram
        code="graph TD"
        ariaLabel="Architecture"
        onNodeClick={onNodeClick}
        isNodeInteractive={() => false}
      />
    );
    await waitFor(() => expect(container.querySelector('.node')).toBeTruthy());
    const node = container.querySelector('.node') as HTMLElement;
    expect(node.getAttribute('role')).toBeNull();
    fireEvent.click(node);
    expect(onNodeClick).not.toHaveBeenCalled();
  });
});
