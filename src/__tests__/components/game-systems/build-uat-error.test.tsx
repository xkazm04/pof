/**
 * A profile the UAT generator rejects says so on its card, instead of silently
 * omitting the "UAT Command" section (which looks the same as "no command concept").
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/modules/game-systems/CookProgress', () => ({ CookProgress: () => null }));
vi.mock('@/components/modules/game-systems/SmokeTest', () => ({ SmokeTest: () => null }));
vi.mock('@/components/modules/game-systems/NightlyBuildScheduler', () => ({ NightlyBuildScheduler: () => null }));
vi.mock('@/components/modules/game-systems/GateNotifySettings', () => ({ GateNotifySettings: () => null }));
vi.mock('@/components/modules/game-systems/PreflightPanel', () => ({ PreflightPanel: () => null }));

const generate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/packaging/uat-command-generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/packaging/uat-command-generator')>('@/lib/packaging/uat-command-generator');
  return { ...actual, generateUATCommand: generate };
});

import { BuildConfigSelector } from '@/components/modules/game-systems/BuildConfigSelector';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const profile = { ...createDefaultProfile('Win64'), id: 'p1', createdAt: 'x', updatedAt: 'x' };

function mockProfiles() {
  const body = { success: true, data: { profiles: [profile] } };
  globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })) as unknown as typeof fetch;
}

async function expand(container: HTMLElement) {
  const pkg = await screen.findByText('Package');
  fireEvent.click(pkg.closest('button')!.nextElementSibling as HTMLElement);
  return container;
}

describe('UAT command generation failure', () => {
  it('names the reason where the command would be', async () => {
    generate.mockImplementation(() => { throw new Error('projectPath is required'); });
    mockProfiles();
    const { container } = render(<BuildConfigSelector />);
    await expand(container);
    const text = container.textContent ?? '';
    expect(text).toContain('UAT command unavailable');
    expect(text).toContain('projectPath is required');
  });

  it('a healthy profile still shows its command and no error line', async () => {
    generate.mockImplementation(() => 'RunUAT.bat BuildCookRun');
    mockProfiles();
    const { container } = render(<BuildConfigSelector />);
    await expand(container);
    const text = container.textContent ?? '';
    expect(text).toContain('RunUAT.bat BuildCookRun');
    expect(text).not.toContain('UAT command unavailable');
  });
});
