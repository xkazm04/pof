/**
 * Dialog-shell convergence: the five hand-rolled dialogs must render through the
 * shared accessible `ui/Modal` shell.
 *
 * Before this suite the five dialogs below each rendered their own
 * `fixed inset-0 … bg-black/60` backdrop with NO `role="dialog"`, no
 * `aria-modal`, no Escape handler, no focus trap and no focus restore. A
 * keyboard user could Tab straight out behind the backdrop — including out of
 * "Write to project", which is a destructive write-to-disk confirm.
 *
 * Two focus-restore paths are covered deliberately, because the five dialogs
 * split across both:
 *   - open flips false while the component stays MOUNTED (CodegenModal,
 *     WriteToProjectButton) — Modal's `[open]` effect.
 *   - the parent UNMOUNTS the dialog outright (`{show && <Picker/>}`:
 *     TemplatePicker, ImportScenarioModal, ProfileEditor) — Modal's unmount
 *     cleanup, which is the addition this port required.
 *
 * setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
 */
import { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MODULE_COLORS } from '@/lib/chart-colors';

import { ImportScenarioModal } from '@/components/modules/core-engine/sub_ability/gas-balance/ImportScenarioModal';
import { ACCENT } from '@/components/modules/core-engine/sub_ability/gas-balance/data';
import { ProfileEditor } from '@/components/modules/game-systems/BuildConfigSelector/ProfileEditor';
import { CodegenModal } from '@/components/modules/core-engine/sub_bestiary/archetypes/CodegenModal';
import type { EliteModifier } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { TemplatePicker } from '@/components/modules/core-engine/sub_ability/blueprint/TemplatePicker';
import { GAS_TEMPLATES } from '@/components/modules/core-engine/sub_ability/blueprint/templates';
import { WriteToProjectButton } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton';

// The diff renderer pulls in the shiki highlighter; the dialog shell is what is
// under test here, not the diff body.
vi.mock('@/components/modules/evaluator/PromptDiffView', () => ({
  PromptDiffView: () => <div data-testid="diff-stub" />,
}));

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch: apiFetchMock };
});

afterEach(cleanup);

/** jsdom reports inline hex colours back as rgb() — see reference_jsdom_inline_color_rgb. */
function rgbOf(hex: string): string {
  const probe = document.createElement('span');
  probe.style.color = hex;
  return probe.style.color;
}

const MOD: EliteModifier = {
  id: 'elite-frenzied',
  name: 'Frenzied',
  color: MODULE_COLORS.core,
  icon: '\u26a1',
  description: 'Attacks faster the lower its health.',
  tier: 'major',
  statMods: [],
  geClass: 'GE_Elite_Frenzied',
};

const WRITE_PLAN = {
  files: [
    {
      path: 'C:/proj/Source/PoF/Foo.h',
      relPath: 'Source/PoF/Foo.h',
      exists: false,
      before: '',
      after: 'struct FFoo {};',
      diff: { summary: { added: 1, removed: 0 } },
    },
  ],
};

/** Open a dialog from a real trigger so focus restore has something to restore to. */
function openFromTrigger(name: RegExp): HTMLElement {
  const trigger = screen.getByRole('button', { name });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('dialog shell convergence — the five hand-rolled dialogs use ui/Modal', () => {
  describe('ImportScenarioModal (gas-balance)', () => {
    it('renders role=dialog with aria-modal and the title as its accessible name', () => {
      render(<ImportScenarioModal onImport={() => {}} onClose={() => {}} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy!)?.textContent).toBe('Import Scenario');
    });

    it('closes on Escape', () => {
      const onClose = vi.fn();
      render(<ImportScenarioModal onImport={() => {}} onClose={onClose} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the accent theming after dropping the local header', () => {
      const { container } = render(<ImportScenarioModal onImport={() => {}} onClose={() => {}} />);

      const accented = Array.from(container.querySelectorAll<HTMLElement>('[style]')).filter(
        (el) => el.style.color === rgbOf(ACCENT) || el.style.backgroundColor === rgbOf(ACCENT),
      );
      expect(accented.length).toBeGreaterThan(0);
      // The Validate action still carries the accent (it is the module colour,
      // not a decoration) and the body still says what a scenario code is.
      expect(screen.getByRole('button', { name: /validate/i })).toBeTruthy();
      expect(container.textContent).toContain('base64 scenario code');
    });

    it('traps Tab focus inside the dialog', async () => {
      render(<ImportScenarioModal onImport={() => {}} onClose={() => {}} />);
      const dialog = screen.getByRole('dialog');

      // Validate is disabled while the field is empty, and a disabled button is
      // not focusable — type first so the trap's last stop is a real control.
      fireEvent.change(screen.getByLabelText('Scenario code'), { target: { value: 'abc' } });

      const close = screen.getByRole('button', { name: /close dialog/i });
      const validate = screen.getByRole('button', { name: /validate/i });

      validate.focus();
      fireEvent.keyDown(dialog, { key: 'Tab' });
      await waitFor(() => expect(document.activeElement).toBe(close));

      close.focus();
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      await waitFor(() => expect(document.activeElement).toBe(validate));
    });
  });

  describe('ProfileEditor (BuildConfigSelector)', () => {
    it('renders role=dialog with aria-modal and its title', () => {
      render(<ProfileEditor profile={{ id: 'p1', name: 'Ship' }} onSave={() => {}} onClose={() => {}} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(document.getElementById(labelledBy!)?.textContent).toBe('Edit Profile');
    });

    it('closes on Escape', () => {
      const onClose = vi.fn();
      render(<ProfileEditor profile={{}} onSave={() => {}} onClose={onClose} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('still saves the edited form (the port is shell-only)', () => {
      const onSave = vi.fn();
      render(<ProfileEditor profile={{ id: 'p1', name: 'Ship' }} onSave={onSave} onClose={() => {}} />);

      fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave.mock.calls[0][0].name).toBe('Ship');
    });
  });

  describe('CodegenModal (bestiary archetypes)', () => {
    function CodegenHarness() {
      const [mod, setMod] = useState<EliteModifier | null>(null);
      return (
        <div>
          <button onClick={() => setMod(MOD)}>Show codegen</button>
          <CodegenModal mod={mod} onClose={() => setMod(null)} />
        </div>
      );
    }

    it('renders nothing until a modifier is selected, then a real dialog', () => {
      render(<CodegenHarness />);
      expect(screen.queryByRole('dialog')).toBeNull();

      openFromTrigger(/show codegen/i);
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.textContent).toContain('GE_Elite_Frenzied');
    });

    it('closes on Escape', () => {
      const onClose = vi.fn();
      render(<CodegenModal mod={MOD} onClose={onClose} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('restores focus to the trigger on close (component stays mounted)', async () => {
      render(<CodegenHarness />);
      const trigger = openFromTrigger(/show codegen/i);

      const close = screen.getByRole('button', { name: /close dialog/i });
      await waitFor(() => expect(document.activeElement).toBe(close));

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  });

  describe('TemplatePicker (ability blueprint)', () => {
    function PickerHarness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Browse templates</button>
          {open && (
            <TemplatePicker
              templates={GAS_TEMPLATES.slice(0, 2)}
              activeTemplateName={null}
              onSelect={() => {}}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      );
    }

    it('renders role=dialog with aria-modal and its title', () => {
      render(
        <TemplatePicker
          templates={GAS_TEMPLATES.slice(0, 2)}
          activeTemplateName={null}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(document.getElementById(labelledBy!)?.textContent).toBe('Archetype Templates');
    });

    it('closes on Escape', () => {
      const onClose = vi.fn();
      render(
        <TemplatePicker
          templates={GAS_TEMPLATES.slice(0, 2)}
          activeTemplateName={null}
          onSelect={() => {}}
          onClose={onClose}
        />,
      );

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('restores focus to the trigger when the parent UNMOUNTS the dialog', async () => {
      render(<PickerHarness />);
      const trigger = openFromTrigger(/browse templates/i);

      const close = screen.getByRole('button', { name: /close dialog/i });
      await waitFor(() => expect(document.activeElement).toBe(close));

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  });

  describe('WriteToProjectButton (blueprint transpiler) — destructive write confirm', () => {
    beforeEach(() => {
      apiFetchMock.mockReset();
      apiFetchMock.mockResolvedValue(WRITE_PLAN);
    });

    function renderButton() {
      return render(
        <WriteToProjectButton
          className="AFoo"
          // The module is now owned by the view and threaded into codegen, so
          // the header must declare the matching API macro — a header naming a
          // different module blocks the confirm (bp-header-uht-valid).
          header={'class POF_API AFoo : public AActor'}
          source="// source"
          projectPath="C:/proj"
          moduleName="PoF"
          onModuleChange={() => {}}
        />,
      );
    }

    async function openDryRun(): Promise<HTMLElement> {
      const trigger = openFromTrigger(/write to project/i);
      await screen.findByRole('dialog');
      return trigger;
    }

    it('renders the dry-run confirm as a real dialog', async () => {
      renderButton();
      await openDryRun();

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(document.getElementById(labelledBy!)?.textContent).toContain('AFoo');
    });

    it('closes on Escape without writing anything', async () => {
      renderButton();
      await openDryRun();

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      // Only the dry run (confirm:false) ever went out.
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(apiFetchMock.mock.calls[0][1].body).confirm).toBe(false);
    });

    it('restores focus to the trigger when the confirm closes', async () => {
      renderButton();
      const trigger = await openDryRun();

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /close dialog/i })),
      );

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });

    it('still confirms the write with the frozen snapshot', async () => {
      renderButton();
      await openDryRun();

      apiFetchMock.mockResolvedValueOnce({ written: ['Source/PoF/Foo.h'] });
      fireEvent.click(screen.getByRole('button', { name: /confirm write/i }));

      await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
      const body = JSON.parse(apiFetchMock.mock.calls[1][1].body);
      expect(body.confirm).toBe(true);
      expect(body.className).toBe('AFoo');
      expect(body.approved).toEqual([{ relPath: 'Source/PoF/Foo.h', before: '' }]);
    });
  });
});
