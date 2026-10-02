/**
 * lab-ui-primitives/A — one lab control door. `steps/controls.tsx` (the kit the Shared Component
 * Manifest sends every step author to) rides `ui/Field`'s Input/Textarea: a control cannot be
 * rendered without an accessible name, and it keeps the focus ring instead of `outline: 'none'`.
 *
 * Names are asserted through getByRole(…, { name }) — dom-accessibility-api ignores
 * `placeholder`, so a placeholder-only control fails these cases.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/components/layout-lab/steps/shared/useDispatchPlan', () => ({ useDispatchPlan: () => null }));

import '@/lib/catalog/pipelines/registry.generated';
import { LabButton, LabInput, LabTextarea } from '@/components/layout-lab/steps/controls';
import { CliProduce } from '@/components/layout-lab/steps/shared/CliProduce';
import { CanonRuleEditor } from '@/components/layout-lab/CanonRuleEditor';
import { StepLibraryPicker } from '@/components/layout-lab/steps/shared/StepLibraryPicker';
import { ProposalView } from '@/components/layout-lab/one-shot/ProposalView';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { LIGHT } from '@/components/layout-lab/theme';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const noop = () => {};
const RULE: ProjectRule = { id: 'r1', category: 'game', scope: 'global', title: 'T', body: 'B' };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('steps/controls — a name and a focus ring', () => {
  it('case 1: LabTextarea with `label` is named by an associated <label>', () => {
    render(<LabTextarea t={LIGHT} label="Direction (your input)" value="" onChange={noop} testId="d" />);
    expect(screen.getByRole('textbox', { name: 'Direction (your input)' })).toBe(screen.getByTestId('d'));
  });

  it('case 2: LabInput with `ariaLabel` is named, keeps its outline and carries the focus ring', () => {
    render(<LabInput t={LIGHT} ariaLabel="Search the library" value="" onChange={noop} />);
    const input = screen.getByRole('textbox', { name: 'Search the library' }) as HTMLInputElement;
    expect(input.style.outline).not.toBe('none');
    expect(input.className).toContain('focus-ring');
    expect(input.className).toContain(LIGHT.fontBody);
  });

  it('LabTextarea keeps its outline and carries the focus ring plus the theme font', () => {
    render(<LabTextarea t={LIGHT} ariaLabel="Notes" value="" onChange={noop} testId="n" />);
    const ta = screen.getByTestId('n') as HTMLTextAreaElement;
    expect(ta.style.outline).not.toBe('none');
    expect(ta.className).toContain('focus-ring-inset');
    expect(ta.className).toContain(LIGHT.fontBody);
  });

  it('case 8 [guard]: a disabled LabButton is disabled and a click does not fire', () => {
    const fn = vi.fn();
    render(<LabButton t={LIGHT} testId="b" disabled onClick={fn}>Go</LabButton>);
    const b = screen.getByTestId('b') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(fn).not.toHaveBeenCalled();
  });

  it('LabButton is a non-submitting button with the focus ring', () => {
    render(<LabButton t={LIGHT} testId="b">Go</LabButton>);
    const b = screen.getByTestId('b');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className.split(/\s+/)).toContain('focus-ring');
  });
});

describe('CliProduce — the Produce input of every step', () => {
  it('case 4: the direction textarea is named "Direction…" and keeps its test id', () => {
    render(<CliProduce t={LIGHT} label="Run It" buildPrompt={(d) => `do ${d}`} onComplete={noop} />);
    expect(screen.getByRole('textbox', { name: /Direction/ })).toBe(screen.getByTestId('cli-produce-direction'));
  });

  it('case 5: view-prompt toggle reports aria-expanded; a refused dispatch is announced in a persistent status region', () => {
    render(<CliProduce t={LIGHT} label="Run It" buildPrompt={() => 'p'} onComplete={noop} validate={() => 'no direction'} />);
    const toggle = screen.getByRole('button', { name: 'view prompt' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'hide prompt' }).getAttribute('aria-expanded')).toBe('true');

    const status = screen.getByRole('status');
    fireEvent.click(screen.getByRole('button', { name: /⚡ Run It/ }));
    expect(screen.getByRole('status')).toBe(status);
    expect(within(status).getByTestId('cli-produce-result').textContent).toBe('✗ no direction');
  });

  it('case 8 [guard]: the e2e hook cli-produce-direction still resolves', () => {
    render(<CliProduce t={LIGHT} label="Run It" buildPrompt={() => ''} onComplete={noop} />);
    expect(screen.getByTestId('cli-produce-direction').tagName).toBe('TEXTAREA');
  });
});

describe('lab consumers name their controls', () => {
  it('case 6a: CanonRuleEditor Title and Body are labelled', () => {
    render(<CanonRuleEditor t={LIGHT} rule={RULE} onSave={async (r) => ({ ok: true, data: r })} onCancel={noop} />);
    expect(screen.getByLabelText('Title')).toBe(screen.getByPlaceholderText('Rule title'));
    expect(screen.getByLabelText('Body')).toBe(screen.getByPlaceholderText('Rule body / guidance'));
  });

  it('case 6b: ProposalView refine textarea is labelled "Refine direction"', () => {
    useOneShotJobStore.setState({ catalogId: null, distribution: null, target: null, stepModeOverrides: {} });
    render(<ProposalView t={LIGHT} proposal={{ name: 'P', rationale: 'r', data: {} }} refinementTurns={0} onRefine={noop} onApprove={noop} />);
    expect(screen.getByLabelText(/Refine direction/).tagName).toBe('TEXTAREA');
    useOneShotJobStore.getState().reset();
  });

  it('StepLibraryPicker search is named; case 8 [guard]: its placeholder still resolves', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })));
    render(<StepLibraryPicker t={LIGHT} referencedIds={[]} onPick={noop} onUnpick={noop} />);
    fireEvent.click(screen.getByTestId('step-library-toggle'));
    await screen.findByTestId('step-library-empty');
    expect(screen.getByRole('textbox', { name: /Search the library/ })).toBe(screen.getByPlaceholderText('Search the library…'));
  });
});
