/**
 * The streaming planner's forms: one meaning per field, reachable by name.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ZoneEditor } from '@/components/modules/content/level-design/StreamingZonePlanner/ZoneEditor';
import type { StreamingZone } from '@/components/modules/content/level-design/StreamingZonePlanner/types';

afterEach(cleanup);

const ZONE: StreamingZone = {
  id: 'z', name: 'Town', type: 'town', gridX: 2, gridY: 3, loadPriority: 'always', alwaysLoaded: true, preloadRadius: 1,
};

describe('ZoneEditor always-loaded pair', () => {
  it('unticking Always loaded leaves the always priority too, as the priority buttons do', () => {
    const onUpdate = vi.fn();
    render(<ZoneEditor zone={ZONE} onUpdate={onUpdate} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith({ alwaysLoaded: false, loadPriority: 'normal' });
  });
});
