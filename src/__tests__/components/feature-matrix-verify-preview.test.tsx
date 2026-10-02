/**
 * Auto-Verify shows what it would write, and why, before anything is written.
 *
 * Before: the Auto-Verify button wrote every differing status at once and the user
 * saw only counts afterwards. Now the button opens a preview: each proposed flip
 * with from -> to and the manifest assets that justify it, review/fix downgrades
 * unpicked, and an explicit 'Apply k' that writes only the picks.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { VerificationPlan } from '@/types/pof-bridge';
import type { SubModuleId } from '@/types/modules';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const h = vi.hoisted(() => ({ useFeatureMatrix: vi.fn() }));
vi.mock('@/hooks/useFeatureMatrix', () => ({ useFeatureMatrix: h.useFeatureMatrix }));

import { VerifyPreviewPanel } from '@/components/modules/shared/FeatureMatrix/VerifyPreviewPanel';
import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

const MODULE = 'arpg-character' as SubModuleId;

const PLAN: VerificationPlan = {
  moduleId: MODULE,
  assetCount: 12,
  changes: [
    {
      featureName: 'AARPGPlayerCharacter', moduleId: MODULE, from: 'missing', to: 'implemented',
      evidence: ['/Game/Chars/BP_PlayerCharacter'], kind: 'upgrade', selectedByDefault: true, fromSource: 'review',
    },
    {
      featureName: 'AARPGCharacterBase', moduleId: MODULE, from: 'implemented', to: 'missing',
      evidence: [], kind: 'downgrade', selectedByDefault: false, fromSource: 'review',
    },
  ],
  unchanged: [],
  refused: [{ featureName: 'Not A Feature', moduleId: MODULE, reason: 'undeclared' }],
  results: [],
};

function renderPanel(onApply = vi.fn(), onClose = vi.fn()) {
  render(<VerifyPreviewPanel plan={PLAN} onApply={onApply} onClose={onClose} isApplying={false} />);
  return { onApply, onClose };
}

describe('VerifyPreviewPanel', () => {
  it('lists each proposed flip with from -> to and its evidence; the review downgrade starts unchecked', () => {
    renderPanel();
    const up = screen.getByTestId('verify-change-AARPGPlayerCharacter');
    expect(up.textContent).toContain('missing');
    expect(up.textContent).toContain('implemented');
    expect(up.textContent).toContain('/Game/Chars/BP_PlayerCharacter');
    expect((within(up).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);

    const down = screen.getByTestId('verify-change-AARPGCharacterBase');
    expect(down.textContent).toContain('implemented');
    expect(down.textContent).toContain('missing');
    expect((within(down).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);

    // The refused rule is shown as not written, never as a proposal.
    expect(screen.queryByTestId('verify-change-Not A Feature')).toBeNull();
    expect(screen.getByTestId('verify-refused').textContent).toContain('Not A Feature');
  });

  it("Apply reads 'Apply 1', unchecking everything disables it, and it hands over the checked names", () => {
    const { onApply } = renderPanel();
    const apply = screen.getByRole('button', { name: /apply/i });
    expect(apply.textContent).toContain('Apply 1');

    fireEvent.click(within(screen.getByTestId('verify-change-AARPGPlayerCharacter')).getByRole('checkbox'));
    expect((screen.getByRole('button', { name: /apply/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(within(screen.getByTestId('verify-change-AARPGPlayerCharacter')).getByRole('checkbox'));
    fireEvent.click(within(screen.getByTestId('verify-change-AARPGCharacterBase')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect([...onApply.mock.calls[0][0]].sort()).toEqual(['AARPGCharacterBase', 'AARPGPlayerCharacter']);
  });

  it('closing writes nothing', () => {
    const { onApply, onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('FeatureMatrix Auto-Verify button', () => {
  it('opens the preview (no write) and renders the plan the hook holds', () => {
    const previewAutoVerify = vi.fn(async () => PLAN);
    const applyAutoVerify = vi.fn();
    h.useFeatureMatrix.mockReturnValue({
      features: [{
        id: 1, moduleId: MODULE, featureName: 'AARPGPlayerCharacter', category: 'Core', status: 'missing',
        description: '', filePaths: [], reviewNotes: '', qualityScore: 3, nextSteps: '',
        lastReviewedAt: new Date().toISOString(), source: 'review',
      }],
      summary: { total: 1, implemented: 0, improved: 0, partial: 0, missing: 1, unknown: 0 },
      isLoading: false, error: null, retry: vi.fn(), refetch: vi.fn(), seed: vi.fn(), scope: null,
      previewAutoVerify, applyAutoVerify, discardAutoVerify: vi.fn(),
      verifyPlan: PLAN, isVerifying: false, verificationResults: [],
    });
    usePofBridgeStore.setState({ connectionStatus: 'connected' });
    render(<FeatureMatrix moduleId={MODULE} accentColor="var(--accent)" onReview={() => {}} isReviewing={false} />);

    fireEvent.click(screen.getByRole('button', { name: /auto-verify/i }));
    expect(previewAutoVerify).toHaveBeenCalledTimes(1);
    expect(applyAutoVerify).not.toHaveBeenCalled();
    expect(screen.getByTestId('verify-change-AARPGPlayerCharacter')).toBeTruthy();
    usePofBridgeStore.setState({ connectionStatus: 'disconnected' });
  });
});
