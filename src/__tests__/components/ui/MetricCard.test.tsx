import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Gamepad2 } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { STATUS_INFO } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

describe('MetricCard — unified telemetry stat card', () => {
  it('renders the label and value', () => {
    render(<MetricCard label="Sessions" value="12" icon={Gamepad2} accent={STATUS_INFO} />);
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('uses a consistent rounded-xl shell with p-3.5 padding (vertical)', () => {
    const { container } = render(
      <MetricCard label="Sessions" value="12" icon={Gamepad2} accent={STATUS_INFO} />,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('rounded-xl');
    expect(shell.className).toContain('p-3.5');
  });

  it('keeps the same rounded-xl + p-3.5 shell in horizontal layout', () => {
    const { container } = render(
      <MetricCard layout="horizontal" label="Open" value={4} icon={Gamepad2} accent={STATUS_INFO} />,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('rounded-xl');
    expect(shell.className).toContain('p-3.5');
    expect(shell.className).toContain('flex');
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('renders the icon glyph', () => {
    const { container } = render(
      <MetricCard label="Sessions" value="12" icon={Gamepad2} accent={STATUS_INFO} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders a positive delta with a + sign and suffix', () => {
    render(
      <MetricCard label="Success Rate" value="80%" icon={Gamepad2} accent={STATUS_INFO} delta={5} deltaSuffix="%" />,
    );
    expect(screen.getByText('+5%')).toBeTruthy();
  });

  it('renders a negative delta with the raw sign', () => {
    render(<MetricCard label="Sessions" value="3" icon={Gamepad2} accent={STATUS_INFO} delta={-2} />);
    expect(screen.getByText('-2')).toBeTruthy();
  });

  it('omits the delta entirely when it is zero', () => {
    const { container } = render(
      <MetricCard label="Sessions" value="3" icon={Gamepad2} accent={STATUS_INFO} delta={0} />,
    );
    // No delta affordance is rendered for a zero change.
    expect(container.textContent).not.toContain('+0');
    expect(container.textContent).not.toContain('-0');
  });

  it('still renders label and value when animated', () => {
    render(
      <MetricCard label="Sessions" value="12" icon={Gamepad2} accent={STATUS_INFO} animate delay={0.1} />,
    );
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });
});
