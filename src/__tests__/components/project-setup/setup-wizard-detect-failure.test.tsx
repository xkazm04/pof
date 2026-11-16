import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { useProjectStore } from '@/stores/projectStore';

afterEach(cleanup);

const failing = new Set<string>();
const PROJECT = { name: 'Alpha', path: 'C:/p/Alpha', uprojectFile: 'Alpha.uproject', engineVersion: '5.8', validated: true };

beforeEach(() => {
  failing.clear();
  useProjectStore.setState({ projectName: '', projectPath: '', isSetupComplete: false, isNewProject: true, ueVersion: '5.8.0' });
  globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const { action } = JSON.parse(String(init?.body ?? '{}')) as { action: string };
    if (failing.has(action)) {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ success: false, error: 'scan exploded' }),
        text: () => Promise.resolve(''),
      });
    }
    const data = action === 'detect-projects' ? { projects: [PROJECT] } : { projects: [], engines: [], directories: [], path: 'C:/h' };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve('') });
  }) as unknown as typeof fetch;
});

describe('SetupWizard project detection failure', () => {
  it('reports a failed UE scan instead of "No UE projects found", and retries', async () => {
    failing.add('detect-projects');
    render(<SetupWizard />);
    await waitFor(() => expect(screen.getByTestId('pof-setup-wizard-detect-error').textContent).toContain('scan exploded'));
    expect(screen.queryByText('No UE projects found')).toBeNull();

    failing.clear();
    fireEvent.click(screen.getByTestId('pof-setup-wizard-detect-retry'));
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());
    expect(screen.queryByTestId('pof-setup-wizard-detect-error')).toBeNull();
  });

  it('reports a failed Godot scan instead of "No Godot projects found"', async () => {
    failing.add('detect-godot-projects');
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('pof-setup-wizard-engine-pill-godot'));
    await waitFor(() => expect(screen.getByTestId('pof-setup-wizard-detect-error').textContent).toContain('scan exploded'));
    expect(screen.queryByText('No Godot projects found')).toBeNull();
  });
});
