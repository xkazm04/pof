/**
 * Guard: no component outside `src/components/ui/` may hand-roll a modal scrim.
 *
 * A "scrim" here is the shape every hand-rolled dialog in this repo used:
 * a `fixed inset-0` layer at `z-50` (or higher) painted with a black wash —
 * either the `bg-black/NN` utility or an inline `rgba(0,0,0,…)` background.
 * `TemplatePicker` used the inline form, so a class-only rule would have missed
 * it; both spellings are matched.
 *
 * Such a file must ALSO contain `role="dialog"`. The shared `ui/Modal` shell
 * supplies it together with aria-modal, an Escape handler, a Tab focus trap and
 * focus restore — the six guarantees a bespoke backdrop silently drops.
 *
 * The rule is file-scoped on purpose: it is a cheap smell test, not a parser.
 * A file that legitimately owns dialog semantics passes on its own merits, so
 * the allowlist below is short and every entry states WHY.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const COMPONENTS_ROOT = join(process.cwd(), 'src', 'components');

/**
 * Files allowed to paint a full-screen black scrim without `role="dialog"`.
 * An unexplained entry is how a guard rots into decoration — each one names the
 * reason, and the reason is asserted to still hold.
 */
const ALLOWLIST: Record<string, string> = {
  // A command palette, not a dialog: it owns its own Escape handling and roving
  // focus over a combobox/listbox, and exposes role="combobox" + role="listbox"
  // instead. Porting it to Modal would fight both. Explicitly out of scope of
  // the dialog-shell convergence.
  'modules/core-engine/sub_ability/SpellbookSearchPalette.tsx':
    'command palette — owns Escape + roving focus, exposes combobox/listbox roles',
};

/** The evidence each allowlist entry rests on, re-checked so it cannot go stale. */
const ALLOWLIST_EVIDENCE: Record<string, RegExp[]> = {
  'modules/core-engine/sub_ability/SpellbookSearchPalette.tsx': [
    /role="combobox"/,
    /role="listbox"/,
    /'Escape'|"Escape"/,
  ],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Files with a full-screen, high-z, black-washed layer. */
function findScrims(): { rel: string; hasDialogRole: boolean }[] {
  return walk(COMPONENTS_ROOT)
    .map((full) => ({ full, src: readFileSync(full, 'utf8') }))
    .filter(({ src }) =>
      /fixed inset-0/.test(src) &&
      /z-50|z-\[\s*\d{2,}\s*\]/.test(src) &&
      /bg-black\/|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/.test(src),
    )
    .map(({ full, src }) => ({
      rel: relative(COMPONENTS_ROOT, full).split(sep).join('/'),
      hasDialogRole: /role="dialog"/.test(src),
    }));
}

describe('no hand-rolled dialog scrims outside src/components/ui/', () => {
  it('every full-screen black scrim outside ui/ also declares role="dialog"', () => {
    const offenders = findScrims()
      .filter((f) => !f.rel.startsWith('ui/'))
      .filter((f) => !f.hasDialogRole)
      .filter((f) => !(f.rel in ALLOWLIST))
      .map((f) => f.rel);

    expect(offenders).toEqual([]);
  });

  it('the allowlist is not stale: every entry still exists and still earns its reason', () => {
    const scrims = new Set(findScrims().map((f) => f.rel));

    for (const [rel, reason] of Object.entries(ALLOWLIST)) {
      expect(reason.length, `${rel} needs a stated reason`).toBeGreaterThan(20);
      // Still a scrim — an entry for a file that no longer matches is dead weight
      // that would silently cover a future regression at the same path.
      expect(scrims.has(rel), `allowlisted file no longer matches the scrim shape: ${rel}`).toBe(true);

      const src = readFileSync(join(COMPONENTS_ROOT, ...rel.split('/')), 'utf8');
      for (const evidence of ALLOWLIST_EVIDENCE[rel] ?? []) {
        expect(evidence.test(src), `${rel} no longer satisfies ${evidence}`).toBe(true);
      }
    }
  });

  it('the five converged dialogs are scrim-free (Modal owns the backdrop now)', () => {
    const converged = [
      'modules/core-engine/sub_ability/gas-balance/ImportScenarioModal.tsx',
      'modules/game-systems/BuildConfigSelector/ProfileEditor.tsx',
      'modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton.tsx',
      'modules/core-engine/sub_bestiary/archetypes/CodegenModal.tsx',
      'modules/core-engine/sub_ability/blueprint/TemplatePicker.tsx',
    ];
    const scrims = new Set(findScrims().map((f) => f.rel));

    for (const rel of converged) {
      const src = readFileSync(join(COMPONENTS_ROOT, ...rel.split('/')), 'utf8');
      expect(scrims.has(rel), `${rel} still hand-rolls a backdrop`).toBe(false);
      expect(/from '@\/components\/ui\/Modal'/.test(src), `${rel} must render through ui/Modal`).toBe(true);
    }
  });
});
