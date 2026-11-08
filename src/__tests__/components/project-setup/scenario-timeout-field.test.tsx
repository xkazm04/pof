/** A cleared Timeout field never reaches the plugin as 0: only a positive finite number is committed. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScenarioCard } from '@/components/modules/project-setup/TestHarnessPanel/ScenarioCard';
import { TEMPLATE_SCENARIO } from '@/components/modules/project-setup/TestHarnessPanel/constants';

afterEach(() => cleanup());

function setup() {
  const onUpdate = vi.fn();
  render(<ScenarioCard scenario={TEMPLATE_SCENARIO} index={0} isExpanded onToggle={() => {}} onUpdate={onUpdate} onRemove={() => {}} />);
  const input = screen.getByLabelText(/Timeout/) as HTMLInputElement;
  return { onUpdate, input };
}

describe('scenario Timeout field', () => {
  it('a blank field emits no update (was timeout 0) and reverts on blur', () => {
    const { onUpdate, input } = setup();
    fireEvent.change(input, { target: { value: '' } });
    expect(onUpdate).toHaveBeenCalledTimes(0);
    fireEvent.blur(input);
    expect(input.value).toBe(String(TEMPLATE_SCENARIO.timeout));
  });

  it('zero and negative values are refused', () => {
    const { onUpdate, input } = setup();
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.change(input, { target: { value: '-5' } });
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });

  it('a positive number is committed as typed', () => {
    const { onUpdate, input } = setup();
    fireEvent.change(input, { target: { value: '45' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].timeout).toBe(45);
  });
});
