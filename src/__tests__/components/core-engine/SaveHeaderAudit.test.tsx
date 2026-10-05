/**
 * The Save tab's "Your save class" panel — click gate.
 *
 * The panel audits the project's real USaveGame subclass on mount (a read-only POST), but
 * the only thing that writes to the UE project is the CLI task behind the Fix button. So:
 * mounting, the auto-audit and Re-audit must NEVER dispatch; one click on Fix dispatches
 * exactly one askClaude task carrying exactly `buildSaveFixPrompt(audit)`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { SaveHeaderAudit } from '@/components/modules/core-engine/sub_save/schema/SaveHeaderAudit';
import { useProjectStore } from '@/stores/projectStore';
import { parseHeader } from '@/lib/cpp-semantic-parser';
import { findSaveGameClasses, auditSaveClass, buildSaveFixPrompt } from '@/lib/save-schema/header-audit';
import { TaskFactory } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-save' as SubModuleId;

const SAVE_H = `UCLASS()
class DID_API UARPGSaveGame : public USaveGame
{
\tGENERATED_BODY()
public:
\tUPROPERTY() int32 PlayerLevel;
\tUPROPERTY(Transient) float CachedHealth;
\tUPROPERTY() FTimerHandle AutoSaveTimer;
};
`;
const saveClasses = findSaveGameClasses([parseHeader(SAVE_H, 'Source/Did/Public/ARPGSaveGame.h')]);

const fetchMock = vi.fn(async () => ({
  json: async () => ({ success: true, data: { headersScanned: 3, saveClasses } }),
}));

beforeEach(() => {
  execute.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  useProjectStore.setState({ projectPath: 'C:/UE/Did' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SaveHeaderAudit — the fix dispatches only on an explicit click', () => {
  it('click gate: mount + auto-audit + Re-audit never dispatch; Fix dispatches buildSaveFixPrompt(audit) exactly once', async () => {
    render(<SaveHeaderAudit moduleId={MODULE} />);

    // Auto-audit on mount: one read-only POST with the project path, then the class shows.
    await screen.findByText('UARPGSaveGame');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/save-schema/audit');
    expect(JSON.parse(init.body as string)).toEqual({ projectPath: 'C:/UE/Did' });
    expect(screen.getByText(/3 headers scanned/)).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();

    // Re-audit re-POSTs and still dispatches nothing.
    fireEvent.click(screen.getByText('Re-audit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await screen.findByText('UARPGSaveGame');
    expect(execute).not.toHaveBeenCalled();

    // One click on Fix -> exactly one task with exactly the audit's fix prompt.
    const audit = auditSaveClass(saveClasses[0]);
    const prompt = buildSaveFixPrompt(audit)!;
    expect(prompt).not.toBeNull();
    const k = audit.findings.length + audit.missing.length + audit.mismatched.length;
    const fix = screen.getByText(`Fix ${k} findings in UE`).closest('button') as HTMLButtonElement;
    expect(fix.disabled).toBe(false);
    fireEvent.click(fix);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({ ...TaskFactory.askClaude(MODULE, prompt, ''), label: expect.any(String) });
  });

  it('no save class: the empty state names the headers scanned and dispatches nothing until clicked', async () => {
    fetchMock.mockImplementation(async () => ({
      json: async () => ({ success: true, data: { headersScanned: 11, saveClasses: [] } }),
    }));
    render(<SaveHeaderAudit moduleId={MODULE} />);
    await screen.findByText(/No USaveGame subclass in Source\/ \(11 headers\)/);
    expect(execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Create it \(as-1\)/));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toMatchObject({ type: 'checklist', moduleId: MODULE, itemId: 'as-1' });
  });
});
