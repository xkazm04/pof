/** Port fields commit once, on blur, and only a complete in-range port reaches the store. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConnectionSettings } from '@/components/modules/project-setup/BridgeEndpointHealth/ConnectionSettings';

afterEach(() => cleanup());

function setup() {
  const setPofPort = vi.fn();
  const setRcPort = vi.fn();
  render(
    <ConnectionSettings
      host="127.0.0.1" setHost={vi.fn()}
      pofPort={30040} setPofPort={setPofPort}
      rcPort={30010} setRcPort={setRcPort}
    />,
  );
  return { setPofPort, setRcPort };
}

describe.each([
  ['bridge-pof-port-input', 'setPofPort'],
  ['bridge-rc-port-input', 'setRcPort'],
] as const)('%s', (testId, spyKey) => {
  it('typing digit by digit writes nothing; blur writes the complete port once', () => {
    const spies = setup();
    const input = screen.getByTestId(testId) as HTMLInputElement;
    for (const v of ['3', '30', '300', '3004', '30041']) fireEvent.change(input, { target: { value: v } });
    expect(spies[spyKey]).toHaveBeenCalledTimes(0);
    expect(input.value).toBe('30041');
    fireEvent.blur(input);
    expect(spies[spyKey]).toHaveBeenCalledTimes(1);
    expect(spies[spyKey]).toHaveBeenCalledWith(30041);
  });

  it('one bound: a port below the input min of 1024 is not committed and the field reverts', () => {
    const spies = setup();
    const input = screen.getByTestId(testId) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.blur(input);
    expect(spies[spyKey]).toHaveBeenCalledTimes(0);
    expect(input.value).toBe(spyKey === 'setPofPort' ? '30040' : '30010');
  });
});
