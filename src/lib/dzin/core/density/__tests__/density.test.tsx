import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider, useDensity } from '../DensityContext';
import { PanelFrame } from '../../panel/PanelFrame';

afterEach(() => {
  cleanup();
});

// Helper component to read density from context
function DensityReader() {
  const density = useDensity();
  return <span data-testid="density-value">{density}</span>;
}

describe('DensityContext', () => {
  it('Test 1: DensityProvider sets density value accessible via useDensity()', () => {
    render(
      <DensityProvider density="compact">
        <DensityReader />
      </DensityProvider>,
    );
    expect(screen.getByTestId('density-value').textContent).toBe('compact');
  });

  it('Test 2: useDensity() returns "full" as default when no provider wraps the component', () => {
    render(<DensityReader />);
    expect(screen.getByTestId('density-value').textContent).toBe('full');
  });

  it('Test 1 (micro): DensityProvider sets micro density', () => {
    render(
      <DensityProvider density="micro">
        <DensityReader />
      </DensityProvider>,
    );
    expect(screen.getByTestId('density-value').textContent).toBe('micro');
  });
});

describe('PanelFrame', () => {
  it('Test 3: renders data-dzin-panel attribute on root element', () => {
    const { container } = render(
      <PanelFrame title="Test Panel">
        <p>Content</p>
      </PanelFrame>,
    );
    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root!.hasAttribute('data-dzin-panel')).toBe(true);
  });

  it('Test 4: at "full" density renders header with title and body', () => {
    render(
      <PanelFrame title="Full Panel" density="full" actions={<button>Action</button>}>
        <p>Body content</p>
      </PanelFrame>,
    );
    // Title should be in the header
    expect(screen.getByText('Full Panel')).toBeTruthy();
    // Actions should be rendered in full mode
    expect(screen.getByText('Action')).toBeTruthy();
    // Body content should be present
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('Test 5: at "compact" density renders header with title (marked compact)', () => {
    const { container } = render(
      <PanelFrame title="Compact Panel" density="compact" actions={<button>Action</button>}>
        <p>Body</p>
      </PanelFrame>,
    );
    // Title should be present
    expect(screen.getByText('Compact Panel')).toBeTruthy();
    // Actions should NOT be rendered in compact mode
    expect(screen.queryByText('Action')).toBeNull();
    // Header should have compact density attribute
    const header = container.querySelector('[data-dzin-panel-header]');
    expect(header).not.toBeNull();
    expect(header!.getAttribute('data-dzin-density')).toBe('compact');
  });

  it('Test 6: at "micro" density hides the header entirely, renders only body', () => {
    const { container } = render(
      <PanelFrame title="Micro Panel" density="micro">
        <p>Body only</p>
      </PanelFrame>,
    );
    // Header should NOT be rendered
    const header = container.querySelector('[data-dzin-panel-header]');
    expect(header).toBeNull();
    // Body content should still be present
    expect(screen.getByText('Body only')).toBeTruthy();
    // Title should still be accessible via aria-label
    const root = container.firstElementChild;
    expect(root!.getAttribute('aria-label')).toBe('Micro Panel');
  });

  it('Test 7: sets data-dzin-density attribute matching the current density', () => {
    const { container } = render(
      <PanelFrame title="Density Check" density="compact">
        <p>Test</p>
      </PanelFrame>,
    );
    const root = container.firstElementChild;
    expect(root!.getAttribute('data-dzin-density')).toBe('compact');
  });

  it('Test 8: uses density from context when density prop is not explicitly passed', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <PanelFrame title="Context Panel">
          <p>Via context</p>
        </PanelFrame>
      </DensityProvider>,
    );
    const root = container.querySelector('[data-dzin-panel]');
    expect(root!.getAttribute('data-dzin-density')).toBe('micro');
    // In micro mode, header should not exist
    const header = container.querySelector('[data-dzin-panel-header]');
    expect(header).toBeNull();
  });

  it('Test 9: density prop overrides context density', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <PanelFrame title="Override Panel" density="full">
          <p>Override content</p>
        </PanelFrame>
      </DensityProvider>,
    );
    const root = container.querySelector('[data-dzin-panel]');
    // Prop should win over context
    expect(root!.getAttribute('data-dzin-density')).toBe('full');
    // Full mode should show header
    const header = container.querySelector('[data-dzin-panel-header]');
    expect(header).not.toBeNull();
  });
});
