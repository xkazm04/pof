/** A failed recent-projects call is non-fatal, but it is reported rather than swallowed. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockFetch } from '../setup';
import { logger } from '@/lib/logger';
import { useProjectStore } from '@/stores/projectStore';

const store = () => useProjectStore.getState();
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  mockFetch({ status: 500, body: { success: false, error: 'db down' } });
  useProjectStore.setState({ projectName: 'P', projectPath: 'C:/UE/P', isSetupComplete: true, recentProjects: [] });
});
afterEach(() => warn.mockRestore());

describe('recent project failures', () => {
  it('loadRecentProjects logs', async () => {
    await store().loadRecentProjects();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('saveToRecent logs', async () => {
    await store().saveToRecent();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('removeRecentProject logs and keeps the row', async () => {
    useProjectStore.setState({ recentProjects: [{ id: 'x' } as never] });
    await store().removeRecentProject('x');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(store().recentProjects).toHaveLength(1);
  });
});
