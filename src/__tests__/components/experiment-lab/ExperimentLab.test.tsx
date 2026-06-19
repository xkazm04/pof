import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExperimentLab } from '@/components/experiment-lab/ExperimentLab';
import { UE_GOTCHAS } from '@/lib/knowledge/ue-gotchas';

afterEach(cleanup);

describe('ExperimentLab', () => {
  it('renders the probe editor + Run button', () => {
    render(<ExperimentLab />);
    const ta = screen.getByLabelText('Experiment Python') as HTMLTextAreaElement;
    expect(ta.value).toContain("unreal.log('RESULT=");
    expect(screen.getByRole('button', { name: /Run on UE 5\.8/ })).toBeTruthy();
  });

  it('seeds the probe from a chosen research finding', () => {
    render(<ExperimentLab />);
    const g = UE_GOTCHAS[0];
    fireEvent.change(screen.getByLabelText('Seed from a research finding'), { target: { value: g.id } });
    const ta = screen.getByLabelText('Experiment Python') as HTMLTextAreaElement;
    expect(ta.value).toContain(`# ${g.summary}`);
  });
});
