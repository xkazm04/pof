import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BuildVerifyPanel } from '@/components/modules/project-setup/BuildVerifyPanel';
import { useProjectStore } from '@/stores/projectStore';

afterEach(cleanup);

function renderPanel(engines: { version: string; path: string }[]) {
  useProjectStore.setState({ projectName: 'PoF', projectPath: 'C:/p/PoF', ueVersion: '5.7.0' });
  return render(<BuildVerifyPanel engines={engines} isRunning={false} onSendPrompt={vi.fn()} />);
}

describe('BuildVerifyPanel engine mismatch', () => {
  it('states the fallback engine when none matches the project', () => {
    const { container } = renderPanel([{ version: '5.8.0', path: 'C:/UE_5.8' }]);
    const note = container.querySelector('[data-testid="pof-setup-build-engine-mismatch"]');
    expect(note?.textContent).toContain('UE 5.8.0');
  });

  it('says nothing when an installed engine matches', () => {
    const { container } = renderPanel([{ version: '5.7.2', path: 'C:/UE_5.7' }]);
    expect(container.querySelector('[data-testid="pof-setup-build-engine-mismatch"]')).toBeNull();
  });
});
