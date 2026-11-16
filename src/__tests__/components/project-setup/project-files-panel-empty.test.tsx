import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProjectFilesPanel } from '@/components/modules/project-setup/ProjectFilesPanel';

afterEach(cleanup);

describe('ProjectFilesPanel', () => {
  it('draws no empty-state copy: its only caller never renders it without files', () => {
    const { container } = render(
      <ProjectFilesPanel projectPath="C:/p" projectFiles={[]} onOpenInExplorer={vi.fn()} />,
    );
    expect(container.textContent).not.toContain('No files created yet');
  });

  it('lists the files it is given', () => {
    const { container } = render(
      <ProjectFilesPanel projectPath="C:/p" projectFiles={['C:/p/a.uproject']} onOpenInExplorer={vi.fn()} />,
    );
    expect(container.textContent).toContain('C:/p/a.uproject');
  });
});
