import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LabDrawer } from '@/components/layout-lab/LabDrawer';
import { LIGHT } from '@/components/layout-lab/theme';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
afterEach(cleanup);

describe('LabDrawer', () => {
  it('renders a modal dialog with the given id + closes on backdrop click', () => {
    const onClose = vi.fn();
    render(<LabDrawer t={LIGHT} open id="lab-tree-drawer" title="Catalogs" width={300} onClose={onClose}>x</LabDrawer>);
    const dialog = screen.getByRole('dialog', { name: 'Catalogs' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.click(screen.getByTestId('lab-tree-drawer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
  it('renders nothing when closed', () => {
    const { container } = render(<LabDrawer t={LIGHT} open={false} id="lab-pipeline-drawer" title="Pipeline" width={360} onClose={() => {}}>x</LabDrawer>);
    expect(container.querySelector('[data-testid="lab-pipeline-drawer-backdrop"]')).toBeNull();
  });
});
