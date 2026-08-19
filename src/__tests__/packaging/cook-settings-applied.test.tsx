/**
 * A cook setting either reaches the build or SAYS it does not.
 *
 * Three `CookSettings` fields were persisted by the profile editor and emitted by
 * nothing: `compressTextures`, `pluginsToDisable`, `textureStreamingBudgetMB` appeared
 * nowhere in `uat-command-generator.ts`. A user who typed `OnlineSubsystemSteam` into
 * "Plugins to exclude from the build", saved, and waited 40 minutes got a build with
 * Steam in it — and the profile card ADVERTISED the phantom: all 9 saved profiles carry
 * `compressTextures: true`, so all 9 rendered a "Tex Compress" badge beside a UAT preview
 * containing nothing about textures. The card contradicted itself on one screen.
 *
 * No flag is invented here. Plugin enablement and texture compression are
 * `.uproject`/`.ini`/target-rules concerns; the fix is one shared application table the
 * generator emits from and the UI discloses from, so the two cannot disagree.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, act } from '@testing-library/react';
import {
  DEFAULT_COOK_SETTINGS,
  createDefaultProfile,
  type BuildProfile,
  type CookSettings,
} from '@/lib/packaging/build-profiles';
import {
  generateUATCommand,
  COOK_SETTING_APPLICATION,
  APPLIED_COOK_SETTING_KEYS,
  NOT_APPLIED_COOK_SETTING_KEYS,
  unappliedCookSettings,
  isCookSettingEngaged,
} from '@/lib/packaging/uat-command-generator';
import { PlatformProfileCard } from '@/components/modules/game-systems/PlatformProfileCard';
import { CookSettingsPanel } from '@/components/modules/game-systems/CookSettingsPanel';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const PROJECT_PATH = 'C:/Users/kazda/Documents/Unreal Projects/PoF';

function profileWith(cook: Partial<CookSettings>): BuildProfile {
  const base = createDefaultProfile('Win64', 'Shipping');
  return {
    ...base,
    id: 'p1',
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z',
    cookSettings: { ...DEFAULT_COOK_SETTINGS, ...cook },
  };
}

function commandFor(profile: BuildProfile): string {
  return generateUATCommand(profile, PROJECT_PATH, 'PoF', '5.8');
}

/** Open the card's expanded section (the chevron beside "Package"). */
function expand(container: HTMLElement): void {
  const chevron = container.querySelectorAll('button')[1] as HTMLButtonElement;
  act(() => { fireEvent.click(chevron); });
}

describe('the cook-settings application table', () => {
  it('classifies EVERY CookSettings key — a new setting cannot be silently dropped', () => {
    const declared = new Set([...APPLIED_COOK_SETTING_KEYS, ...NOT_APPLIED_COOK_SETTING_KEYS]);
    const actual = Object.keys(DEFAULT_COOK_SETTINGS) as (keyof CookSettings)[];
    const unclassified = actual.filter((k) => !declared.has(k));
    expect(unclassified).toEqual([]);
  });

  it('records a REASON for every setting the command cannot carry', () => {
    for (const key of NOT_APPLIED_COOK_SETTING_KEYS) {
      const reason = COOK_SETTING_APPLICATION[key].reason ?? '';
      expect(reason.length, `${key} is on the not-applied list with no reason`).toBeGreaterThan(40);
    }
    // The three the direction names — pinned so a future edit cannot quietly
    // promote one to "applied" without adding a real flag.
    expect(NOT_APPLIED_COOK_SETTING_KEYS.sort()).toEqual(
      ['compressTextures', 'pluginsToDisable', 'textureStreamingBudgetMB'],
    );
  });

  it('every ENGAGED cook setting is either in the command or on the not-applied list', () => {
    // Everything turned on at once — the state that exposes a silent drop.
    const profile = profileWith({
      usePak: true, compressPak: true, encryptPak: true, useIoStore: true,
      iterativeCooking: true, cookOnTheFly: true,
      mapsToInclude: ['/Game/Maps/Arena'],
      compressTextures: true,
      pluginsToDisable: ['OnlineSubsystemSteam'],
      textureStreamingBudgetMB: 512,
    });
    const cmd = commandFor(profile);
    const dropped: string[] = [];
    for (const key of Object.keys(profile.cookSettings) as (keyof CookSettings)[]) {
      if (!isCookSettingEngaged(profile.cookSettings, key)) continue;
      const entry = COOK_SETTING_APPLICATION[key];
      if (entry.appliedAs === null) continue; // explicitly, reasonedly not applied
      // `-map=<Map1+Map2>` is a template; assert its stem reached the command.
      const stem = entry.appliedAs.split('<')[0];
      if (!cmd.includes(stem)) dropped.push(`${key} (expected ${entry.appliedAs})`);
    }
    expect(dropped).toEqual([]);
  });

  it('does NOT invent a flag for the three settings BuildCookRun cannot carry', () => {
    const cmd = commandFor(profileWith({
      compressTextures: true,
      pluginsToDisable: ['OnlineSubsystemSteam'],
      textureStreamingBudgetMB: 512,
    }));
    expect(cmd.toLowerCase()).not.toContain('onlinesubsystemsteam');
    expect(cmd.toLowerCase()).not.toContain('texture');
    expect(cmd).not.toContain('512');
  });

  it('preserves the exact command a default Win64 Shipping profile has always produced', () => {
    // Preserved-behaviour pin: the emission moved to a table-driven loop, and the
    // arguments must be byte-identical. Green before AND after — this pins the
    // refactor, it is not proof of the fix.
    const cmd = commandFor(profileWith({}));
    expect(cmd).toContain('BuildCookRun');
    expect(cmd).toContain('-cook');
    expect(cmd).toContain('-pak');
    expect(cmd).toContain('-compressed');
    expect(cmd).toContain('-iostore');
    expect(cmd).not.toContain('-encryptpakindex');
    expect(cmd).not.toContain('-iterativecooking');
    expect(cmd).not.toContain('-cookonthefly');
    expect(cmd.indexOf('-pak')).toBeLessThan(cmd.indexOf('-compressed'));
    expect(cmd.indexOf('-compressed')).toBeLessThan(cmd.indexOf('-iostore'));
  });

  it('unappliedCookSettings reports only what the profile actually asks for', () => {
    expect(unappliedCookSettings({ ...DEFAULT_COOK_SETTINGS, compressTextures: false }))
      .toEqual([]);
    const engaged = unappliedCookSettings({
      ...DEFAULT_COOK_SETTINGS,
      compressTextures: true,
      pluginsToDisable: ['OnlineSubsystemSteam'],
      textureStreamingBudgetMB: 512,
    });
    expect(engaged.map((u) => u.key).sort())
      .toEqual(['compressTextures', 'pluginsToDisable', 'textureStreamingBudgetMB']);
    expect(engaged.find((u) => u.key === 'pluginsToDisable')?.value).toBe('OnlineSubsystemSteam');
    expect(engaged.find((u) => u.key === 'textureStreamingBudgetMB')?.value).toBe('512');
  });
});

describe('the profile card and the UAT preview cannot disagree', () => {
  /** Every cook-setting badge the card renders, from the applied-settings group. */
  function badgeLabels(container: HTMLElement): string[] {
    const heading = within(container).getByText('Cook Settings');
    const group = heading.parentElement!.querySelector('div.flex.flex-wrap')!;
    return [...group.children].map((el) => (el.textContent ?? '').trim());
  }

  it('renders no badge for a setting the command below does not carry', () => {
    const profile = profileWith({
      compressTextures: true,
      pluginsToDisable: ['OnlineSubsystemSteam'],
      textureStreamingBudgetMB: 512,
    });
    const cmd = commandFor(profile);
    const { container } = render(
      <PlatformProfileCard
        profile={profile}
        uatCommand={cmd}
        onEdit={() => {}}
        onDelete={() => {}}
        onSetDefault={() => {}}
        onPackage={() => {}}
      />,
    );
    expand(container);

    const labels = badgeLabels(container);
    // The phantom: a "Tex Compress" badge beside a command with no texture argument.
    expect(labels).not.toContain('Tex Compress');
    // Every remaining cook badge maps to something the command really carries.
    const appliedLabelToStem: Record<string, string> = {
      IoStore: '-iostore',
      Iterative: '-iterativecooking',
    };
    for (const label of labels) {
      const stem = appliedLabelToStem[label];
      if (stem) expect(cmd, `badge "${label}" is not in the command`).toContain(stem);
    }
  });

  it('states the settings it holds that this command does not apply, with the reason', () => {
    const profile = profileWith({
      compressTextures: true,
      pluginsToDisable: ['OnlineSubsystemSteam'],
      textureStreamingBudgetMB: 512,
    });
    const { container } = render(
      <PlatformProfileCard
        profile={profile}
        uatCommand={commandFor(profile)}
        onEdit={() => {}}
        onDelete={() => {}}
        onSetDefault={() => {}}
        onPackage={() => {}}
      />,
    );
    expand(container);

    const block = screen.getByTestId('profile-unapplied-p1');
    const text = block.textContent ?? '';
    expect(text).toMatch(/NOT applied by this command/i);
    expect(text).toContain('OnlineSubsystemSteam');
    expect(text).toContain('Compress textures');
    expect(text).toContain('512');
    // The reason is present, not just the label.
    expect(text).toMatch(/\.uproject|DefaultEngine\.ini|r\.Streaming\.PoolSize/);
  });

  it('says nothing when the profile asks for nothing the command cannot do', () => {
    const profile = profileWith({ compressTextures: false });
    const { container } = render(
      <PlatformProfileCard
        profile={profile}
        uatCommand={commandFor(profile)}
        onEdit={() => {}}
        onDelete={() => {}}
        onSetDefault={() => {}}
        onPackage={() => {}}
      />,
    );
    expand(container);
    expect(screen.queryByTestId('profile-unapplied-p1')).toBeNull();
  });
});

describe('the cook-settings editor discloses at the control', () => {
  it('marks each not-applied control, naming why the command cannot carry it', () => {
    render(<CookSettingsPanel settings={{ ...DEFAULT_COOK_SETTINGS }} onChange={() => {}} />);
    for (const key of NOT_APPLIED_COOK_SETTING_KEYS) {
      const note = screen.getByTestId(`cook-setting-not-applied-${key}`);
      expect(note.textContent ?? '').toMatch(/Not applied by the generated command/i);
      expect((note.textContent ?? '').length).toBeGreaterThan(60);
    }
  });

  it('leaves an APPLIED control undecorated — the warning must mean something', () => {
    render(<CookSettingsPanel settings={{ ...DEFAULT_COOK_SETTINGS }} onChange={() => {}} />);
    for (const key of APPLIED_COOK_SETTING_KEYS) {
      expect(screen.queryByTestId(`cook-setting-not-applied-${key}`)).toBeNull();
    }
  });

  it('no longer offers the plugin box a placeholder that promises exclusion', () => {
    const { container } = render(
      <CookSettingsPanel settings={{ ...DEFAULT_COOK_SETTINGS }} onChange={() => {}} />,
    );
    const areas = [...container.querySelectorAll('textarea')];
    const plugins = areas.find((a) => (a.getAttribute('placeholder') ?? '').includes('OnlineSubsystemSteam'));
    expect(plugins).toBeTruthy();
    expect(plugins!.getAttribute('placeholder') ?? '').not.toMatch(/exclude from the build\./);
  });
});
