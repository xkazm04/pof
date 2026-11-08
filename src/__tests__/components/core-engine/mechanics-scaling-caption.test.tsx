import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false }),
}));

import { MechanicsScalingTab } from '@/components/modules/core-engine/sub_inventory/mechanics/MechanicsScalingTab';
import { SCALING_LINES } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { buildBalancePrompt } from '@/components/modules/core-engine/sub_inventory/_shared/balance-prompt';
import type { SubModuleId } from '@/types/modules';

afterEach(cleanup);

describe('Item Level Scaling Preview caption', () => {
  it('states the level range the curves actually span - the same range the Balance Advisor prompt quotes', () => {
    const pts = SCALING_LINES[0].points;
    const range = `${pts[0].level}-${pts[pts.length - 1].level}`;
    // The prompt derives its range from the data.
    expect(buildBalancePrompt([])).toContain(`Level ${range}`);
    render(<MechanicsScalingTab moduleId={'arpg-inventory' as SubModuleId} featureMap={new Map()} />);
    const caption = screen.getByText(/stat values across item levels/i).textContent ?? '';
    expect(caption).toContain(`item levels ${range}`);
  });
});
