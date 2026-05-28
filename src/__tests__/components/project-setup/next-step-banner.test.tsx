import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { deriveNextStep } from '@/components/modules/project-setup/nextStep';
import { NextStepBanner } from '@/components/modules/project-setup/NextStepBanner';

afterEach(() => cleanup());

describe('deriveNextStep', () => {
  it('prioritizes installing tools when any are missing', () => {
    const step = deriveNextStep({ missingToolCount: 2, hasProject: false });
    expect(step.id).toBe('install-tools');
    expect(step.ctaLabel).toBe('Install Tools');
    expect(step.explanation).toContain('2 required build tools are missing');
  });

  it('uses singular phrasing for exactly one missing tool', () => {
    const step = deriveNextStep({ missingToolCount: 1, hasProject: false });
    expect(step.id).toBe('install-tools');
    expect(step.explanation).toContain('1 required build tool is missing');
    expect(step.explanation).toContain('install it automatically');
  });

  it('suggests creating a project when tools are present but no project exists', () => {
    const step = deriveNextStep({ missingToolCount: 0, hasProject: false });
    expect(step.id).toBe('create-project');
    expect(step.ctaLabel).toBe('Create Project');
  });

  it('falls back to build & verify when tools are present and a project exists', () => {
    const step = deriveNextStep({ missingToolCount: 0, hasProject: true });
    expect(step.id).toBe('build-verify');
    expect(step.ctaLabel).toBe('Build & Verify');
  });

  it('still prioritizes missing tools even when a project exists', () => {
    const step = deriveNextStep({ missingToolCount: 1, hasProject: true });
    expect(step.id).toBe('install-tools');
  });
});

describe('NextStepBanner', () => {
  const step = deriveNextStep({ missingToolCount: 0, hasProject: true });

  it('renders the title, explanation and a single primary CTA', () => {
    render(<NextStepBanner step={step} onAction={vi.fn()} />);
    expect(screen.getByText(/do this next/i)).toBeTruthy();
    expect(screen.getByText(step.title)).toBeTruthy();
    expect(screen.getByText(step.explanation)).toBeTruthy();
    const cta = screen.getByTestId('pof-setup-next-step-cta');
    expect(cta.textContent).toContain('Build & Verify');
  });

  it('exposes the step id via data-step for derivation-state assertions', () => {
    render(<NextStepBanner step={step} onAction={vi.fn()} />);
    expect(screen.getByTestId('pof-setup-next-step-banner').getAttribute('data-step')).toBe('build-verify');
  });

  it('fires onAction when the CTA is clicked', () => {
    const onAction = vi.fn();
    render(<NextStepBanner step={step} onAction={onAction} />);
    fireEvent.click(screen.getByTestId('pof-setup-next-step-cta'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA while loading and shows the spinner', () => {
    render(<NextStepBanner step={step} onAction={vi.fn()} loading />);
    const cta = screen.getByTestId('pof-setup-next-step-cta') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(cta.getAttribute('aria-busy')).toBe('true');
  });

  it('disables the CTA when disabled is set', () => {
    const onAction = vi.fn();
    render(<NextStepBanner step={step} onAction={onAction} disabled />);
    const cta = screen.getByTestId('pof-setup-next-step-cta') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    fireEvent.click(cta);
    expect(onAction).not.toHaveBeenCalled();
  });
});
