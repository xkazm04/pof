import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DataRecoveryTool } from '@/components/modules/core-engine/sub_save/advanced/DataRecoveryTool';

afterEach(cleanup);

describe('DataRecoveryTool stepper', () => {
  it('renders each step as a real button and marks the current one', () => {
    const { container } = render(<DataRecoveryTool />);
    const steps = Array.from(container.querySelectorAll('button'));
    expect(steps.map((b) => b.textContent?.trim())).toEqual(['Detect', 'Recover', 'Verify', 'Confirm']);
    expect(steps[3].getAttribute('aria-current')).toBe('step');
    fireEvent.click(steps[0]);
    expect(steps[0].getAttribute('aria-current')).toBe('step');
    expect(steps[3].getAttribute('aria-current')).toBeNull();
  });
});
