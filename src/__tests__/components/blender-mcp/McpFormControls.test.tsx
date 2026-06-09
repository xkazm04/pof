import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { Layers } from 'lucide-react';
import {
  MCP_FORM_RADIUS,
  MCPFormCard,
  MCPField,
  MCPTextInput,
  MCPSubmitButton,
  DisconnectedNotice,
  ResultBlock,
} from '@/components/blender-mcp/McpFormControls';

afterEach(cleanup);

describe('MCP form primitives — canonical radius', () => {
  it('uses one corner radius across card, input, and button', () => {
    // Lock the contract: there is a single radius token...
    expect(MCP_FORM_RADIUS).toBe('rounded-md');

    const { container } = render(
      <MCPFormCard>
        <MCPTextInput value="" onChange={() => {}} data-testid="i" />
        <MCPSubmitButton onClick={() => {}} icon={Layers}>
          Go
        </MCPSubmitButton>
      </MCPFormCard>,
    );

    const card = container.firstElementChild!;
    const input = screen.getByTestId('i');
    const button = screen.getByRole('button');

    // ...and every control carries it (no rounded-lg / rounded drift).
    for (const el of [card, input, button]) {
      expect(el.classList.contains(MCP_FORM_RADIUS)).toBe(true);
      expect(el.classList.contains('rounded-lg')).toBe(false);
    }
  });
});

describe('MCPField', () => {
  it('renders the label and hint and associates the label with the control', () => {
    render(
      <MCPField label="Object Name" hint="Each ratio creates an LOD level." htmlFor="obj">
        <MCPTextInput id="obj" value="" onChange={() => {}} />
      </MCPField>,
    );

    const label = screen.getByText('Object Name');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('obj');
    expect(screen.getByText('Each ratio creates an LOD level.')).toBeTruthy();
  });

  it('omits the hint paragraph when no hint is supplied', () => {
    const { container } = render(
      <MCPField label="Object Name">
        <MCPTextInput value="" onChange={() => {}} />
      </MCPField>,
    );
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('MCPTextInput', () => {
  it('emits the new string value on change', () => {
    const onChange = vi.fn();
    render(<MCPTextInput value="" onChange={onChange} data-testid="t" />);
    fireEvent.change(screen.getByTestId('t'), { target: { value: 'SM_Sword' } });
    expect(onChange).toHaveBeenCalledWith('SM_Sword');
  });

  it('applies a monospace face only when mono is set', () => {
    render(<MCPTextInput value="" onChange={() => {}} mono data-testid="mono" />);
    render(<MCPTextInput value="" onChange={() => {}} data-testid="plain" />);
    expect(screen.getByTestId('mono').classList.contains('font-mono')).toBe(true);
    expect(screen.getByTestId('plain').classList.contains('font-mono')).toBe(false);
  });
});

describe('MCPSubmitButton', () => {
  it('shows the idle label and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <MCPSubmitButton onClick={onClick} icon={Layers}>
        Generate LODs
      </MCPSubmitButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('Generate LODs');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the loading label and is disabled while loading', () => {
    render(
      <MCPSubmitButton onClick={() => {}} icon={Layers} loading loadingLabel="Generating...">
        Generate LODs
      </MCPSubmitButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('Generating...');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('respects the disabled prop', () => {
    render(
      <MCPSubmitButton onClick={() => {}} icon={Layers} disabled>
        Go
      </MCPSubmitButton>,
    );
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });
});

describe('DisconnectedNotice', () => {
  it('renders the default connect hint', () => {
    render(<DisconnectedNotice />);
    expect(screen.getByText(/connect to blender mcp first/i)).toBeTruthy();
  });

  it('renders a custom message', () => {
    render(<DisconnectedNotice message="Offline." />);
    expect(screen.getByText('Offline.')).toBeTruthy();
  });
});

describe('ResultBlock', () => {
  it('renders nothing when there is no result or error', () => {
    const { container } = render(<ResultBlock result={null} error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a success result', () => {
    render(<ResultBlock result="Generated 3 LODs" error={null} />);
    expect(screen.getByText('Generated 3 LODs')).toBeTruthy();
  });

  it('renders an error', () => {
    render(<ResultBlock result={null} error="Object not found" />);
    expect(screen.getByText('Object not found')).toBeTruthy();
  });
});
