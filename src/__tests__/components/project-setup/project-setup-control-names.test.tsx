import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProjectFilesPanel } from '@/components/modules/project-setup/ProjectFilesPanel';
import { StatusChecklist } from '@/components/modules/project-setup/StatusChecklist';

afterEach(cleanup);

describe('Project Setup control names', () => {
  it('names each file row copy button after its file', () => {
    render(
      <ProjectFilesPanel projectPath="C:/p" projectFiles={['C:/p/A.uproject', 'Source/A/']} onOpenInExplorer={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Copy path C:/p/A.uproject' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy path Source/A/' })).toBeTruthy();
  });

  it('labels the manifest import field independently of its placeholder', () => {
    render(
      <StatusChecklist
        checklist={[{ id: 'engine', label: 'Unreal Engine', ok: true, detail: 'UE 5.8' }]}
        scanning={false}
        okCount={1}
        missingToolCount={0}
        isBootstrapping={false}
        onScan={vi.fn()}
        onFixAllMissing={vi.fn()}
        onBootstrapFromManifest={vi.fn()}
        onManifestExported={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Import Manifest'));
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe('Environment manifest JSON');
  });
});
