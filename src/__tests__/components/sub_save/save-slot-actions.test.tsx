import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SlotManagement } from '@/components/modules/core-engine/sub_save/slots/SlotManagement';
import { ENHANCED_SLOTS } from '@/components/modules/core-engine/sub_save/_shared/data';

afterEach(cleanup);

describe('SlotManagement actions', () => {
  it('does not offer Load/Delete/Duplicate/Export as live controls with no handler', () => {
    const { container } = render(<SlotManagement />);
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBe(ENHANCED_SLOTS.length * 4);
    for (const b of buttons) {
      expect(b.disabled).toBe(true);
      expect(b.getAttribute('type')).toBe('button');
      expect(b.getAttribute('title')).toBeTruthy();
    }
  });
});
