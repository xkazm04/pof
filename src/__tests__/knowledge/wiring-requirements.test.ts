import { describe, it, expect } from 'vitest';
import { formatWiringRequirements } from '@/lib/knowledge/wiring-requirements';
import type { WiringAsset } from '@/lib/feature-definitions';

describe('formatWiringRequirements', () => {
  it('emits the heading, four sub-prompts, and the wiring output-field instruction with no args', () => {
    const out = formatWiringRequirements();
    const lower = out.toLowerCase();
    expect(out).toContain('## Wiring Requirements');
    expect(lower).toContain('grant');
    expect(lower).toContain('activat');
    expect(lower).toContain('depend');
    expect(lower).toContain('verif');
    expect(out).toContain('`wiring`');
  });

  it('lists module assets as "name (kind): note" when moduleAssets is supplied', () => {
    const moduleAssets: WiringAsset[] = [
      { name: 'WBP_ARPGHUD', kind: 'WidgetBlueprint', note: 'UMG widget bound via BindWidget' },
    ];
    const out = formatWiringRequirements({ moduleAssets });
    expect(out).toContain('Known editor-authored dependencies for this module');
    expect(out).toContain('WBP_ARPGHUD (WidgetBlueprint): UMG widget bound via BindWidget');
  });

  it('renders known reqs as a markdown table when supplied', () => {
    const out = formatWiringRequirements({
      reqs: [{ artifact: 'GA_MeleeAttack', grantedBy: 'ASC', activatedBy: 'IA_PrimaryAttack', dependencies: ['AM_MeleeCombo'], verification: 'plays on click' }],
    });
    expect(out).toContain('| Artifact | Granted by | Activated by | Dependencies | Verify |');
    expect(out).toContain('GA_MeleeAttack');
    expect(out).toContain('IA_PrimaryAttack');
    expect(out).toContain('AM_MeleeCombo');
  });

  it('omits the asset and table sections when given no data', () => {
    const out = formatWiringRequirements();
    expect(out).not.toContain('Known editor-authored dependencies');
    expect(out).not.toContain('| Artifact |');
  });
});
