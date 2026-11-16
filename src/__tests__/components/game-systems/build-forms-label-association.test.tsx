/**
 * Every visible field label in the two build forms names its control.
 *
 * The labels were bare `<label>` siblings with no `htmlFor`, so a screen reader
 * announced "edit text" / "combo box" with no name and clicking the label did nothing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';
import { RecordBuildForm } from '@/components/modules/game-systems/BuildHistoryDashboard/RecordBuildForm';
import { ProfileEditor } from '@/components/modules/game-systems/BuildConfigSelector/ProfileEditor';

afterEach(cleanup);

describe('build form labels are associated', () => {
  it.each(['Platform', 'Config', 'Status', 'Size (GB)', 'Duration (min)'])('Record form: %s', (name) => {
    render(<RecordBuildForm onSubmit={() => {}} nextVersion="0.1.1" />);
    const el = screen.getByLabelText(name);
    expect(['INPUT', 'SELECT']).toContain(el.tagName);
  });

  it.each(['Profile Name', 'Platform', 'Output Directory', 'Archive Directory', 'Custom UAT Flags'])('Profile editor: %s', (name) => {
    render(<ProfileEditor profile={createDefaultProfile('Win64')} onSave={() => {}} onClose={() => {}} />);
    const el = screen.getByLabelText(name);
    expect(['INPUT', 'SELECT']).toContain(el.tagName);
  });

  it('Profile editor: the Configuration choices form a named group', () => {
    render(<ProfileEditor profile={createDefaultProfile('Win64')} onSave={() => {}} onClose={() => {}} />);
    const group = screen.getByRole('group', { name: 'Configuration' });
    expect(group.querySelectorAll('button').length).toBe(4);
  });
});
