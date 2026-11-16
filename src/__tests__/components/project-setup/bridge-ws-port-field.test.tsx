/** Every probed port is editable where it is probed: the WS (/pof/live) port too. */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BridgeEndpointHealth } from '@/components/modules/project-setup/BridgeEndpointHealth';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';

beforeEach(() => { useUE5BridgeStore.setState({ wsPort: 30041 }); });
afterEach(() => cleanup());

describe('WS port field', () => {
  it('commits the typed WS port to ue5BridgeStore.wsPort on blur', () => {
    render(<BridgeEndpointHealth />);
    fireEvent.click(screen.getByTestId('bridge-settings-toggle-btn'));
    const input = screen.queryByTestId('bridge-ws-port-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.value).toBe('30041');
    fireEvent.change(input!, { target: { value: '30055' } });
    expect(useUE5BridgeStore.getState().wsPort).toBe(30041);
    fireEvent.blur(input!);
    expect(useUE5BridgeStore.getState().wsPort).toBe(30055);
  });
});
